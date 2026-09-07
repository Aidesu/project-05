import { create } from "zustand"

import type { Corner } from "@/lib/corner"

/**
 * Every card that floats over the page in a corner of its own. Listed rather
 * than open-ended: the order below is a layout decision, not something a card
 * gets to declare about itself.
 */
export type FloatingCardId = "weather" | "media" | "checklist"

/**
 * The order cards take inside a corner they share, reading away from that
 * corner: the weather sits closest to it, the checklist furthest, and the
 * player between them. Fixed, so two cards never trade places on a re-render
 * or depending on which one measured itself first.
 */
export const FLOATING_ORDER: FloatingCardId[] = ["weather", "media", "checklist"]

/** Clearance between two stacked cards, and between a card and anything that
 * steps aside for it. */
export const FLOATING_GAP = 12

/** One card's corner and its rendered border box, in px. */
export type FloatingBox = { corner: Corner; width: number; height: number }

export type FloatingBoxes = Partial<Record<FloatingCardId, FloatingBox>>

/**
 * Where the floating cards are and how big they came out. Not persisted: this
 * is a layout fact, measured every time the page is drawn, not a preference.
 *
 * It exists because two things need it. A card sharing a corner has to stack
 * clear of the ones already there, and the news feed has to leave the corners
 * they occupy alone rather than run its own cards underneath them.
 */
type FloatingState = {
  boxes: FloatingBoxes
  report: (id: FloatingCardId, box: FloatingBox) => void
  clear: (id: FloatingCardId) => void
}

export const useFloatingStore = create<FloatingState>()((set) => ({
  boxes: {},

  report: (id, box) =>
    set((state) => {
      const current = state.boxes[id]
      // A `ResizeObserver` fires for every sub-pixel reflow, and each of these
      // writes re-renders the feed. Nothing moved unless one of the three
      // numbers actually changed.
      if (
        current &&
        current.corner === box.corner &&
        current.width === box.width &&
        current.height === box.height
      ) {
        return state
      }
      return { boxes: { ...state.boxes, [id]: box } }
    }),

  clear: (id) =>
    set((state) => {
      if (!(id in state.boxes)) return state
      const boxes = { ...state.boxes }
      delete boxes[id]
      return { boxes }
    }),
}))

/**
 * How far a card has to move out of its corner to clear the cards that come
 * before it there. Always a positive distance: which way it points is the
 * corner's business, not this one's.
 */
export function stackOffset(
  boxes: FloatingBoxes,
  id: FloatingCardId,
  corner: Corner
): number {
  let offset = 0

  for (const other of FLOATING_ORDER) {
    if (other === id) break
    const box = boxes[other]
    if (box?.corner === corner) offset += box.height + FLOATING_GAP
  }

  return offset
}

/**
 * A whole corner's stack as one box: the widest card in it, and every card's
 * height plus the gaps between them. `null` where the corner is empty.
 */
export function cornerBox(
  boxes: FloatingBoxes,
  corner: Corner
): { width: number; height: number } | null {
  let width = 0
  let height = 0
  let count = 0

  for (const id of FLOATING_ORDER) {
    const box = boxes[id]
    if (box?.corner !== corner) continue
    width = Math.max(width, box.width)
    height += box.height
    count += 1
  }

  return count === 0 ? null : { width, height: height + (count - 1) * FLOATING_GAP }
}
