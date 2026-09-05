import { hostnameOf } from "@/lib/url"

import { customDesk, useCustomFeedsStore } from "./custom-feeds-store"
import { NewsApiError } from "./errors"
import { FEEDS, originsOf } from "./feed-catalog"
import { decodeEntities } from "./feed-parser"
import { feedCredits, fetchFeeds, isTimeout, PAGE_SIZE, withDeadline } from "./news-feeds"
import type { CustomDesk, NewsArticle, NewsCategory, NewsCategoryId } from "./types"

async function fetchJson<T>(url: URL, signal: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { signal: withDeadline(signal) })
  } catch (error) {
    if (isTimeout(error)) {
      throw new NewsApiError("The news service took too long to answer.")
    }
    throw error
  }

  if (!response.ok) {
    // 429/503 is a free API asking to be left alone for a moment, which is
    // worth saying plainly: retrying immediately would only dig deeper.
    throw new NewsApiError(
      response.status === 429 || response.status === 503
        ? "The news service is busy right now. Try again in a minute."
        : "The news service is unavailable right now."
    )
  }
  return (await response.json()) as T
}

/**
 * Merges several sources into one desk, tolerating the loss of any of them.
 * What it buys is a desk that degrades instead of failing: Space reads its
 * newsrooms *and* the Spaceflight API, so it still fills the grid before host
 * access is granted, and simply gets richer once it is.
 */
function combine(...sources: ((signal: AbortSignal) => Promise<NewsArticle[]>)[]) {
  return async (signal: AbortSignal): Promise<NewsArticle[]> => {
    const results = await Promise.allSettled(sources.map((source) => source(signal)))

    const seen = new Set<string>()
    const articles: NewsArticle[] = []
    for (const result of results) {
      if (result.status !== "fulfilled") continue
      for (const article of result.value) {
        if (seen.has(article.url)) continue
        seen.add(article.url)
        articles.push(article)
      }
    }

    if (articles.length === 0) {
      const failure = results.find((result) => result.status === "rejected")
      if (failure?.status === "rejected") throw failure.reason
    }

    articles.sort((a, b) => b.publishedAt - a.publishedAt)
    return articles.slice(0, PAGE_SIZE)
  }
}

// ------------------------------------------------- Wikipedia current events

/**
 * Wikipedia's Current events portal: one page per day, written by editors, in
 * which every line cites the outlet it came from (Reuters, the BBC, AP…).
 *
 * It backs the one desk the newsroom feeds cannot reproduce (a neutral daily
 * digest of a running story rather than each outlet's own take on it), and it
 * is the only general-news source that answers a cross-origin request from an
 * extension unasked, so Geopolitics keeps working when host access is refused.
 */
const CURRENT_EVENTS_ENDPOINT = "https://en.wikipedia.org/w/api.php"

/**
 * Days walked back before giving up. Today's page fills in as the day goes on,
 * and the portal files only a handful of lines under a given heading, so a
 * filtered desk needs a few days to add up to a feed. The walk stops as soon
 * as there are enough stories.
 */
const CURRENT_EVENTS_DAYS = 8

/** Enough headlines to be worth scrolling; below it, another day is pulled in. */
const CURRENT_EVENTS_MIN = 12

function portalPage(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })
  return `Portal:Current events/${date.getUTCFullYear()} ${month} ${date.getUTCDate()}`
}

function absoluteWikiUrl(href: string | null | undefined): string | undefined {
  return href?.startsWith("/wiki/") ? `https://en.wikipedia.org${href}` : undefined
}

/**
 * Walks one day's list. The portal nests stories under the conflict or event
 * they belong to, so only leaf items are stories: the ones above them are
 * context headings that carry no citation of their own.
 */
