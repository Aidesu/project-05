import { useLayoutEffect } from "react"

import { useGlassStore } from "./glass-store"

/**
 * Mirrors the glass setting onto `<html>` as `data-glass`, which is what every
 * rule in the glass block of `index.css` hangs off.
 *
 * On the document element rather than on a wrapper inside `App`, because the
 * settings sheet and every dialog render in portals attached to `<body>`: an
 * attribute on the app's own tree would leave exactly the surfaces that most
 * need the treatment behind. Sits beside the `dark` class `next-themes` puts
 * there for the same reason.
 *
 * A layout effect, so the attribute lands in the same frame as the first
 * paint and a glass board doesn't flash flat on every new tab.
 */
export function useGlassRoot(): void {
  const enabled = useGlassStore((state) => state.enabled)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.toggleAttribute("data-glass", enabled)
    return () => root.removeAttribute("data-glass")
  }, [enabled])
}
