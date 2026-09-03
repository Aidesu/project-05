import { useMemo } from "react"

import { isLightColor } from "@/lib/color"

import { useBackgroundStore } from "./background-store"

/**
 * Whether text sitting directly on the background (no opaque surface behind
 * it: the header, the board, the weather card) should flip to dark or stay
 * light to remain readable. `null` means "don't override"the light/dark
 * theme's own foreground already fits (no background, or one we can't
 * analyse cheaplyan image or video, already dimmed by its own scrim).
 */
export function useBackgroundContrast(): "light" | "dark" | null {
  const background = useBackgroundStore((state) => state.background)
  const gradients = useBackgroundStore((state) => state.gradients)

  return useMemo(() => {
    if (background.kind === "color") {
      return isLightColor(background.color) ? "light" : "dark"
    }

    if (background.kind === "gradient") {
      // The base fill dominates the visible areathe blooms are soft,
      // off-centre accents on top of it.
      const spec = gradients.find((gradient) => gradient.id === background.preset)
      return spec ? (isLightColor(spec.base) ? "light" : "dark") : null
    }

    return null
  }, [background, gradients])
}
