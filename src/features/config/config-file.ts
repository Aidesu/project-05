import {
  useBackgroundStore,
  type BackgroundConfig,
} from "@/features/background/background-store"
import { BUILT_IN_GRADIENTS } from "@/features/background/presets"
import {
  DEFAULT_MEDIA_EFFECTS,
  DEFAULT_MEDIA_FIT,
  DEFAULT_MEDIA_POSITION,
  MEDIA_FITS,
  MEDIA_POSITIONS,
  type Background,
  type GradientBloom,
  type GradientSpec,
  type MediaEffects,
} from "@/features/background/types"
import { useChecklistStore, type ChecklistConfig } from "@/features/checklist/checklist-store"
import type { ChecklistItem } from "@/features/checklist/types"
import { useCustomFeedsStore } from "@/features/news/custom-feeds-store"
import {
  useNewsSavedStore,
  type SavedArticle,
} from "@/features/news/news-saved-store"
import { NEWS_CATEGORIES } from "@/features/news/news-sources"
import {
  ALL_CATEGORIES,
  SAVED_CATEGORY,
  useNewsStore,
  type NewsConfig,
} from "@/features/news/news-store"
import type { CustomCategoryId, CustomDesk, NewsCategoryId } from "@/features/news/types"
import { useSitesStore } from "@/features/sites/sites-store"
import type { SiteDraft } from "@/features/sites/types"
import { useWeatherStore, type WeatherConfig } from "@/features/weather/weather-store"
import type { ManualLocation } from "@/features/weather/types"
import { isHexColor } from "@/lib/color"
import { isSafeHttpUrl, normalizeFeedUrl, safeImageUrl } from "@/lib/url"
import { CORNERS, type Corner } from "@/lib/corner"

import {
  exportAsset,
  importAsset,
  type AssetReport,
  type PortableAsset,
} from "./portable-asset"

/**
 * Bumped whenever the export shape changes. Independent of any store's own
 * `version`: this governs a file that can outlive the browser it was written
 * in, and that is meant to be carried to a different one.
 *
 * 2 added the news desks someone built and the stories they kept. Files at
 * version 1 still import: every field either side of that is optional, and a
 * file that carries neither simply leaves both stores alone.
 */
export const CONFIG_EXPORT_VERSION = 2

const APP = "mainboard.config"

/** The sites-only export this one replaces. Files of it still import. */
const LEGACY_SITES_APP = "mainboard.sites"

export type Theme = "light" | "dark" | "system"

const THEMES = ["light", "dark", "system"] as const

const LOCATION_MODES = ["geo", "manual"] as const

const CATEGORY_IDS = NEWS_CATEGORIES.map((category) => category.id)

/** Mirrors the ceilings `custom-feeds-store` enforces on what it is handed. */
const MAX_IMPORTED_DESKS = 12
const MAX_IMPORTED_FEEDS = 20
const MAX_IMPORTED_SAVED = 200

/** Long enough for a headline or a standfirst, short enough that a file cannot
 * push a novel into a card. */
const MAX_TEXT = 500
const MAX_FACTS = 6

// ------------------------------------------------------------- file shape

type ExportedSite = {
  url: string
  title: string
  description?: string
  tags: string[]
  hidden: boolean
  icon?: PortableAsset
}

/** A background whose media, if any, carries its bytes rather than an asset id. */
type ExportedBackgroundValue =
  | Exclude<Background, { kind: "image" } | { kind: "video" }>
  | { kind: "image"; source: PortableAsset }
  | { kind: "video"; source: PortableAsset }

type ExportedBackground = Omit<BackgroundConfig, "background"> & {
  background: ExportedBackgroundValue
}

/**
 * One file describing a whole board: what is shown, where it sits, and what
 * it is filled with. Every section is optional: a file that carries only
 * some of them (a legacy sites export, a hand-trimmed file) leaves the rest
 * of the device alone on import.
 */
export type ConfigFile = {
  app: typeof APP
  version: number
  exportedAt: number
  theme?: Theme
  background?: ExportedBackground
  sites?: ExportedSite[]
  weather?: WeatherConfig
  checklist?: ChecklistConfig
  news?: NewsConfig
  /** Desks built by hand, carried separately: they are their own store. */
  newsDesks?: CustomDesk[]
  /**
   * Stories kept by hand. Each carries its own copy of the article, which is
   * the point of saving one: the feed it came from moved on long ago.
   *
   * Only what someone chose to keep travels. Which stories have merely been
   * *opened* stays on the device: that is a reading history, and this file is
   * meant to be carried around and handed to another machine.
   */
  newsSaved?: SavedArticle[]
}

