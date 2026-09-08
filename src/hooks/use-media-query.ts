import { useCallback, useSyncExternalStore } from "react"

/**
 * Whether a media query matches right now, kept in step with the browser's
 * own answer.
 *
 * `useSyncExternalStore` rather than an effect writing to state: the very
 * first render already reads the real value, so a layout that branches on the
 * query never paints its other shape for a frame and then jumps.
 *
 * Pass a constant string. A query built inline on every render would tear the
 * subscription down and set it up again each time.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    [query]
  )

  // A boolean, so re-reading it on every check is free and React compares it
  // by value: no cached snapshot to keep in sync with the media list.
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
