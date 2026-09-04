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
  const [color, setColor] = useState<string | null>(null)

  useEffect(() => {
    if (background.kind !== "image" || !src) {
      setColor(null)
      return
    }

    let cancelled = false
    averageColorFromUrl(src).then((result) => {
      if (!cancelled) setColor(result)
    })

    return () => {
      cancelled = true
    }
  }, [background.kind, src])

  return color
}
