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

/** The IndexedDB asset a background holds, when it holds one. */
export function assetIdOf(background: Background): string | null {
  if (background.kind !== "image" && background.kind !== "video") return null
  return background.source.type === "upload" ? background.source.assetId : null
}
