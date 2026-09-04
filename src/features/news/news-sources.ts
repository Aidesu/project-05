import { hostnameOf } from "@/lib/url"

import type { NewsArticle, NewsCategory } from "./types"

/** Thrown for failures worth showing verbatim in the feed (vs. a generic fallback). */
export class NewsApiError extends Error {}

/** Plenty to scroll through, small enough to keep in `localStorage`. */
const PAGE_SIZE = 30

async function fetchJson<T>(url: URL, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    // 429/503 is a free API asking to be left alone for a moment, which is
    // worth saying plainly — retrying immediately would only dig deeper.
    throw new NewsApiError(
      response.status === 429 || response.status === 503
        ? "The news service is busy right now — try again in a minute."
        : "The news service is unavailable right now."
    )
  }
  return (await response.json()) as T
}

// ------------------------------------------------- Wikipedia current events

/**
 * Wikipedia's Current events portal: one page per day, written by editors, in
 * which every line cites the outlet it came from (Reuters, the BBC, AP…). It
 * is the only general-news source that is free, needs no key *and* answers
 * cross-origin requests — RSS feeds and the news APIs do neither, and a proxy
 * would mean running a backend.
 */
const CURRENT_EVENTS_ENDPOINT = "https://en.wikipedia.org/w/api.php"

/**
 * Days walked back before giving up. Today's page fills in as the day goes on,
 * and a narrow topic ("Arts and culture") can be a line or two a day, so a
 * filtered category needs a week or so to add up to a feed. The walk stops as
 * soon as there are enough stories — day one, for the unfiltered feed — and
 * the days it does read are shared with every other portal category.
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
 * they belong to, so only leaf items are stories — the ones above them are
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
      // Cited as "(Reuters)", "(AFP via France 24)" — the brackets are the
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
  // out of the way — they are external links too.
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
 * One day's stories, parsed once and shared by every category cut from the
 * portal. Half a dozen topic feeds asking for the same five pages would be
 * thirty requests to an API that answers a burst with 503s.
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

// ------------------------------------------------------------- Newsrooms

type Newsroom = { host: string; label: string }

/**
 * Newsrooms that run WordPress and leave its REST API open with permissive
 * CORS — the only way to get real newsroom copy *with pictures* into the page
 * without a key or a proxy. Every host here was checked from a browser: the
 * ones that refuse the request (Ars Technica, The Verge, Wired, most of the
 * gaming and sports press) simply cannot be read from a page, whatever their
 * RSS feed suggests.
 */
const NEWSROOMS = {
  tech: [
    { host: "techcrunch.com", label: "TechCrunch" },
    { host: "hackaday.com", label: "Hackaday" },
    { host: "9to5mac.com", label: "9to5Mac" },
    { host: "9to5google.com", label: "9to5Google" },
  ],
  gaming: [
    { host: "www.gematsu.com", label: "Gematsu" },
    { host: "nintendoeverything.com", label: "Nintendo Everything" },
    { host: "wccftech.com", label: "Wccftech" },
    { host: "automaton-media.com", label: "Automaton" },
  ],
  screen: [
    { host: "variety.com", label: "Variety" },
    { host: "deadline.com", label: "Deadline" },
  ],
  music: [
    { host: "www.rollingstone.com", label: "Rolling Stone" },
    { host: "www.billboard.com", label: "Billboard" },
    { host: "consequence.net", label: "Consequence" },
  ],
  openSource: [
    { host: "github.blog", label: "The GitHub Blog" },
    { host: "www.omgubuntu.co.uk", label: "OMG! Ubuntu" },
    { host: "blog.mozilla.org", label: "Mozilla" },
  ],
  energy: [{ host: "electrek.co", label: "Electrek" }],
} satisfies Record<string, Newsroom[]>

/** The publishers behind a category, for the credit line under the feed. */
function newsroomCredits(newsrooms: Newsroom[]): string {
  return newsrooms.map((newsroom) => newsroom.label).join(", ")
}

type WordPressPost = {
  id: number
  /** UTC, unlike `date`, which is the site's own timezone with no offset. */
  date_gmt: string
  link: string
  title: { rendered: string }
  excerpt: { rendered: string }
  jetpack_featured_media_url?: string
}

/** Excerpts arrive with their HTML entities still escaped. */
function decodeEntities(text: string): string {
  return new DOMParser().parseFromString(text, "text/html").documentElement.textContent ?? text
}

/** Titles and excerpts come as rendered HTML: tags, entities and all. */
function plainText(html: string): string {
  return decodeEntities(html)
    .replace(/\s+/g, " ")
    // A trimmed WordPress excerpt trails off into the theme's own marker.
    // Each pattern needs the marker at the very end, and the "read more" one
    // needs the ellipsis WordPress puts in front of it, so an excerpt that
    // happens to say "read more" mid-sentence survives intact.
    .replace(/\s*(\[…\]|\[\.\.\.\])\s*$/, "…")
    .replace(/…\s*read more\s*$/i, "…")
    .replace(/\s*continue reading\b[^.!?]*$/i, "…")
    // Where the marker followed a finished sentence, the ellipsis is noise.
    .replace(/([.!?])…$/, "$1")
    .trim()
}

