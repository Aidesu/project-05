import { create } from "zustand"
import { persist } from "zustand/middleware"

import { hostnameOf, normalizeUrl } from "@/lib/url"

import type { Site, SiteDraft } from "./types"

export type SiteResult =
  | { ok: true; site: Site }
  | { ok: false; error: string }

type SitesState = {
  sites: Site[]
  addSite: (draft: SiteDraft) => SiteResult
  updateSite: (id: string, draft: SiteDraft) => SiteResult
  removeSite: (id: string) => void
}

/** Trimmed, lower-cased, order-preserving, no duplicates. */
function cleanTags(tags: string[]): string[] {
  const out = new Set<string>()
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase()
    if (clean) out.add(clean)
  }
  return [...out]
}

/**
 * The board's single source of truth: plain CRUD over a list, plus the two
 * invariants that must not live in a component — URL normalisation and
 * deduplication. Search, filtering and sorting are derived at render time.
 */
export const useSitesStore = create<SitesState>()(
  persist(
    (set, get) => ({
      sites: [],

      addSite: (draft) => {
        const url = normalizeUrl(draft.url)
        if (!url) return { ok: false, error: "Adresse invalide." }
        if (get().sites.some((site) => site.url === url)) {
          return { ok: false, error: "Ce site est déjà sur le tableau." }
        }

        const now = Date.now()
        const site: Site = {
          id: crypto.randomUUID(),
          url,
          title: draft.title.trim() || hostnameOf(url),
          description: draft.description.trim() || undefined,
          tags: cleanTags(draft.tags),
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({ sites: [site, ...state.sites] }))
        return { ok: true, site }
      },

      updateSite: (id, draft) => {
        const url = normalizeUrl(draft.url)
        if (!url) return { ok: false, error: "Adresse invalide." }

        const existing = get().sites.find((site) => site.id === id)
        if (!existing) return { ok: false, error: "Site introuvable." }
        if (get().sites.some((site) => site.id !== id && site.url === url)) {
          return { ok: false, error: "Ce site est déjà sur le tableau." }
        }

        const site: Site = {
          ...existing,
          url,
          title: draft.title.trim() || hostnameOf(url),
          description: draft.description.trim() || undefined,
          tags: cleanTags(draft.tags),
          updatedAt: Date.now(),
        }

        set((state) => ({
          sites: state.sites.map((s) => (s.id === id ? site : s)),
        }))
        return { ok: true, site }
      },

      removeSite: (id) =>
        set((state) => ({ sites: state.sites.filter((site) => site.id !== id) })),
    }),
    {
      name: "mainboard.sites",
      version: 1,
      /** Only data is persisted — actions are rebuilt on every load. */
      partialize: (state) => ({ sites: state.sites }),
      /**
       * Bump `version` and add a case here whenever `Site` changes shape, so
       * boards already saved in a browser keep loading. e.g. going to v2:
       *   if (version < 2) sites = sites.map((s) => ({ ...s, pinned: false }))
       */
      migrate: (persisted, version) => {
        const state = persisted as { sites?: Site[] } | undefined
        const sites = state?.sites ?? []
        if (version < 1) return { sites: [] }
        return { sites }
      },
    }
  )
)