/** A parsed file, in the shape each store takes back. */
export type ConfigImport = {
  theme?: Theme
  background?: BackgroundConfig
  sites?: SiteDraft[]
  weather?: WeatherConfig
  checklist?: ChecklistConfig
  news?: NewsConfig
  newsDesks?: CustomDesk[]
  newsSaved?: SavedArticle[]
}

// ----------------------------------------------------------------- export

async function exportBackground(
  config: BackgroundConfig,
  report: AssetReport
): Promise<ExportedBackground> {
  const { background } = config

  if (background.kind !== "image" && background.kind !== "video") {
    return { ...config, background }
  }

  const source = await exportAsset(background.source, report)

  // An upload too large to inline leaves nothing to point at: the file says
  // "no background" rather than an asset id the other device cannot resolve.
  return {
    ...config,
    background: source ? { kind: background.kind, source } : { kind: "none" },
  }
}

/**
 * Builds the exportable snapshot from the live stores, embedding the bytes of
 * every upload small enough to travel. `theme` comes from `next-themes`
 * rather than a store, so the caller reads it and passes it in.
 */
export async function buildConfigExport(
  theme: Theme
): Promise<{ file: ConfigFile; skippedAssets: number }> {
  const report: AssetReport = { skipped: 0 }

  const { sites } = useSitesStore.getState()
  const { background, gradients, gradientAnimated, mediaEffects, mediaFit, mediaPosition } =
    useBackgroundStore.getState()
  const { enabled: weatherEnabled, position: weatherPosition, locationMode, manualLocation } =
    useWeatherStore.getState()
  const { enabled: checklistEnabled, position: checklistPosition, items } =
    useChecklistStore.getState()
  const { enabled: newsEnabled, categories, activeCategory } = useNewsStore.getState()
  const { desks } = useCustomFeedsStore.getState()
  const { articles: savedArticles } = useNewsSavedStore.getState()

  const file: ConfigFile = {
    app: APP,
    version: CONFIG_EXPORT_VERSION,
    exportedAt: Date.now(),
    theme,
    background: await exportBackground(
      { background, gradients, gradientAnimated, mediaEffects, mediaFit, mediaPosition },
      report
    ),
    sites: await Promise.all(
      sites.map(async (site) => ({
        url: site.url,
        title: site.title,
        description: site.description,
        tags: site.tags,
        hidden: site.hidden,
        icon: await exportAsset(site.icon, report),
      }))
    ),
    weather: { enabled: weatherEnabled, position: weatherPosition, locationMode, manualLocation },
    checklist: { enabled: checklistEnabled, position: checklistPosition, items },
    news: { enabled: newsEnabled, categories, activeCategory },
    newsDesks: desks,
    newsSaved: savedArticles,
  }

  return { file, skippedAssets: report.skipped }
}

export function configExportFilename(): string {
  return `hi-config-${new Date().toISOString().slice(0, 10)}.json`
}

// ------------------------------------------------------------------ parse

export type ParseResult =
  | { ok: true; config: ConfigImport }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined
}

/** A number the file can't push out of the range the settings UI allows. */
function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/**
 * A colour the app itself could have produced. Every one of these is
 * interpolated into CSS downstream, so the file gets the same hex-only
 * vocabulary the colour inputs have.
 */
function asColor(value: unknown): string | undefined {
  const color = asString(value)
  return color && isHexColor(color) ? color : undefined
}

function parseBloom(raw: unknown): GradientBloom | null {
  if (!isRecord(raw)) return null

  const color = asColor(raw.color)
  if (!color) return null

  return { color, x: asNumber(raw.x, 50, 0, 100), y: asNumber(raw.y, 50, 0, 100) }
}

function parseGradient(raw: unknown): GradientSpec | null {
  if (!isRecord(raw) || !Array.isArray(raw.blooms)) return null

  const id = asString(raw.id)
  const label = asString(raw.label)
  const base = asColor(raw.base)
  if (!id || !label || !base) return null

  return {
    id,
    label,
    base,
    blooms: raw.blooms.map(parseBloom).filter((bloom): bloom is GradientBloom => bloom !== null),
  }
}