async function fetchNewsroom(
  { host, label }: Newsroom,
  signal: AbortSignal
): Promise<NewsArticle[]> {
  const url = new URL(`https://${host}/wp-json/wp/v2/posts`)
  url.searchParams.set("per_page", "12")
  // Asking for the four fields we use keeps a page of posts at a few kB
  // instead of the ~300 kB a full WordPress payload would be.
  url.searchParams.set(
    "_fields",
    "id,date_gmt,link,title,excerpt,jetpack_featured_media_url"
  )

  const posts = await fetchJson<WordPressPost[]>(url, signal)

  return posts.map((post) => ({
    id: `wp-${host}-${post.id}`,
    title: plainText(post.title.rendered),
    url: post.link,
    source: label,
    publishedAt: Date.parse(`${post.date_gmt}Z`),
    summary: plainText(post.excerpt.rendered) || undefined,
    imageUrl: post.jetpack_featured_media_url || undefined,
  }))
}

function fetchNewsrooms(newsrooms: Newsroom[]) {
  return async (signal: AbortSignal): Promise<NewsArticle[]> => {
    const results = await Promise.allSettled(
      newsrooms.map((newsroom) => fetchNewsroom(newsroom, signal))
    )

    const articles = results
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => b.publishedAt - a.publishedAt)

    // One newsroom being down is a thinner feed, not a broken one; all of them
    // being down is worth reporting.
    if (articles.length === 0) {
      const failure = results.find((result) => result.status === "rejected")
      if (failure?.status === "rejected") throw failure.reason
    }

    return articles.slice(0, PAGE_SIZE)
  }
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

/**
 * Every category is served by a free, key-less API with open CORS, so the feed
 * needs no backend and no credentials to ship inside the extension.
 */
const PORTAL_CREDIT = "Wikipedia's current events portal"

export const NEWS_CATEGORIES: NewsCategory[] = [
  // ---- General news, cut out of the current events portal by its own topics.
  {
    id: "world",
    label: "World",
    attribution: PORTAL_CREDIT,
    fetch: () => fetchCurrentEvents(null),
  },
  {
    id: "geopolitics",
    label: "Geopolitics",
    attribution: PORTAL_CREDIT,
    fetch: () =>
      fetchCurrentEvents([
        "International relations",
        "Politics and elections",
        "Armed conflicts and attacks",
      ]),
  },
  {
    id: "business",
    label: "Business",
    attribution: PORTAL_CREDIT,
    fetch: () => fetchCurrentEvents(["Business and economy"]),
  },
  {
    id: "science",
    label: "Science",
    attribution: PORTAL_CREDIT,
    fetch: () => fetchCurrentEvents(["Science and technology", "Health and environment"]),
  },
  {
    id: "sports",
    label: "Sports",
    attribution: PORTAL_CREDIT,
    fetch: () => fetchCurrentEvents(["Sports"]),
  },
  // ---- Desks with their own newsrooms, pictures and standfirsts.
  {
    id: "tech",
    label: "Tech",
    attribution: newsroomCredits(NEWSROOMS.tech),
    fetch: fetchNewsrooms(NEWSROOMS.tech),
  },
  {
    id: "gaming",
    label: "Gaming",
    attribution: newsroomCredits(NEWSROOMS.gaming),
    fetch: fetchNewsrooms(NEWSROOMS.gaming),
  },
  {
    id: "screen",
    label: "Film & TV",
    attribution: newsroomCredits(NEWSROOMS.screen),
    fetch: fetchNewsrooms(NEWSROOMS.screen),
  },
  {
    id: "music",
    label: "Music",
    attribution: newsroomCredits(NEWSROOMS.music),
    fetch: fetchNewsrooms(NEWSROOMS.music),
  },
  {
    id: "open-source",
    label: "Open source",
    attribution: newsroomCredits(NEWSROOMS.openSource),
    fetch: fetchNewsrooms(NEWSROOMS.openSource),
  },
  {
    id: "energy",
    label: "Energy",
    attribution: newsroomCredits(NEWSROOMS.energy),
    fetch: fetchNewsrooms(NEWSROOMS.energy),
  },

  // ---- Single-API desks.
  {
    id: "space",
    label: "Space",
    attribution: "Spaceflight News API",
    fetch: fetchSpaceflight,
  },
  {
    id: "dev",
    label: "Dev",
    attribution: "DEV Community",
    fetch: fetchDev,
  },
  // Headlines only — no source on the front page ships a picture — so it sits
  // apart from Tech rather than in it, off unless someone asks for it.
  {
    id: "hn",
    label: "Hacker News",
    attribution: "Hacker News front page",
    fetch: fetchHackerNews,
  },
]

export function newsCategory(id: NewsCategory["id"]): NewsCategory {
  // Ids only ever come from this list (or a persisted copy of it), so the
  // fallback is only here to keep the return type honest.
  return NEWS_CATEGORIES.find((category) => category.id === id) ?? NEWS_CATEGORIES[0]
}
