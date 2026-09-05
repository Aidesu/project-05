import { useEffect, useState } from "react"

import { averageColorFromUrl } from "@/lib/average-color"

import { useBackgroundStore } from "./background-store"
import { useMediaSrc } from "./use-media-src"

/**
 * Average colour of the current image background, for UI that should pick
 * up the picture's own palette instead of a fixed theme colour. `null` for
 * every other background kind, while the sample is still loading, or if it
 * couldn't be read (cross-origin source without CORS headers, mainly).
 */
export function useMediaAccentColor(): string | null {
  const background = useBackgroundStore((state) => state.background)
  const src = useMediaSrc(background)
  const [sampled, setSampled] = useState<{ src: string; color: string | null } | null>(null)

  /** The picture worth sampling, or null for every other kind of background. */
  const source = background.kind === "image" ? src : null

  useEffect(() => {
    if (!source) return

    let cancelled = false
    averageColorFromUrl(source).then((color) => {
      if (!cancelled) setSampled({ src: source, color })
    })

    return () => {
      cancelled = true
    }
  }, [source])

  // Derived rather than cleared in the effect, the same way `use-media-src`
  // does it: the previous picture's colour is never handed out for this one.
  return source && sampled?.src === source ? sampled.color : null
}
