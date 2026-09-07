import { useEffect, useRef } from "react"

import type { Corner } from "@/lib/corner"

import { stackOffset, useFloatingStore, type FloatingCardId } from "./floating-store"

/**
 * Everything a floating card needs to share a corner politely: a ref that
 * reports its rendered size to the store, and the style that keeps it clear of
 * the cards already stacked there.
 *
 * Call it before the card's own `enabled` early return, and pass `enabled`
 * through: a card that renders nothing has to say so, or the corner keeps
 * reserving room for a card that is no longer on screen.
 */
export function useFloatingCard(id: FloatingCardId, corner: Corner, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const report = useFloatingStore((state) => state.report)
  const clear = useFloatingStore((state) => state.clear)
  // A number, so the subscription settles on value rather than on the identity
  // of a fresh object every time any card in any corner is re-measured.
  const offset = useFloatingStore((state) => stackOffset(state.boxes, id, corner))

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) {
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
  }, [id, corner, enabled, report, clear])

  return {
    ref,
    // Cards in a top corner grow downwards, cards in a bottom corner upwards.
    style: offset
      ? { transform: `translateY(${corner.startsWith("top") ? offset : -offset}px)` }
      : undefined,
  }
}
