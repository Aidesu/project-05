import { create } from "zustand"
import { persist } from "zustand/middleware"

import { normalizeFeedUrl } from "@/lib/url"

import { forgetCachedNews } from "./news-cache"
import type { CustomCategoryId, CustomDesk, CustomFeed } from "./types"

export type DeskResult = { ok: true; desk: CustomDesk } | { ok: false; error: string }
export type FeedResult = { ok: true; feed: CustomFeed } | { ok: false; error: string }

/**
 * Ceilings, not opinions: every desk on screen is a tab, every feed in it is a
 * request when that tab opens, and the whole lot is cached in `localStorage`
 * alongside the built-in desks.
 */
const MAX_DESKS = 12
const MAX_FEEDS_PER_DESK = 20
const MAX_LABEL_LENGTH = 32

function cleanLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").slice(0, MAX_LABEL_LENGTH)
}

type CustomFeedsState = {
  desks: CustomDesk[]
  addDesk: (label: string) => DeskResult
  renameDesk: (id: CustomCategoryId, label: string) => void
  /** Also drops the desk's cached headlines: nothing left to serve them to. */
  removeDesk: (id: CustomCategoryId) => void
  addFeed: (deskId: CustomCategoryId, draft: { url: string; source: string }) => FeedResult
  removeFeed: (deskId: CustomCategoryId, feedId: string) => void
  /** Wholesale replacement from an imported config file (`@/features/config`). */
  importConfig: (desks: CustomDesk[]) => void
}

/** Everything a desk needs, minted here so a file can never dictate an id. */
function makeDesk(label: string): CustomDesk {
  return { id: `custom:${crypto.randomUUID()}`, label, feeds: [] }
}

/**
 * The desks someone built for themselves, kept apart from `news-store` so that
 * `news-sources` can read them without the two importing each other: the
 * sources module resolves a `custom:` id through this store, and the store
 * knows nothing about sources.
 */
export const useCustomFeedsStore = create<CustomFeedsState>()(
  persist(
    (set, get) => ({
      desks: [],

      addDesk: (label) => {
        const clean = cleanLabel(label)
        if (!clean) return { ok: false, error: "Give the desk a name." }
        if (get().desks.length >= MAX_DESKS) {
          return { ok: false, error: `That's the limit of ${MAX_DESKS} desks.` }
        }
        if (get().desks.some((desk) => desk.label.toLowerCase() === clean.toLowerCase())) {
          return { ok: false, error: "You already have a desk by that name." }
        }

        const desk = makeDesk(clean)
        set((state) => ({ desks: [...state.desks, desk] }))
        return { ok: true, desk }
      },

      renameDesk: (id, label) => {
        const clean = cleanLabel(label)
        if (!clean) return
        set((state) => ({
          desks: state.desks.map((desk) => (desk.id === id ? { ...desk, label: clean } : desk)),
        }))
      },

      removeDesk: (id) => {
        forgetCachedNews(id)
        set((state) => ({ desks: state.desks.filter((desk) => desk.id !== id) }))
      },

      addFeed: (deskId, draft) => {
        const url = normalizeFeedUrl(draft.url)
        if (!url) return { ok: false, error: "Needs a valid https address." }

        const desk = get().desks.find((candidate) => candidate.id === deskId)
        if (!desk) return { ok: false, error: "That desk no longer exists." }
        if (desk.feeds.length >= MAX_FEEDS_PER_DESK) {
          return { ok: false, error: `That's the limit of ${MAX_FEEDS_PER_DESK} feeds per desk.` }
        }
        if (desk.feeds.some((feed) => feed.url === url)) {
          return { ok: false, error: "That feed is already on this desk." }
        }

        const feed: CustomFeed = {
          id: crypto.randomUUID(),
          url,
          source: cleanLabel(draft.source) || new URL(url).hostname,
        }
        // The desk's headlines were built without this feed in them.
        forgetCachedNews(deskId)
        set((state) => ({
          desks: state.desks.map((candidate) =>
            candidate.id === deskId
              ? { ...candidate, feeds: [...candidate.feeds, feed] }
              : candidate
          ),
        }))
        return { ok: true, feed }
      },

      removeFeed: (deskId, feedId) => {
        forgetCachedNews(deskId)
        set((state) => ({
          desks: state.desks.map((desk) =>
            desk.id === deskId
              ? { ...desk, feeds: desk.feeds.filter((feed) => feed.id !== feedId) }
              : desk
          ),
        }))
      },

      importConfig: (desks) => {
        for (const desk of get().desks) forgetCachedNews(desk.id)
        set({ desks })
      },
    }),
    {
      name: "mainboard.news.custom",
      version: 1,
    }
  )
)

/** The desk a `custom:` id names, for the non-React lookup in `news-sources`. */
export function customDesk(id: string): CustomDesk | undefined {
  return useCustomFeedsStore.getState().desks.find((desk) => desk.id === id)
}
