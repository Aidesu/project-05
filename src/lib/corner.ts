export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

// Top corners sit below the header; bottom corners just clear the edge.
export const CORNER_CLASSES: Record<Corner, string> = {
  "top-left": "top-20 left-6",
  "top-right": "top-20 right-6",
  "bottom-left": "bottom-6 left-6",
  "bottom-right": "bottom-6 right-6",
}
