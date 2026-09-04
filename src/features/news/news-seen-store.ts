import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Opened stories remembered before the oldest start being forgotten. */
const LIMIT = 500

/** What a prune keeps, so it happens once every 150 stories rather than daily. */
const KEEP = 350

type NewsSeenState = {
  /** Story URL → when it was opened. Keyed by URL, not by article id, so a
   * story that shows up under two categories is marked in both. */
  seen: Record<string, number>
  markSeen: (url: string) => void
}

export const useNewsSeenStore = create<NewsSeenState>()(
  persist(
    (set) => ({
      seen: {},

      markSeen: (url) =>
        set((state) => {
          if (state.seen[url]) return state

          const seen = { ...state.seen, [url]: Date.now() }
          const entries = Object.entries(seen)
          if (entries.length <= LIMIT) return { seen }

          // A feed only moves forward: the stories opened longest ago are the
          // ones no longer in any of it.
          return {
            seen: Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, KEEP)),
          }
        }),
    }),
    {
      name: "mainboard.news.seen",
      version: 1,
    }
  )
)
