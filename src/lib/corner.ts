/** Declared as a list so a config file can be checked against it. */
export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const

export type Corner = (typeof CORNERS)[number]

/**
 * The two insets `CORNER_CLASSES` places a card at, in px. Exported beside the
 * classes rather than read back off the DOM: anything that has to keep out of
 * a floating card's way (`@/features/floating`) works out where the card is
 * from the same two numbers the layout puts it there with, so the geometry and
 * the classes can never drift apart.
 */
export const CORNER_EDGE = 24
export const CORNER_TOP = 80

// Top corners sit below the header; bottom corners just clear the edge.
export const CORNER_CLASSES: Record<Corner, string> = {
  "top-left": "top-20 left-6",
  "top-right": "top-20 right-6",
  "bottom-left": "bottom-6 left-6",
  "bottom-right": "bottom-6 right-6",
}
