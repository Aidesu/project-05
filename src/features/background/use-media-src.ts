import { useEffect, useState } from "react"

import { getAsset } from "@/lib/asset-store"

import { assetIdOf, type Background } from "./types"

/**
 * Resolves an uploaded background to an object URL, revoking the previous one.
 * Returns `null` until the blob is read, and for URL-based backgrounds.
 */
function useUploadedAssetUrl(background: Background): string | null {
  const assetId = assetIdOf(background)
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

  // Derived, so a stale URL is never shown for the wrong asset.
  return loaded && loaded.id === assetId ? loaded.url : null
}

/** The playable/displayable URL for an image or video background, whatever its source. */
export function useMediaSrc(background: Background): string | null {
  const uploadedUrl = useUploadedAssetUrl(background)

  if (background.kind !== "image" && background.kind !== "video") return null
  return background.source.type === "url" ? background.source.url : uploadedUrl
}
