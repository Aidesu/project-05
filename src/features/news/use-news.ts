import { useCallback, useEffect, useRef, useState } from "react"

import { isSafeHttpUrl } from "@/lib/url"

import { NewsAccessError, NewsApiError } from "./errors"
import { readCachedNews, writeCachedNews } from "./news-cache"
import { newsCategory } from "./news-sources"
import type { NewsArticle, NewsCategoryId } from "./types"

type NewsResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; articles: NewsArticle[] }
  /** `needsAccess` marks the one failure the feed can offer to fix, rather
   * than only retry: the desk's publishers have not been granted. */
  | { status: "error"; message: string; needsAccess: boolean }

/** Ceiling on a merged feed: "All" with every category on would otherwise put
 * a couple of hundred cards in the grid for no one to ever scroll to. */
const MERGED_LIMIT = 60

/**
 * Newest first, one card per story however many categories carried it.
 *
 * Every link here is a string a remote API handed us, and it ends up in an
 * `href` the user clicks, so this is where an address that isn't plain
 * http(s) is dropped: the one gate both the fresh and the cached path pass
 * through, cache entries written by an older build included.
 */
function mergeArticles(lists: NewsArticle[][]): NewsArticle[] {
  const seen = new Set<string>()
  const merged: NewsArticle[] = []

  for (const article of lists.flat()) {
    if (seen.has(article.url) || !isSafeHttpUrl(article.url)) continue
    seen.add(article.url)

    const secondaryLink =
      article.secondaryLink && isSafeHttpUrl(article.secondaryLink.url)
        ? article.secondaryLink
        : undefined
    merged.push(secondaryLink === article.secondaryLink ? article : { ...article, secondaryLink })
  }

  return merged.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, MERGED_LIMIT)
}

/**
 * Headlines for one category, or for several merged together ("All"). Each
 * category is served from the shared cache while it is fresh, so switching
 * tabs (or opening a new tab) usually costs no request at all.
 *
 * `categories` must be a stable array (memoised by the caller); it is empty
 * when there is nothing to load: the feed is off, or every category has been
 * switched off in settings.
 */
export function useNews(categories: NewsCategoryId[]) {
  const [result, setResult] = useState<NewsResult>({ status: "idle" })
  // Guards against a slow response for the tab the user just left.
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const load = useCallback(
    async (options?: { force?: boolean }) => {
      const id = ++requestId.current
      const commit = (next: NewsResult) => {
        if (requestId.current === id) setResult(next)
      }

      controller.current?.abort()
      if (categories.length === 0) {
        commit({ status: "idle" })
        return
      }

      const cached = categories.map((category) =>
        options?.force ? null : readCachedNews(category)
      )
      if (cached.every((articles) => articles !== null)) {
        commit({ status: "ready", articles: mergeArticles(cached as NewsArticle[][]) })
        return
      }

      const abort = new AbortController()
      controller.current = abort
      commit({ status: "loading" })

      const settled = await Promise.allSettled(
        categories.map(async (category, index) => {
          const hit = cached[index]
          if (hit) return hit

          const articles = await newsCategory(category).fetch(abort.signal)
          writeCachedNews(category, articles)
          return articles
        })
      )
      if (abort.signal.aborted) return

      const lists = settled.flatMap((outcome, index) => {
        if (outcome.status === "fulfilled") return [outcome.value]

        // Better the headlines from an hour ago than a gap where a category
        // should be: a rate limit or a flaky connection shouldn't empty it.
        const stale = readCachedNews(categories[index], { allowStale: true })
        return stale ? [stale] : []
      })

      if (lists.length > 0) {
        commit({ status: "ready", articles: mergeArticles(lists) })
        return
      }

      const failure = settled.find((outcome) => outcome.status === "rejected")
      const error = failure?.status === "rejected" ? failure.reason : null
      commit({
        status: "error",
        message:
          error instanceof NewsApiError ? error.message : "Couldn't load the news right now.",
        needsAccess: error instanceof NewsAccessError,
      })
    },
    [categories]
  )

  useEffect(() => {
    void load()
    return () => controller.current?.abort()
  }, [load])

  // Stable for as long as the category list is, so an effect elsewhere can
  // depend on it: granting host access reloads through exactly this.
  const refresh = useCallback(() => void load({ force: true }), [load])

  return { ...result, refresh }
}