/** Same ranges as the sliders in `background-settings.tsx`. */
function parseMediaEffects(raw: unknown): MediaEffects {
  if (!isRecord(raw)) return DEFAULT_MEDIA_EFFECTS

  return {
    blur: asNumber(raw.blur, DEFAULT_MEDIA_EFFECTS.blur, 0, 20),
    dim: asNumber(raw.dim, DEFAULT_MEDIA_EFFECTS.dim, 0, 100),
    grayscale: asNumber(raw.grayscale, DEFAULT_MEDIA_EFFECTS.grayscale, 0, 100),
    saturate: asNumber(raw.saturate, DEFAULT_MEDIA_EFFECTS.saturate, 0, 200),
  }
}

async function parseBackgroundValue(raw: unknown): Promise<Background | undefined> {
  if (!isRecord(raw)) return undefined

  if (raw.kind === "none") return { kind: "none" }

  if (raw.kind === "color") {
    const color = asColor(raw.color)
    return color ? { kind: "color", color } : undefined
  }

  if (raw.kind === "gradient") {
    const preset = asString(raw.preset)
    return preset ? { kind: "gradient", preset } : undefined
  }

  if (raw.kind === "image" || raw.kind === "video") {
    const source = await importAsset(raw.source)
    // The bytes didn't make it across; a plain background beats a layer
    // pointing at nothing.
    return source ? { kind: raw.kind, source } : { kind: "none" }
  }

  return undefined
}

async function parseBackground(raw: unknown): Promise<BackgroundConfig | undefined> {
  if (!isRecord(raw)) return undefined

  const background = await parseBackgroundValue(raw.background)
  if (!background) return undefined

  const gradients = Array.isArray(raw.gradients)
    ? raw.gradients.map(parseGradient).filter((spec): spec is GradientSpec => spec !== null)
    : []

  return {
    background,
    gradients: gradients.length > 0 ? gradients : BUILT_IN_GRADIENTS,
    gradientAnimated: raw.gradientAnimated !== false,
    mediaEffects: parseMediaEffects(raw.mediaEffects),
    mediaFit: asOneOf(raw.mediaFit, MEDIA_FITS) ?? DEFAULT_MEDIA_FIT,
    mediaPosition: asOneOf(raw.mediaPosition, MEDIA_POSITIONS) ?? DEFAULT_MEDIA_POSITION,
  }
}

async function parseSite(raw: unknown): Promise<SiteDraft | null> {
  if (!isRecord(raw) || typeof raw.url !== "string") return null

  return {
    url: raw.url,
    title: asString(raw.title) ?? "",
    description: asString(raw.description) ?? "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [],
    hidden: raw.hidden === true,
    icon: await importAsset(raw.icon),
  }
}

function parseSites(raw: unknown): Promise<SiteDraft[]> | undefined {
  if (!Array.isArray(raw)) return undefined

  return Promise.all(raw.map(parseSite)).then((sites) =>
    sites.filter((site): site is SiteDraft => site !== null)
  )
}

function parseManualLocation(raw: unknown): ManualLocation | null {
  if (!isRecord(raw)) return null

  const label = asString(raw.label)
  if (!label || typeof raw.lat !== "number" || typeof raw.lon !== "number") return null
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) return null

  return { label, lat: raw.lat, lon: raw.lon }
}

function parseCorner(raw: unknown, fallback: Corner): Corner {
  return asOneOf(raw, CORNERS) ?? fallback
}

function parseWeather(raw: unknown): WeatherConfig | undefined {
  if (!isRecord(raw)) return undefined

  return {
    enabled: raw.enabled === true,
    position: parseCorner(raw.position, "bottom-right"),
    locationMode: asOneOf(raw.locationMode, LOCATION_MODES) ?? "manual",
    manualLocation: parseManualLocation(raw.manualLocation),
  }
}

function parseChecklist(raw: unknown): ChecklistConfig | undefined {
  if (!isRecord(raw)) return undefined

  const items: ChecklistItem[] = (Array.isArray(raw.items) ? raw.items : []).flatMap(
    (item: unknown) => {
      if (!isRecord(item)) return []
      const text = asString(item.text)?.trim()
      // Ids are internal and only have to be unique in this browser, so they
      // are minted here rather than trusted from the file.
      return text ? [{ id: crypto.randomUUID(), text, done: item.done === true }] : []
    }
  )

  return { enabled: raw.enabled === true, position: parseCorner(raw.position, "top-right"), items }
}

