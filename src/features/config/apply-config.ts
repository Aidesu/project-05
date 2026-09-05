import { useBackgroundStore } from "@/features/background/background-store"
import { assetIdOf } from "@/features/background/types"
import { useChecklistStore } from "@/features/checklist/checklist-store"
import { useGlassStore } from "@/features/glass/glass-store"
import { useCustomFeedsStore } from "@/features/news/custom-feeds-store"
import { useNewsSavedStore } from "@/features/news/news-saved-store"
import { useNewsStore } from "@/features/news/news-store"
import { useSitesStore } from "@/features/sites/sites-store"
import { iconAssetIdOf } from "@/features/sites/types"
import { useWeatherStore } from "@/features/weather/weather-store"
import { deleteAsset } from "@/lib/asset-store"

import type { ConfigImport, Theme } from "./config-file"

/**
 * Hands each section of a parsed file to the store that owns it. Sections the
 * file doesn't carry are left as they are on this device; the ones it does
 * carry replace what was there, so a board restored from a file matches the
 * one it was exported from rather than merging with it.
 *
 * The theme lives in `next-themes`, not in a store, so its setter comes from
 * the calling component.
 */
export function applyConfig(config: ConfigImport, setTheme: (theme: Theme) => void): void {
  if (config.theme) setTheme(config.theme)
  if (config.glass) useGlassStore.getState().importConfig(config.glass)
  if (config.background) useBackgroundStore.getState().importConfig(config.background)
  if (config.sites) useSitesStore.getState().importConfig(config.sites)
  if (config.weather) useWeatherStore.getState().importConfig(config.weather)
  if (config.checklist) useChecklistStore.getState().importConfig(config.checklist)
  // Desks first: the news settings that follow may name one of them.
  if (config.newsDesks) useCustomFeedsStore.getState().importConfig(config.newsDesks)
  if (config.news) useNewsStore.getState().importConfig(config.news)
  if (config.newsSaved) useNewsSavedStore.getState().importConfig(config.newsSaved)
}

/**
 * Undoes the half of parsing that isn't pure: reading a file writes its
 * inlined uploads into IndexedDB before anyone confirms the import, so an
 * import the user backs out of has to take its blobs with it.
 */
export function discardConfig(config: ConfigImport): void {
  const assetIds = [
    config.background ? assetIdOf(config.background.background) : null,
    ...(config.sites ?? []).map((site) => iconAssetIdOf(site.icon)),
  ]

  for (const assetId of assetIds) {
    if (assetId) void deleteAsset(assetId).catch(() => {})
  }
}
