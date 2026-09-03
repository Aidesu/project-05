export type Rgb = { r: number; g: number; b: number }

/** Parses "#rgb" or "#rrggbb"; falls back to black rather than throwing. */
export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim()
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean

  if (full.length !== 6) return { r: 0, g: 0, b: 0 }
  const value = Number.parseInt(full, 16)
  if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 }

  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")

  return `#${channel(r)}${channel(g)}${channel(b)}`
}
