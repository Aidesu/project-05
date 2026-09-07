import { useEffect, useMemo, useRef, useState } from "react"

import { useFloatingStore } from "./floating-store"
import { NO_INSETS, reservedInsets, type Insets } from "./reserved-space"

/** The measured element's own edges, and the viewport they were read in. */
type Frame = Insets & { viewportWidth: number; viewportHeight: number }

function sameFrame(a: Frame, b: Frame): boolean {
  return (
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.viewportWidth === b.viewportWidth &&
    a.viewportHeight === b.viewportHeight
  )
}

/**
 * Padding that keeps an element's contents out from under the floating cards.
 *
 * Apply it as the element's own padding rather than to anything inside it. The
 * element must be one whose border box is settled by its parent (the feed is a
 * `1fr` grid row, so it is), because that is what makes this terminate: its own
 * padding cannot move the edges the padding was worked out from, so a
 * measurement never invalidates itself.
 *
 * Rounded to whole pixels before anything is compared: a rect that wobbles in
 * the third decimal on every scroll would otherwise re-render the feed forever.
 */
export function useReservedSpace<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [frame, setFrame] = useState<Frame | null>(null)
  const boxes = useFloatingStore((state) => state.boxes)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    function measure() {
      if (!element) return
      const rect = element.getBoundingClientRect()
      const next: Frame = {
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
      setFrame((current) => (current && sameFrame(current, next) ? current : next))
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // The viewport's own size is half the sum, and it can change without the
    // element resizing at all.
    window.addEventListener("resize", measure)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  const insets = useMemo(
    () =>
      frame
        ? reservedInsets(boxes, frame, {
            width: frame.viewportWidth,
            height: frame.viewportHeight,
          })
        : NO_INSETS,
    [boxes, frame]
  )

  return { ref, insets }
}
