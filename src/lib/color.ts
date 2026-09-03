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

/** WCAG relative luminance (0 = black, 1 = white) from sRGB channels. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** Whether text sitting on this hex colour should be dark to stay readable. */
export function isLightColor(hex: string): boolean {
  return relativeLuminance(hexToRgb(hex)) > 0.5
}
