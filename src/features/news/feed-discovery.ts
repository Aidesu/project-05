import { normalizeFeedUrl } from "@/lib/url"

import { NewsApiError } from "./errors"
import { parseFeed, parseFeedTitle } from "./feed-parser"
import { hasHostAccess } from "./host-access"
import { feedRequestUrl, isTimeout, withDeadline } from "./news-feeds"
import type { NewsArticle } from "./types"

/**
 * A feed found and read, ready to be shown before it is saved. Nothing is
 * added on the strength of its address alone: what the dialog puts in front of
 * someone is what the feed actually returned a second ago.
 */
export type FeedCandidate = {
  /** The feed's address, which is often not the one that was typed. */
  url: string
  title: string
  articles: NewsArticle[]
}

/**
 * A feed was found, but on a host the extension may not read yet: the usual
 * shape of a site whose feed lives on `feeds.` or a hosting provider. Carries
 * the host so the dialog can offer that one permission rather than give up.
 */
export class FeedAccessError extends NewsApiError {
  constructor(readonly hostname: string) {
    super(`Allow ${hostname} to read its feed.`)
  }
}

/** Where feeds live when a page doesn't declare one. Ordered by how often. */
const CANDIDATE_PATHS = [
  "/feed",
  "/rss",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feeds/posts/default",
]

/** How many headlines the preview shows before anything is saved. */
const PREVIEW_ARTICLES = 4

export function originPatternOf(url: string): string {
  return `https://${new URL(url).hostname}/*`
}

/**
 * Reads one address, refusing to go near the network without the host access
 * the browser requires for it. The `FeedAccessError` is the useful half: it
 * names a host the caller can ask permission for and try again.
 */
async function read(url: string, signal: AbortSignal): Promise<string> {
  const { hostname } = new URL(url)
  if (!(await hasHostAccess([originPatternOf(url)]))) throw new FeedAccessError(hostname)

  let response: Response
  try {
    response = await fetch(feedRequestUrl(url), { signal: withDeadline(signal) })
  } catch (error) {
    if (isTimeout(error)) throw new NewsApiError(`${hostname} took too long to answer.`)
    throw error
  }

  if (!response.ok) {
    throw new NewsApiError(
      response.status === 404
        ? "Nothing at that address."
        : `${hostname} answered ${response.status}.`
    )
  }
  return response.text()
}

/** The body as a feed, or `undefined` if it is anything else. */
function asFeed(url: string, body: string): FeedCandidate | undefined {
  const { hostname } = new URL(url)
  const articles = parseFeed(body, { source: hostname, url })
  if (articles.length === 0) return undefined

  const title = parseFeedTitle(body) ?? hostname
  // The feed's own name is what the cards will be credited to, so the articles
  // are re-stamped with it now rather than carrying the hostname around.
  return {
    url,
    title,
    articles: articles.map((article) => ({ ...article, source: title })),
  }
}

/**
 * Feeds that exist but are almost never the one someone meant: a comment
 * firehose, or the MP3 enclosures of a podcast. Matched on the address and the
 * title a page gives them.
 */
const SIDE_FEEDS = /comment|podcast|\/mp3|\bmp3\b|itunes|\/author\/|\/tag\/|\/category\//i

/**
 * The feeds an HTML page declares in its head: the way a site is *meant* to
 * be found, and the reason pasting "theverge.com" is enough.
 *
 * Split rather than merely listed, because a declared feed is not always the
 * right one: Next declares its podcast and nothing else, so taking the first
 * would file a podcast under a news desk while `/feed` sat there working. The
 * side feeds are kept, only demoted below the guessed paths, so a site that
 * genuinely has nothing else still resolves to something.
 */
function declaredFeeds(html: string, base: string): { wanted: string[]; sideline: string[] } {
  const document = new DOMParser().parseFromString(html, "text/html")
  const wanted = new Set<string>()
  const sideline = new Set<string>()

  for (const link of document.querySelectorAll("link[rel~='alternate'][href]")) {
    const type = link.getAttribute("type") ?? ""
    if (!/^application\/(rss|atom)\+xml$/i.test(type.trim())) continue

    const href = link.getAttribute("href")
    if (!href) continue

    try {
      const resolved = new URL(href, base)
      if (resolved.protocol !== "https:") continue
      const title = link.getAttribute("title") ?? ""
      const side = SIDE_FEEDS.test(resolved.pathname) || SIDE_FEEDS.test(title)
      ;(side ? sideline : wanted).add(resolved.toString())
    } catch {
      // A malformed href in someone's `<head>` is not worth a failure.
    }
  }

  return { wanted: [...wanted], sideline: [...sideline] }
}

/**
 * Turns whatever someone pasted into a feed they can see before they keep it.
 *
 * Three passes, cheapest first: the address itself, then any feed the page
 * declares, then the handful of paths feeds conventionally sit at. A site that
 * declares its feed is believed, if that feed is on a host we may not read,
 * the access error is surfaced rather than swallowed, because asking for that
 * one host is exactly the right next step.
 */
export async function discoverFeed(input: string, signal: AbortSignal): Promise<FeedCandidate> {
  const start = normalizeFeedUrl(input)
  if (!start) throw new NewsApiError("That doesn't look like an https web address.")

  const body = await read(start, signal)

  const direct = asFeed(start, body)
  if (direct) return direct

  const declared = declaredFeeds(body, start)
  const origin = new URL(start).origin
  const guesses = CANDIDATE_PATHS.map((path) => new URL(path, origin).toString())

  for (const address of [...declared.wanted, ...guesses, ...declared.sideline]) {
    try {
      const candidate = asFeed(address, await read(address, signal))
      if (candidate) return candidate
    } catch (error) {
      // A page pointing at a host we may not read is an answer, not a dead
      // end: it goes back to the caller, who can ask for that one host.
      if (error instanceof FeedAccessError) throw error
      if (signal.aborted) throw error
    }
  }

  throw new NewsApiError("No feed found there. Try the feed's own address.")
}

/** The few headlines worth showing as proof the feed works. */
export function previewOf(candidate: FeedCandidate): NewsArticle[] {
  return candidate.articles.slice(0, PREVIEW_ARTICLES)
}
