import type { CSSProperties } from "react"

import { useBackgroundStore } from "./background-store"
import { GradientSurface } from "./gradient-surface"
import { useMediaSrc } from "./use-media-src"
import type { MediaFit } from "./types"

/** `background-size` for each fit mode, `object-fit` shares the same keywords bar `stretch`. */
const BACKGROUND_SIZE: Record<MediaFit, string> = {
  cover: "cover",
  contain: "contain",
  stretch: "100% 100%",
  center: "auto",
}
const OBJECT_FIT: Record<MediaFit, CSSProperties["objectFit"]> = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "none",
}

export function BackgroundLayer() {
  const background = useBackgroundStore((state) => state.background)
  const gradients = useBackgroundStore((state) => state.gradients)
  const gradientAnimated = useBackgroundStore((state) => state.gradientAnimated)
  const mediaEffects = useBackgroundStore((state) => state.mediaEffects)
  const mediaFit = useBackgroundStore((state) => state.mediaFit)
  const mediaPosition = useBackgroundStore((state) => state.mediaPosition)
  const src = useMediaSrc(background)

  if (background.kind === "none") return null

  const gradient =
    background.kind === "gradient"
      ? gradients.find((candidate) => candidate.id === background.preset)
      : undefined
  const isMedia = background.kind === "image" || background.kind === "video"
  const filter = isMedia
    ? `blur(${mediaEffects.blur}px) grayscale(${mediaEffects.grayscale}%) saturate(${mediaEffects.saturate}%)`
    : undefined
  // Only `cover` bleeds past every edge, so it's the only mode that needs the
  // extra scale to keep a blur radius from showing the layer's own edge.
  const scaleForBlur = mediaFit === "cover" ? "scale-110" : ""
  // Only meaningful once `cover` has actually cropped something.
  const anchor = mediaFit === "cover" ? mediaPosition : "center"

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {background.kind === "color" && (
        <div className="size-full" style={{ backgroundColor: background.color }} />
      )}

      {gradient && (
        <GradientSurface spec={gradient} animated={gradientAnimated} className="size-full" />
      )}

      {background.kind === "image" && src && (
        <div
          className={`size-full bg-no-repeat ${scaleForBlur}`}
          style={{
            backgroundImage: `url("${src}")`,
            backgroundSize: BACKGROUND_SIZE[mediaFit],
            backgroundPosition: `center ${anchor}`,
            filter,
          }}
        />
      )}

      {background.kind === "video" && src && (
        // `key` forces a reload when the source changes<video> ignores a
        // plain src swap once it has started buffering.
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className={`size-full ${scaleForBlur}`}
          style={{ objectFit: OBJECT_FIT[mediaFit], objectPosition: `center ${anchor}`, filter }}
        />
      )}

      {/* Photos and video carry their own contrast; a scrim keeps the board
          legible over whatever the person picked. */}
      {isMedia && (
        <div className="absolute inset-0 bg-background" style={{ opacity: mediaEffects.dim / 100 }} />
      )}
    </div>
  )
}