/**
 * Desks from a file, rebuilt rather than trusted: ids are minted here, every
 * address goes through the same normalisation the store applies, and the
 * ceilings match the ones the app enforces, so a hand-edited file cannot
 * install two hundred feeds or name a desk a thousand characters wide.
 *
 * Returns the map from the ids the file used to the ones just minted, which is
 * what lets `parseNews` keep pointing at the desk that was open.
 */
function parseNewsDesks(raw: unknown): {
  desks: CustomDesk[]
  ids: Map<string, CustomCategoryId>
} {
  const desks: CustomDesk[] = []
  const ids = new Map<string, CustomCategoryId>()
  if (!Array.isArray(raw)) return { desks, ids }

  for (const entry of raw.slice(0, MAX_IMPORTED_DESKS)) {
    if (!isRecord(entry)) continue

    const label = asString(entry.label)?.trim().replace(/\s+/g, " ").slice(0, 32)
    if (!label) continue

    const feeds = (Array.isArray(entry.feeds) ? entry.feeds : [])
      .slice(0, MAX_IMPORTED_FEEDS)
      .flatMap((item: unknown) => {
        if (!isRecord(item)) return []
        const url = normalizeFeedUrl(asString(item.url) ?? "")
        if (!url) return []
        const source = asString(item.source)?.trim().slice(0, 32)
        return [{ id: crypto.randomUUID(), url, source: source || new URL(url).hostname }]
      })

    const id: CustomCategoryId = `custom:${crypto.randomUUID()}`
    const original = asString(entry.id)
    if (original) ids.set(original, id)
    desks.push({ id, label, feeds })
  }

  return { desks, ids }
}

/** Trimmed, clamped, and `undefined` rather than empty. */
function asText(value: unknown): string | undefined {
  const text = asString(value)?.trim().slice(0, MAX_TEXT)
  return text || undefined
}

/**
 * One kept story, rebuilt field by field.
 *
 * Everything here ends up on a card and in an `href`: the address goes through
 * the same `isSafeHttpUrl` gate the fetched stories pass, the picture through
 * `safeImageUrl`, and every string is clamped. A story missing an address, a
 * headline or a date is dropped rather than patched, since each of the three
 * is load-bearing (the last one sorts the tab).
 */
function parseSavedArticle(raw: unknown): SavedArticle | null {
  if (!isRecord(raw)) return null

  const url = asString(raw.url)
  const title = asText(raw.title)
  if (!url || !isSafeHttpUrl(url) || !title) return null

  const publishedAt = raw.publishedAt
  if (typeof publishedAt !== "number" || !Number.isFinite(publishedAt)) return null

  const link = isRecord(raw.secondaryLink) ? raw.secondaryLink : null
  const linkUrl = asString(link?.url)
  const linkLabel = asText(link?.label)

  const facts = (Array.isArray(raw.facts) ? raw.facts : [])
    .slice(0, MAX_FACTS)
    .flatMap((fact: unknown) => {
      const text = asText(fact)
      return text ? [text] : []
    })

  const savedAt = raw.savedAt
  return {
    // Derived rather than trusted: the id is only ever a list key, and two
    // stories sharing one from a hand-edited file would collide in the grid.
    id: `saved-${url}`,
    title,
    url,
    source: asText(raw.source) ?? new URL(url).hostname,
    publishedAt,
    summary: asText(raw.summary),
    imageUrl: safeImageUrl(asString(raw.imageUrl)),
    author: asText(raw.author),
    facts: facts.length > 0 ? facts : undefined,
    secondaryLink:
      linkUrl && linkLabel && isSafeHttpUrl(linkUrl) ? { label: linkLabel, url: linkUrl } : undefined,
    savedAt: typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : Date.now(),
  }
}

/** Kept stories from a file, newest first and one entry per address. */
function parseNewsSaved(raw: unknown): SavedArticle[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const articles: SavedArticle[] = []
  for (const entry of raw) {
    if (articles.length >= MAX_IMPORTED_SAVED) break
    const article = parseSavedArticle(entry)
    if (!article || seen.has(article.url)) continue
    seen.add(article.url)
    articles.push(article)
  }
  return articles
}