function collectStories(
  list: Element,
  topic: string,
  publishedAt: number,
  into: NewsArticle[]
): void {
  for (const item of list.children) {
    if (item.tagName !== "LI") continue

    const nested = item.querySelector(":scope > ul")
    if (nested) {
      collectStories(nested, topic, publishedAt, into)
      continue
    }

    // The citation at the end of the line: its text is the outlet's name.
    const citation = item.querySelector("a.external")
    const url = citation?.getAttribute("href")
    if (!citation || !url?.startsWith("https://")) continue

    const withoutCitations = item.cloneNode(true) as Element
    for (const link of withoutCitations.querySelectorAll("a.external")) link.remove()
    const title = (withoutCitations.textContent ?? "")
      .replace(/\s+/g, " ")
      // The brackets the removed citation left behind: "…air base. ()".
      .replace(/\s*\((\s*\))?\s*$/, "")
      .trim()
    if (!title) continue

    const background = absoluteWikiUrl(item.querySelector("a[href^='/wiki/']")?.getAttribute("href"))

    into.push({
      id: `wiki-${url}`,
      title,
      url,
      // Cited as "(Reuters)", "(AFP via France 24)": the brackets are the
      // portal's punctuation, not part of the outlet's name.
      source: citation.textContent?.replace(/^\(|\)$/g, "").trim() || hostnameOf(url),
      publishedAt,
      facts: [topic],
      secondaryLink: background ? { label: "Background", url: background } : undefined,
    })
  }
}

function parseCurrentEvents(html: string, publishedAt: number): NewsArticle[] {
  const articles: NewsArticle[] = []
  const doc = new DOMParser().parseFromString(html, "text/html")

  // Scoped to the content block, which keeps the page's own edit/history links
  // out of the way: they are external links too.
  for (const section of doc.querySelectorAll(".current-events-content")) {
    // Each topic is a bold paragraph ("Business and economy") followed by the
    // list of that topic's stories.
    let topic = "In the news"
    for (const child of section.children) {
      if (child.tagName === "P") {
        topic = child.textContent?.trim() || topic
      } else if (child.tagName === "UL") {
        collectStories(child, topic, publishedAt, articles)
      }
    }
  }

  return articles
}

/**
 * One day's stories, parsed once and shared by every tab that asks for it: the
 * eight-day walk would otherwise re-read the same pages on each new tab.
 *
 * Deliberately not given an abort signal: the day belongs to whoever asks for
 * it next, so leaving a tab must not cancel a page another tab is waiting on.
 * `useNews` drops the results of a request it no longer wants.
 */
const currentEventsDays = new Map<string, Promise<NewsArticle[]>>()

function currentEventsDay(date: Date): Promise<NewsArticle[]> {
  const page = portalPage(date)
  const cached = currentEventsDays.get(page)
  if (cached) return cached

  const url = new URL(CURRENT_EVENTS_ENDPOINT)
  url.searchParams.set("action", "parse")
  url.searchParams.set("page", page)
  url.searchParams.set("prop", "text")
  url.searchParams.set("format", "json")
  url.searchParams.set("formatversion", "2")
  // Anonymous cross-origin access to the MediaWiki API.
  url.searchParams.set("origin", "*")

  const pending = fetchJson<{ parse?: { text: string } }>(url, new AbortController().signal)
    .then((data) => {
      // Today's page may not exist yet just after midnight UTC.
      if (!data.parse) return []
      // Noon UTC: the portal dates a day, not a minute, and this keeps
      // "today" reading as today in every timezone.
      const publishedAt = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        12
      )
      return parseCurrentEvents(data.parse.text, publishedAt)
    })
    .catch((error: unknown) => {
      // A failed day is not remembered, so the next tab retries it.
      currentEventsDays.delete(page)
      throw error
    })

  currentEventsDays.set(page, pending)
  return pending
}

/** `topics` is `null` for the unfiltered feed, or the portal headings to keep. */
async function fetchCurrentEvents(topics: string[] | null): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = []
  const seen = new Set<string>()
  let failure: unknown = null

  for (let daysBack = 0; daysBack < CURRENT_EVENTS_DAYS; daysBack++) {
    const date = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

    let day: NewsArticle[]
    try {
      day = await currentEventsDay(date)
    } catch (error) {
      // One bad day doesn't sink the feed: the walk carries on and only
      // reports the failure if no day at all came back.
      failure ??= error
      continue
    }

    for (const article of day) {
      // The topic a story was filed under travels with it as its first fact.
      if (topics && !topics.includes(article.facts?.[0] ?? "")) continue
      if (seen.has(article.url)) continue
      seen.add(article.url)
      articles.push(article)
    }

    if (articles.length >= CURRENT_EVENTS_MIN) break
  }

  if (articles.length === 0 && failure) throw failure

  return articles.slice(0, PAGE_SIZE)
}

