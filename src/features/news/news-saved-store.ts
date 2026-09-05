import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { NewsArticle } from "./types"

/**
 * Stories kept before the oldest are dropped. Each carries a full copy of the
 * article rather than a reference, which is the whole point: a feed moves on
 * within hours, and a saved story has to survive the moment its own newsroom
 * stops listing it.
 */
const LIMIT = 200

export type SavedArticle = NewsArticle & { savedAt: number }

type NewsSavedState = {
  /** Newest save first, which is the order the tab reads in. */
  articles: SavedArticle[]
  /** Returns whether the story is saved *after* the toggle. */
  toggle: (article: NewsArticle) => boolean
  remove: (url: string) => void
}

/**
 * Saved stories, keyed by URL like `news-seen-store` and for the same reason:
 * the same story carries a different id under each category that lists it, so
 * only the address identifies it across the feed.
 */
export const useNewsSavedStore = create<NewsSavedState>()(
  persist(
    (set, get) => ({
      articles: [],

      toggle: (article) => {
        const kept = get().articles.filter((saved) => saved.url !== article.url)
        if (kept.length !== get().articles.length) {
          set({ articles: kept })
          return false
        }

        set({ articles: [{ ...article, savedAt: Date.now() }, ...kept].slice(0, LIMIT) })
        return true
      },

      remove: (url) =>
        set((state) => ({ articles: state.articles.filter((saved) => saved.url !== url) })),
    }),
    {
      name: "mainboard.news.saved",
      version: 1,
    }
  )
)

/** Whether one story is saved, as a selector cheap enough for every card. */
export function selectIsSaved(url: string) {
  return (state: NewsSavedState) => state.articles.some((saved) => saved.url === url)
}
