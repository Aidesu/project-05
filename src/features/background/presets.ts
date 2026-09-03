import type { GradientSpec } from "./types"

/**
 * Layered blooms rather than a single linear ramp: the soft off-centre spots
 * are what keep a full-screen gradient from banding. Colours are hex so the
 * same values feed a native colour input in the editor.
 */
export const BUILT_IN_GRADIENTS: GradientSpec[] = [
  {
    id: "aurora",
    label: "Aurora",
    base: "#1b1b3a",
    blooms: [
      { color: "#4f6bed", x: 18, y: 22 },
      { color: "#a855f7", x: 82, y: 12 },
      { color: "#22d3ee", x: 62, y: 84 },
    ],
  },
  {
    id: "nebula",
    label: "Nebula",
    base: "#120b2e",
    blooms: [
      { color: "#7c3aed", x: 30, y: 30 },
      { color: "#db2777", x: 75, y: 20 },
      { color: "#2563eb", x: 55, y: 88 },
      { color: "#f472b6", x: 10, y: 70 },
    ],
  },
  {
    id: "ocean",
    label: "Ocean",
    base: "#04202e",
    blooms: [
      { color: "#0ea5e9", x: 22, y: 18 },
      { color: "#14b8a6", x: 78, y: 55 },
      { color: "#1d4ed8", x: 48, y: 92 },
    ],
  },
  {
    id: "sunset",
    label: "Sunset",
    base: "#2b1030",
    blooms: [
      { color: "#f59e0b", x: 12, y: 82 },
      { color: "#ef4444", x: 78, y: 70 },
      { color: "#8b5cf6", x: 55, y: 15 },
    ],
  },
  {
    id: "ember",
    label: "Ember",
    base: "#1a0f0a",
    blooms: [
      { color: "#ea580c", x: 70, y: 25 },
      { color: "#b91c1c", x: 25, y: 65 },
      { color: "#a16207", x: 90, y: 90 },
    ],
  },
  {
    id: "forest",
    label: "Forest",
    base: "#08201a",
    blooms: [
      { color: "#15803d", x: 28, y: 20 },
      { color: "#0f766e", x: 80, y: 48 },
      { color: "#65a30d", x: 45, y: 90 },
    ],
  },
  {
    id: "slate",
    label: "Slate",
    base: "#0f172a",
    blooms: [
      { color: "#475569", x: 30, y: 15 },
      { color: "#334155", x: 75, y: 60 },
    ],
  },
  {
    id: "noir",
    label: "Noir",
    base: "#050505",
    blooms: [
      { color: "#2a2a2a", x: 25, y: 25 },
      { color: "#1a1a1a", x: 80, y: 70 },
      { color: "#3a3a3a", x: 55, y: 95 },
    ],
  },
  {
    id: "mint",
    label: "Mint",
    base: "#eefbf4",
    blooms: [
      { color: "#6ee7b7", x: 25, y: 18 },
      { color: "#7dd3fc", x: 80, y: 45 },
      { color: "#bbf7d0", x: 45, y: 90 },
    ],
  },
  {
    id: "peach",
    label: "Peach",
    base: "#fff7ed",
    blooms: [
      { color: "#fed7aa", x: 20, y: 25 },
      { color: "#fecaca", x: 80, y: 30 },
      { color: "#fef3c7", x: 50, y: 95 },
    ],
  },
  {
    id: "candy",
    label: "Candy",
    base: "#fdf2f8",
    blooms: [
      { color: "#f9a8d4", x: 18, y: 20 },
      { color: "#a5b4fc", x: 82, y: 35 },
      { color: "#99f6e4", x: 50, y: 92 },
    ],
  },
  {
    id: "sand",
    label: "Sand",
    base: "#faf5ec",
    blooms: [
      { color: "#e7d3ae", x: 25, y: 22 },
      { color: "#d9c6a5", x: 78, y: 58 },
      { color: "#f0e3c9", x: 50, y: 95 },
    ],
  },
]

export const COLOR_SWATCHES = [
  "#0b0f19",
  "#1f2937",
  "#334155",
  "#065f46",
  "#7c2d12",
  "#4c1d95",
  "#e5e7eb",
  "#fafaf9",
]
