import { CORNERS, CORNER_EDGE, CORNER_TOP, type Corner } from "@/lib/corner"

import { cornerBox, FLOATING_GAP, type FloatingBoxes } from "./floating-store"

/** Room to give up on each side, in px. */
export type Insets = { top: number; right: number; bottom: number; left: number }

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Viewport coordinates, the shape `getBoundingClientRect` hands back. */
export type Edges = { top: number; right: number; bottom: number; left: number }

/**
 * How much of a region a reservation may eat before the cure is worse than the
 * overlap. On a window small enough that a corner card covers most of the
 * feed, a card partly behind one is still better than a feed squeezed to a
 * single unreadable column.
 */
const MOST_OF_A_SIDE = 0.4

/** Where a corner's stack sits in the viewport, from the same two insets
 * `CORNER_CLASSES` positions it with. */
function stackEdges(
  corner: Corner,
  size: { width: number; height: number },
  viewport: { width: number; height: number }
): Edges {
  const left = corner.endsWith("left") ? CORNER_EDGE : viewport.width - CORNER_EDGE - size.width
  const top = corner.startsWith("top") ? CORNER_TOP : viewport.height - CORNER_EDGE - size.height

  return { left, top, right: left + size.width, bottom: top + size.height }
}

/**
 * How much room a region has to give up on each side so that nothing laid out
 * inside it ends up underneath a floating card.
 *
 * Only corners that actually reach into the region cost anything, which is
 * what makes this quiet on a wide window: there the cards sit out in the
 * margins beside the content and the feed is left exactly as it was. It is the
 * small window, where the content runs edge to edge, that pays.
 *
 * Each intruding corner is settled on whichever axis is cheaper: a narrow card
 * at the top of the page is stepped around sideways, a wide flat one is
 * stepped under. Both are measured against the region's own edges, which do
 * not move when the padding this returns is applied, so the answer is stable
 * rather than something that re-converges over a few frames.
 */
export function reservedInsets(
  boxes: FloatingBoxes,
  region: Edges,
  viewport: { width: number; height: number }
): Insets {
  const insets = { ...NO_INSETS }

  for (const corner of CORNERS) {
    const size = cornerBox(boxes, corner)
    if (!size) continue

    const card = stackEdges(corner, size, viewport)

    // Grown by the clearance on every side: a card a hair away from the grid
    // reads as badly as one on top of it.
    const overlapsX = card.right + FLOATING_GAP > region.left && card.left - FLOATING_GAP < region.right
    const overlapsY = card.bottom + FLOATING_GAP > region.top && card.top - FLOATING_GAP < region.bottom
    if (!overlapsX || !overlapsY) continue

    const horizontal = corner.endsWith("left")
      ? card.right + FLOATING_GAP - region.left
      : region.right - (card.left - FLOATING_GAP)
    const vertical = corner.startsWith("top")
      ? card.bottom + FLOATING_GAP - region.top
      : region.bottom - (card.top - FLOATING_GAP)

    if (horizontal <= vertical) {
      const side = corner.endsWith("left") ? "left" : "right"
      insets[side] = Math.max(insets[side], horizontal)
    } else {
      const side = corner.startsWith("top") ? "top" : "bottom"
      insets[side] = Math.max(insets[side], vertical)
    }
  }

  const limitX = Math.max(region.right - region.left, 0) * MOST_OF_A_SIDE
  const limitY = Math.max(region.bottom - region.top, 0) * MOST_OF_A_SIDE

  return {
    top: Math.min(insets.top, limitY),
    right: Math.min(insets.right, limitX),
    bottom: Math.min(insets.bottom, limitY),
    left: Math.min(insets.left, limitX),
  }
}
