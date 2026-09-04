import { arrayMove } from "@dnd-kit/sortable"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { deleteAsset } from "@/lib/asset-store"
import { hostnameOf, normalizeUrl } from "@/lib/url"

import { iconAssetIdOf, type Site, type SiteDraft } from "./types"

export type SiteResult =
  | { ok: true; site: Site }
  | { ok: false; error: string }

export type ImportSitesResult = { added: number; skipped: number }

type SitesState = {
  sites: Site[]
  addSite: (draft: SiteDraft) => SiteResult
  updateSite: (id: string, draft: SiteDraft) => SiteResult
  removeSite: (id: string) => void
  /** Bulk `addSite`: each draft goes through the same normalisation and
   * dedup check, so an imported site already on the board is silently
   * skipped rather than duplicated. */
  importSites: (drafts: SiteDraft[]) => ImportSitesResult
  /** Commits the final position from a completed drag-and-drop reorder.
   * Board order (the array order) is the single source of truth for display
   * orderthe live preview while dragging is dnd-kit's, not stored here. */
  reorderSite: (activeId: string, overId: string) => void
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
 * invariants that must not live in a componentURL normalisation and
 * deduplication. Search, filtering and sorting are derived at render time.
 */
export const useSitesStore = create<SitesState>()(
  persist(
    (set, get) => ({
      sites: [],

      addSite: (draft) => {
        const url = normalizeUrl(draft.url)
        if (!url) return { ok: false, error: "Invalid address." }
        if (get().sites.some((site) => site.url === url)) {
          return { ok: false, error: "This site is already on the board." }
        }

        const now = Date.now()
        const site: Site = {
          id: crypto.randomUUID(),
          url,
          title: draft.title.trim() || hostnameOf(url),
          description: draft.description.trim() || undefined,
          tags: cleanTags(draft.tags),
          hidden: draft.hidden,
          icon: draft.icon,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({ sites: [site, ...state.sites] }))
        return { ok: true, site }
      },

      updateSite: (id, draft) => {
        const url = normalizeUrl(draft.url)
        if (!url) return { ok: false, error: "Invalid address." }

        const existing = get().sites.find((site) => site.id === id)
        if (!existing) return { ok: false, error: "Site not found." }
        if (get().sites.some((site) => site.id !== id && site.url === url)) {
          return { ok: false, error: "This site is already on the board." }
        }

        const site: Site = {
          ...existing,
          url,
          title: draft.title.trim() || hostnameOf(url),
          description: draft.description.trim() || undefined,
          tags: cleanTags(draft.tags),
          hidden: draft.hidden,
          icon: draft.icon,
          updatedAt: Date.now(),
        }

        set((state) => ({
          sites: state.sites.map((s) => (s.id === id ? site : s)),
        }))

        // Drop the replaced upload so IndexedDB does not collect orphans.
        const previousAssetId = iconAssetIdOf(existing.icon)
        if (previousAssetId && previousAssetId !== iconAssetIdOf(site.icon)) {
          void deleteAsset(previousAssetId).catch(() => {})
        }

        return { ok: true, site }
      },

      removeSite: (id) => {
        const existing = get().sites.find((site) => site.id === id)
        set((state) => ({ sites: state.sites.filter((site) => site.id !== id) }))

        const assetId = iconAssetIdOf(existing?.icon)
        if (assetId) void deleteAsset(assetId).catch(() => {})
      },

      importSites: (drafts) => {
        const added = drafts.filter((draft) => get().addSite(draft).ok).length
        return { added, skipped: drafts.length - added }
      },

      reorderSite: (activeId, overId) => {
        if (activeId === overId) return

        set((state) => {
          const fromIndex = state.sites.findIndex((site) => site.id === activeId)
          const toIndex = state.sites.findIndex((site) => site.id === overId)
          if (fromIndex === -1 || toIndex === -1) return state

          return { sites: arrayMove(state.sites, fromIndex, toIndex) }
        })
      },
    }),
    {
      name: "mainboard.sites",
      version: 3,
      /** Only data is persistedactions are rebuilt on every load. */
      partialize: (state) => ({ sites: state.sites }),
      /**
       * Bump `version` and add a case here whenever `Site` changes shape, so
       * boards already saved in a browser keep loading. e.g. going to v4:
       *   if (version < 4) sites = sites.map((s) => ({ ...s, pinned: false }))
       */
      migrate: (persisted, version) => {
        const state = persisted as { sites?: Site[] } | undefined
        let sites = state?.sites ?? []
        if (version < 1) sites = []
        // v3 added `icon`, optional and already `undefined` on older sites,
        // so no backfill is needed.
        // v2 added `hidden`existing sites stay visible by default.
        if (version < 2) sites = sites.map((site) => ({ ...site, hidden: site.hidden ?? false }))
        return { sites }
      },
    }
  )
)
