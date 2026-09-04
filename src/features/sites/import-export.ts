import { getAsset, putAsset } from "@/lib/asset-store"

import type { Site, SiteDraft, SiteIcon } from "./types"

/**
 * Bumped whenever the export shape changes. Independent of the sites store's
 * own `version` (`sites-store.ts`): this one governs a file that can outlive
 * the browser it was written in, so it needs its own history.
 */
export const SITES_EXPORT_VERSION = 1

/**
 * An uploaded icon's `assetId` only means something in the browser that
 * holds the blob: it doesn't survive being written to a file. Exporting one
 * inlines the bytes as a data URL instead; importing turns it back into a
 * fresh `assetId` in whatever browser reads the file.
 */
type ExportedIcon = { type: "url"; url: string } | { type: "data"; dataUrl: string }

type ExportedSite = {
  url: string
  title: string
  description?: string
  tags: string[]
  hidden: boolean
  icon?: ExportedIcon
}

export type SitesExport = {
  app: "mainboard.sites"
  version: number
  exportedAt: number
  sites: ExportedSite[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function exportIcon(icon: SiteIcon | undefined): Promise<ExportedIcon | undefined> {
  if (!icon) return undefined
  if (icon.type === "url") return icon

  const blob = await getAsset(icon.assetId)
  if (!blob) return undefined // the asset is gone, nothing to embed

  return { type: "data", dataUrl: await blobToDataUrl(blob) }
}

/** Builds the exportable snapshot, embedding any uploaded icon's bytes. */
export async function buildSitesExport(sites: Site[]): Promise<SitesExport> {
  const exported = await Promise.all(
    sites.map(async (site) => ({
      url: site.url,
      title: site.title,
      description: site.description,
      tags: site.tags,
      hidden: site.hidden,
      icon: await exportIcon(site.icon),
    }))
  )

  return {
    app: "mainboard.sites",
    version: SITES_EXPORT_VERSION,
    exportedAt: Date.now(),
    sites: exported,
  }
}

export function sitesExportFilename(): string {
  return `hi-sites-${new Date().toISOString().slice(0, 10)}.json`
}

export type ParseResult =
  | { ok: true; sites: SiteDraft[] }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function importIcon(raw: unknown): Promise<SiteIcon | undefined> {
  if (!isRecord(raw)) return undefined

  if (raw.type === "url" && typeof raw.url === "string") {
    return { type: "url", url: raw.url }
  }

  if (raw.type === "data" && typeof raw.dataUrl === "string") {
    try {
      const blob = await (await fetch(raw.dataUrl)).blob()
      return { type: "upload", assetId: await putAsset(blob) }
    } catch {
      return undefined // malformed data URL: drop the icon, keep the site
    }
  }

  return undefined
}

async function parseSite(raw: unknown): Promise<SiteDraft | null> {
  if (!isRecord(raw) || typeof raw.url !== "string") return null

  return {
    url: raw.url,
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [],
    hidden: raw.hidden === true,
    icon: await importIcon(raw.icon),
  }
}

/**
 * Parses and rehydrates an export file into drafts ready for
 * `useSitesStore.getState().importSites()`, which owns normalisation and
 * deduplication the same way it does for a single `addSite`.
 *
 * Only v1 exists today: when the format changes, branch on `data.version`
 * here the same way `sites-store.ts`'s `migrate` branches on its own
 * version, so an older file kept on someone's disk still imports.
 */
export async function parseSitesExport(json: string): Promise<ParseResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, error: "That file isn't valid JSON." }
  }

  if (!isRecord(data) || data.app !== "mainboard.sites") {
    return { ok: false, error: "That file isn't a sites export." }
  }
  if (typeof data.version !== "number" || data.version > SITES_EXPORT_VERSION) {
    return { ok: false, error: "This file was exported by a newer version of the app." }
  }
  if (!Array.isArray(data.sites)) {
    return { ok: false, error: "That file isn't a sites export." }
  }

  const sites = (await Promise.all(data.sites.map(parseSite))).filter(
    (site): site is SiteDraft => site !== null
  )
  if (sites.length === 0) return { ok: false, error: "No sites found in that file." }

  return { ok: true, sites }
}
