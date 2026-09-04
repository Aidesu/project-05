import { create } from "zustand"
import { persist } from "zustand/middleware"

import { NEWS_CATEGORIES } from "./news-sources"
import type { NewsCategoryId } from "./types"

/**
 * The "All" tab: every chosen category merged into one feed. Not a category
 * id — no source answers to it — so it can never collide with one.
 */
export const ALL_CATEGORIES = "__all__"

export type NewsTab = NewsCategoryId | typeof ALL_CATEGORIES

/** The persisted half of the store: what a config file carries. */
export type NewsConfig = {
  /** Whether the feed is shown at all. */
  enabled: boolean
  /** Which category tabs appear, kept in the order they're declared. */
  categories: NewsCategoryId[]
  /** The tab the feed opens on. A category dropped in settings is ignored
   * rather than corrected here — the feed falls back to the first one left. */
  activeCategory: NewsTab
}

type NewsState = NewsConfig & {
  setEnabled: (enabled: boolean) => void
  toggleCategory: (id: NewsCategoryId) => void
  setActiveCategory: (id: NewsTab) => void
  /** Wholesale replacement from an imported config file (`@/features/config`). */
  importConfig: (config: NewsConfig) => void
}

const DEFAULT_CATEGORIES: NewsCategoryId[] = ["world", "tech", "space"]

export const useNewsStore = create<NewsState>()(
  persist(
    (set) => ({
      enabled: false,
      categories: DEFAULT_CATEGORIES,
      activeCategory: "world",

      setEnabled: (enabled) => set({ enabled }),
      setActiveCategory: (activeCategory) => set({ activeCategory }),

      toggleCategory: (id) =>
        set((state) => {
          const next = new Set(state.categories)
          if (!next.delete(id)) next.add(id)
          // Rebuilt from the canonical list, so tabs never reshuffle as they
          // are switched on and off.
          return {
            categories: NEWS_CATEGORIES.filter((category) => next.has(category.id)).map(
              (category) => category.id
            ),
          }
        }),

      importConfig: (config) => set(config),
    }),
    {
      name: "mainboard.news",
      version: 1,
    }
  )
)
