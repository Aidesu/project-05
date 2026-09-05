import { NewsAccessError, NewsApiError } from "./errors"
import { originsOf, type Feed } from "./feed-catalog"
import { parseFeed } from "./feed-parser"
import { hasHostAccess } from "./host-access"
import type { NewsArticle } from "./types"

/** Plenty to scroll through, small enough to keep in `localStorage`. */
export const PAGE_SIZE = 30

/**
 * The publisher's own address, which is what host access makes reachable.
 * The exception is `npm run dev`, where there is no extension to hold that access
 * and the dev server reads the feed instead (`feedProxy` in the Vite config).
 * Vite folds the constant at build time, so the branch never ships.
 */
export function feedRequestUrl(url: string): string {
  return import.meta.env.DEV ? `/__feed?url=${encodeURIComponent(url)}` : url
}

async function fetchFeed(feed: Feed, signal: AbortSignal): Promise<NewsArticle[]> {
  const response = await fetch(feedRequestUrl(feed.url), { signal })
  if (!response.ok) {
    throw new NewsApiError(
      response.status === 429 || response.status === 503
        ? `${feed.source} is busy right now. Try again in a minute.`
        : `${feed.source} is unavailable right now.`
    )
  }
  return parseFeed(await response.text(), feed)
}

/**
 * A desk's feeds, merged newest-first.
 *
 * Read straight from the publishers rather than through an API in the middle:
 * no key, no quota, nobody between the reader and the newsroom, and the same
 * feed the outlet's own app reads. The cost is host access, which the browser
 * requires for a cross-origin read and which the feed asks for when a desk
 * that needs it is first opened.
 */
export function fetchFeeds(feeds: Feed[]) {
  const origins = originsOf(feeds)

  return async (signal: AbortSignal): Promise<NewsArticle[]> => {
    if (!(await hasHostAccess(origins))) throw new NewsAccessError()

    const results = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed, signal)))

    // Wire syndication puts the same story on two of a desk's feeds often
    // enough to be worth collapsing before the slice spends a slot on it.
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
    articles.sort((a, b) => b.publishedAt - a.publishedAt)

    // One newsroom being down is a thinner feed, not a broken one; all of them
    // being down is worth reporting.
    if (articles.length === 0) {
      const failure = results.find((result) => result.status === "rejected")
      if (failure?.status === "rejected") throw failure.reason
    }

    return articles.slice(0, PAGE_SIZE)
  }
}

/** The publishers behind a desk, for the credit line under the feed. */
export function feedCredits(feeds: Feed[]): string {
  return [...new Set(feeds.map((feed) => feed.source))].join(", ")
}
