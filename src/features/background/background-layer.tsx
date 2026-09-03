import { useEffect, useState } from "react"

import { getAsset } from "@/lib/asset-store"

import { useBackgroundStore } from "./background-store"
import { GradientSurface } from "./gradient-surface"
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

function mediaSrc(background: Background, uploadedUrl: string | null): string | null {
  if (background.kind !== "image" && background.kind !== "video") return null
  return background.source.type === "url" ? background.source.url : uploadedUrl
}

export function BackgroundLayer() {
  const background = useBackgroundStore((state) => state.background)
  const gradients = useBackgroundStore((state) => state.gradients)
  const gradientAnimated = useBackgroundStore((state) => state.gradientAnimated)
  const uploadedUrl = useUploadedAssetUrl(background)

  if (background.kind === "none") return null

  const src = mediaSrc(background, uploadedUrl)
  const gradient =
    background.kind === "gradient"
      ? gradients.find((candidate) => candidate.id === background.preset)
      : undefined

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {background.kind === "color" && (
        <div className="size-full" style={{ backgroundColor: background.color }} />
      )}

      {gradient && (
        <GradientSurface spec={gradient} animated={gradientAnimated} className="size-full" />
      )}

      {background.kind === "image" && src && (
        <div
          className="size-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${src}")` }}
        />
      )}

      {background.kind === "video" && src && (
        // `key` forces a reload when the source changes<video> ignores a
        // plain src swap once it has started buffering.
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className="size-full object-cover"
        />
      )}

      {/* Photos and video carry their own contrast; a scrim keeps the board
          legible over whatever the person picked. */}
      {(background.kind === "image" || background.kind === "video") && (
        <div className="absolute inset-0 bg-background/50" />
      )}
    </div>
  )
}