// ------------------------------------------------------------ Hacker News

type HackerNewsHit = {
  objectID: string
  title: string
  url: string | null
  author: string
  points: number
  num_comments: number
  created_at_i: number
}

async function fetchHackerNews(signal: AbortSignal): Promise<NewsArticle[]> {
  const url = new URL("https://hn.algolia.com/api/v1/search")
  url.searchParams.set("tags", "front_page")
  url.searchParams.set("hitsPerPage", String(PAGE_SIZE))

  const data = await fetchJson<{ hits: HackerNewsHit[] }>(url, signal)

  return data.hits
    .filter((hit) => hit.title)
    .map((hit) => {
      const thread = `https://news.ycombinator.com/item?id=${hit.objectID}`
      return {
        id: `hn-${hit.objectID}`,
        title: hit.title,
        // Ask HN and job posts carry no link of their own: the thread is the story.
        url: hit.url ?? thread,
        source: hit.url ? hostnameOf(hit.url) : "Hacker News",
        publishedAt: hit.created_at_i * 1000,
        author: hit.author,
        facts: [`${hit.points} points`, `${hit.num_comments} comments`],
        secondaryLink: hit.url ? { label: "Discussion", url: thread } : undefined,
      }
    })
}

// -------------------------------------------------------------- Spaceflight

type SpaceflightArticle = {
  id: number
  title: string
  url: string
  summary: string
  image_url: string | null
  news_site: string
  published_at: string
  authors: { name: string }[]
}

async function fetchSpaceflight(signal: AbortSignal): Promise<NewsArticle[]> {
  const url = new URL("https://api.spaceflightnewsapi.net/v4/articles/")
  url.searchParams.set("limit", String(PAGE_SIZE))
  url.searchParams.set("ordering", "-published_at")

  const data = await fetchJson<{ results: SpaceflightArticle[] }>(url, signal)

  return data.results.map((article) => ({
    id: `space-${article.id}`,
    title: article.title,
    url: article.url,
    source: article.news_site,
    publishedAt: Date.parse(article.published_at),
    summary: article.summary || undefined,
    imageUrl: article.image_url ?? undefined,
    author: article.authors[0]?.name,
  }))
}

// --------------------------------------------------------------------- DEV

type DevArticle = {
  id: number
  title: string
  url: string
  description: string
  cover_image: string | null
  published_at: string
  reading_time_minutes: number
  public_reactions_count: number
  tag_list: string[]
  user: { name: string }
}

async function fetchDev(signal: AbortSignal): Promise<NewsArticle[]> {
  const url = new URL("https://dev.to/api/articles")
  url.searchParams.set("per_page", String(PAGE_SIZE))
  // The best of the last two days, rather than whatever was posted last minute.
  url.searchParams.set("top", "2")

  const data = await fetchJson<DevArticle[]>(url, signal)

  return data.map((article) => ({
    id: `dev-${article.id}`,
    title: decodeEntities(article.title),
    url: article.url,
    source: "DEV",
    publishedAt: Date.parse(article.published_at),
    summary: article.description ? decodeEntities(article.description) : undefined,
    // Only a real cover: DEV's fallback social image is a generated card with
    // the title printed on it, which would repeat the headline underneath.
    imageUrl: article.cover_image ?? undefined,
    author: article.user.name,
    facts: [
      `${article.reading_time_minutes} min read`,
      `${article.public_reactions_count} reactions`,
      ...article.tag_list.slice(0, 3).map((tag) => `#${tag}`),
    ],
  }))
}

// ------------------------------------------------------------------ Desks

