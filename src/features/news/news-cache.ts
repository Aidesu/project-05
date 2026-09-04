import type { NewsArticle, NewsCategoryId } from "./types"

const KEY = "mainboard.news.cache"

/**
 * How long a category's headlines are reused before hitting the network again.
 * A new tab is opened dozens of times a day; without this, every one of them
 * would be a fresh request to a free API for headlines that barely moved.
 */
const TTL_MS = 20 * 60 * 1000

type CacheEntry = { fetchedAt: number; articles: NewsArticle[] }
type Cache = Partial<Record<NewsCategoryId, CacheEntry>>

function read(): Cache {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Cache) : {}
  } catch {
    return {}
  }
}

/**
 * The cached headlines for a category, or `null` once they've gone stale.
 * `allowStale` ignores the age: yesterday's headlines beat an error message
 * when the network or the API is having a bad minute.
 */
export function readCachedNews(
  category: NewsCategoryId,
  options?: { allowStale?: boolean }
): NewsArticle[] | null {
  const entry = read()[category]
  if (!entry) return null
  if (!options?.allowStale && Date.now() - entry.fetchedAt > TTL_MS) return null
  return entry.articles
}

export function writeCachedNews(category: NewsCategoryId, articles: NewsArticle[]) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...read(), [category]: { fetchedAt: Date.now(), articles } })
    )
  } catch {
    // A full quota costs a cache hit, never the feed itself.
  }
}
