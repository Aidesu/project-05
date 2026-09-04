import { useEffect, useState } from "react"

import { getAsset } from "@/lib/asset-store"
import { faviconUrl } from "@/lib/url"

import type { SiteIcon } from "./types"

/**
 * Resolves a site's icon to a displayable URLan uploaded blob becomes an
 * object URL (revoked on cleanup), a custom address passes through as-is,
 * and no icon at all falls back to the derived favicon. Returns `null` only
 * while an uploaded blob is still being read from IndexedDB.
 */
export function useSiteIconUrl(icon: SiteIcon | undefined, siteUrl: string): string | null {
  const assetId = icon?.type === "upload" ? icon.assetId : null
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null)

  useEffect(() => {
    if (!assetId) return

    let objectUrl: string | null = null
    let cancelled = false

    getAsset(assetId)
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ id: assetId, url: objectUrl })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetId])

  if (icon?.type === "url") return icon.url
  if (assetId) return loaded && loaded.id === assetId ? loaded.url : null
  return faviconUrl(siteUrl)
}
