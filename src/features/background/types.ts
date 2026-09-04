/** Where the bytes of an image or video come from. */
export type MediaSource =
  | { type: "url"; url: string }
  | { type: "upload"; assetId: string }

/** One soft off-centre colour bloom, positioned in percent of the viewport. */
export type GradientBloom = { color: string; x: number; y: number }

/**
 * A gradient is stored as data rather than a CSS string, so the built-in
 * presets and a hand-made one are the same thing and both stay editable.
 */
export type GradientSpec = {
  id: string
  label: string
  base: string
  blooms: GradientBloom[]
}

export type Background =
  | { kind: "none" }
  | { kind: "color"; color: string }
  | { kind: "gradient"; preset: string }
  | { kind: "image"; source: MediaSource }
  | { kind: "video"; source: MediaSource }

export type BackgroundKind = Background["kind"]

/** Visual filters applied to an image or video background, on top of the scrim. */
export type MediaEffects = {
  /** Gaussian blur, in px. */
  blur: number
  /** Dark scrim opacity, in percent — keeps text legible over busy media. */
  dim: number
  /** Desaturation, in percent. 0 is full colour, 100 is fully grayscale. */
  grayscale: number
  /** Colour intensity, in percent. 100 is unchanged, 0 drains it, 200 is vivid. */
  saturate: number
}

export const DEFAULT_MEDIA_EFFECTS: MediaEffects = {
  blur: 0,
  dim: 50,
  grayscale: 0,
  saturate: 100,
}

/**
 * How an image or video fills its layer — the same idea as `object-fit`,
 * named for what it looks like rather than the CSS keyword.
 */
export type MediaFit = "cover" | "contain" | "stretch" | "center"

export const DEFAULT_MEDIA_FIT: MediaFit = "cover"

/**
 * Vertical crop anchor for `cover` — which edge of the picture survives
 * being cropped to fill the layer.
 */
export type MediaPosition = "top" | "center" | "bottom"

export const DEFAULT_MEDIA_POSITION: MediaPosition = "center"

/** The IndexedDB asset a background holds, when it holds one. */
export function assetIdOf(background: Background): string | null {
  if (background.kind !== "image" && background.kind !== "video") return null
  return background.source.type === "upload" ? background.source.assetId : null
}
