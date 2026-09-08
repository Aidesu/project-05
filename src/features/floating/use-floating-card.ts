import { useEffect, useRef } from "react"

import { useCompactLayout } from "@/hooks/use-compact-layout"
import { CORNER_CLASSES, type Corner } from "@/lib/corner"

import { stackOffset, useFloatingStore, type FloatingCardId } from "./floating-store"

/**
 * Everything a card needs to sit in a corner politely: a ref that reports its
 * rendered size to the store, the placement classes that put it there, and the
 * style that keeps it clear of the cards already stacked in the same corner.
 *
 * Call it before the card's own `enabled` early return, and pass `enabled`
 * through: a card that renders nothing has to say so, or the corner keeps
 * reserving room for a card that is no longer on screen.
 *
 * On a compact page there are no corners to sit in. The card is laid out by
 * the dock instead (`card-dock.tsx`), so it takes no placement of its own and
 * reports no box, which is also what quietly zeroes the news feed's reserved
 * space: the store is empty, so there is nothing for the feed to step around
 * and neither side has to know the layout changed.
 */
export function useFloatingCard(id: FloatingCardId, corner: Corner, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const compact = useCompactLayout()
  const report = useFloatingStore((state) => state.report)
  const clear = useFloatingStore((state) => state.clear)
  // A number, so the subscription settles on value rather than on the identity
  // of a fresh object every time any card in any corner is re-measured.
  const offset = useFloatingStore((state) => stackOffset(state.boxes, id, corner))

  const floating = enabled && !compact

  useEffect(() => {
    const element = ref.current
    if (!floating || !element) {
      clear(id)
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      // The border box, not the content box: under glass a card carries
      // padding and a border, and it is the outside of that which everything
      // else has to keep away from.
      const border = entry.borderBoxSize?.[0]
      report(id, {
        corner,
        width: border ? border.inlineSize : entry.contentRect.width,
        height: border ? border.blockSize : entry.contentRect.height,
      })
    })

    observer.observe(element)
    return () => {
      observer.disconnect()
      clear(id)
    }
  }, [id, corner, floating, report, clear])

  return {
    ref,
    /** True while the card owns a corner, false while it sits in the dock. */
    floating,
    /** Where the card goes. Nothing at all in the dock: it is in the flow. */
    placement: floating ? `fixed z-20 ${CORNER_CLASSES[corner]}` : "",
    // Cards in a top corner grow downwards, cards in a bottom corner upwards.
    style:
      floating && offset
        ? { transform: `translateY(${corner.startsWith("top") ? offset : -offset}px)` }
        : undefined,
  }
}