function parseNews(
  raw: unknown,
  deskIds: Map<string, CustomCategoryId>
): NewsConfig | undefined {
  if (!isRecord(raw)) return undefined

  // The file's own desk ids mean nothing here (they were replaced on the way
  // in), so anything naming one is translated to the id it now has.
  const rename = (id: unknown) => (typeof id === "string" ? (deskIds.get(id) ?? id) : id)

  const allowed: NewsCategoryId[] = [...CATEGORY_IDS, ...deskIds.values()]
  const wanted = new Set((Array.isArray(raw.categories) ? raw.categories : []).map(rename))
  // Rebuilt from the canonical order, exactly as `toggleCategory` does, so an
  // id this build no longer has is dropped and the tabs keep their order.
  const categories = allowed.filter((id) => wanted.has(id))

  const active = rename(raw.activeCategory)
  // The two tabs that are not categories pass straight through; anything else
  // has to name a desk this build still has.
  const activeCategory =
    active === ALL_CATEGORIES || active === SAVED_CATEGORY
      ? active
      : (asOneOf(active, allowed) ?? categories[0] ?? CATEGORY_IDS[0])

  return { enabled: raw.enabled === true, categories, activeCategory }
}

/**
 * Parses an export file into the sections each store can take back.
 *
 * Anything unreadable is dropped rather than fatal: a file written by an
 * older build, or one whose wallpaper bytes were left out, still restores
 * everything else. Only a file that isn't ours at all is refused.
 *
 * Only v1 exists today: when the format changes, branch on `data.version`
 * here the same way each store's `migrate` branches on its own, so a file
 * kept on someone's disk still imports.
 */
export async function parseConfigFile(json: string): Promise<ParseResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, error: "That file isn't valid JSON." }
  }

  if (!isRecord(data)) return { ok: false, error: "That file isn't a configuration export." }

  // The sites-only export that came before this one: read as a config
  // carrying nothing but a board.
  if (data.app === LEGACY_SITES_APP) {
    const sites = await parseSites(data.sites)
    if (!sites?.length) return { ok: false, error: "No sites found in that file." }
    return { ok: true, config: { sites } }
  }

  if (data.app !== APP) {
    return { ok: false, error: "That file isn't a configuration export." }
  }
  if (typeof data.version !== "number" || data.version > CONFIG_EXPORT_VERSION) {
    return { ok: false, error: "This file was exported by a newer version of the app." }
  }

  const newsDesks = parseNewsDesks(data.newsDesks)

  const config: ConfigImport = {
    theme: asOneOf(data.theme, THEMES),
    background: await parseBackground(data.background),
    sites: await parseSites(data.sites),
    weather: parseWeather(data.weather),
    checklist: parseChecklist(data.checklist),
    news: parseNews(data.news, newsDesks.ids),
    // An explicit empty list is an answer: the file describes someone with no
    // custom desks, and importing it should leave none behind.
    newsDesks: Array.isArray(data.newsDesks) ? newsDesks.desks : undefined,
    newsSaved: Array.isArray(data.newsSaved) ? parseNewsSaved(data.newsSaved) : undefined,
  }

  if (describeConfig(config).length === 0) {
    return { ok: false, error: "That file has nothing left to import." }
  }

  return { ok: true, config }
}

/** One line per section a parsed file carries, for the confirmation dialog. */
export function describeConfig(config: ConfigImport): string[] {
  const lines: string[] = []

  if (config.theme) lines.push(`Theme: ${config.theme}`)
  if (config.background) lines.push("Background")
  if (config.sites) {
    lines.push(`${config.sites.length} site${config.sites.length === 1 ? "" : "s"}`)
  }
  if (config.weather) {
    lines.push(config.weather.enabled ? `Weather card (${config.weather.position})` : "Weather card (off)")
  }
  if (config.checklist) {
    lines.push(
      config.checklist.enabled
        ? `Checklist (${config.checklist.position}, ${config.checklist.items.length} item${
            config.checklist.items.length === 1 ? "" : "s"
          })`
        : "Checklist (off)"
    )
  }
  if (config.news) {
    lines.push(
      config.news.enabled
        ? `News (${config.news.categories.length} categor${
            config.news.categories.length === 1 ? "y" : "ies"
          })`
        : "News (off)"
    )
  }
  if (config.newsDesks?.length) {
    lines.push(
      `${config.newsDesks.length} custom desk${config.newsDesks.length === 1 ? "" : "s"}`
    )
  }
  if (config.newsSaved?.length) {
    lines.push(
      `${config.newsSaved.length} saved stor${config.newsSaved.length === 1 ? "y" : "ies"}`
    )
  }

  return lines
}