/** A desk read from the publishers' own feeds: credits and hosts come with it. */
function newsroomDesk(
  id: NewsCategory["id"],
  label: string,
  feeds: (typeof FEEDS)[string]
): NewsCategory {
  return {
    id,
    label,
    attribution: feedCredits(feeds),
    origins: originsOf(feeds),
    fetch: fetchFeeds(feeds),
  }
}

const PORTAL_CREDIT = "Wikipedia's current events portal"

/**
 * Every desk is free and key-less. Most are read straight from the
 * publishers' RSS feeds, which is what puts real newsroom copy and pictures on
 * the cards; the rest answer a cross-origin request unasked and so keep
 * working whatever the browser has been told about host access.
 */
export const NEWS_CATEGORIES: NewsCategory[] = [
  newsroomDesk("world", "World", FEEDS.world),
  {
    id: "geopolitics",
    label: "Geopolitics",
    attribution: PORTAL_CREDIT,
    origins: [],
    fetch: () =>
      fetchCurrentEvents([
        "International relations",
        "Politics and elections",
        "Armed conflicts and attacks",
      ]),
  },
  newsroomDesk("business", "Business", FEEDS.business),
  newsroomDesk("science", "Science", FEEDS.science),
  newsroomDesk("sports", "Sports", FEEDS.sports),
  newsroomDesk("tech", "Tech", FEEDS.tech),
  newsroomDesk("gaming", "Gaming", FEEDS.gaming),
  newsroomDesk("screen", "Film & TV", FEEDS.screen),
  newsroomDesk("music", "Music", FEEDS.music),
  newsroomDesk("open-source", "Open source", FEEDS.openSource),
  newsroomDesk("energy", "Energy", FEEDS.energy),
  {
    id: "space",
    label: "Space",
    attribution: `${feedCredits(FEEDS.space)}, Spaceflight News API`,
    origins: originsOf(FEEDS.space),
    fetch: combine(fetchFeeds(FEEDS.space), fetchSpaceflight),
  },
  {
    id: "dev",
    label: "Dev",
    attribution: "DEV Community",
    origins: [],
    fetch: fetchDev,
  },
  // Headlines only (the front page ships no pictures), so it sits apart from
  // Tech rather than in it, off unless someone asks for it.
  {
    id: "hn",
    label: "Hacker News",
    attribution: "Hacker News front page",
    origins: [],
    fetch: fetchHackerNews,
  },
]

/**
 * A desk someone built, dressed as the feed machinery expects. Assembled on
 * demand rather than stored: the desk is the list of feeds, and everything
 * else about it (its credits, the hosts it needs, how it is fetched) follows
 * from that list and would only be another copy to keep in step.
 */
export function customNewsCategory(desk: CustomDesk): NewsCategory {
  const feeds = desk.feeds.map(({ url, source }) => ({ url, source }))

  return {
    id: desk.id,
    label: desk.label,
    attribution: feeds.length > 0 ? feedCredits(feeds) : "No feeds on this desk yet",
    origins: originsOf(feeds),
    fetch: fetchFeeds(feeds),
  }
}

export function newsCategory(id: NewsCategoryId): NewsCategory {
  const builtIn = NEWS_CATEGORIES.find((category) => category.id === id)
  if (builtIn) return builtIn

  const desk = customDesk(id)
  if (desk) return customNewsCategory(desk)

  // A desk named by a stale setting or an imported file and since deleted.
  // Callers filter these out before loading; the fallback only keeps the
  // return type honest.
  return NEWS_CATEGORIES[0]
}

/**
 * Every desk id there is, in the order tabs should appear: the built-in ones
 * as declared above, then custom desks in the order they were made.
 */
export function orderedCategoryIds(): NewsCategoryId[] {
  return [
    ...NEWS_CATEGORIES.map((category) => category.id),
    ...useCustomFeedsStore.getState().desks.map((desk) => desk.id),
  ]
}

/** The hosts these desks read, for the one prompt that covers all of them. */
export function originsFor(ids: NewsCategoryId[]): string[] {
  return [...new Set(ids.flatMap((id) => newsCategory(id).origins))]
}
