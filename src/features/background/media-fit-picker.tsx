import { cn } from "@/lib/utils"

import type { MediaFit, MediaPosition } from "./types"

const FITS: { value: MediaFit; label: string }[] = [
  { value: "cover", label: "Fill" },
  { value: "contain", label: "Fit" },
  { value: "stretch", label: "Stretch" },
  { value: "center", label: "Center" },
]

const POSITIONS: { value: MediaPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Middle" },
  { value: "bottom", label: "Bottom" },
]

/** Tiny frame with a filled patch shaped like the fit mode it represents. */
function FitIcon({ fit }: { fit: MediaFit }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" stroke="currentColor" strokeWidth="1.5" />
      {fit === "cover" && (
        <rect x="2.5" y="2.5" width="19" height="19" rx="3" fill="currentColor" opacity="0.35" />
      )}
      {fit === "contain" && (
        <rect x="6" y="4" width="12" height="16" rx="1.5" fill="currentColor" opacity="0.35" />
      )}
      {fit === "stretch" && (
        <>
          <rect x="2.5" y="2.5" width="19" height="19" rx="3" fill="currentColor" opacity="0.35" />
          <path
            d="M2.5 8V4.5H6M21.5 8V4.5H18M2.5 16v3.5H6M21.5 16v3.5H18"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {fit === "center" && (
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.35" />
      )}
    </svg>
  )
}

/** Tiny frame with a band at the edge it anchors the crop to. */
function PositionIcon({ position }: { position: MediaPosition }) {
  const y = position === "top" ? 3.5 : position === "bottom" ? 15.5 : 9.5
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y={y} width="14" height="5" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

/** How an image/video background fills its layer — cover, contain, stretch or center. */
export function MediaFitPicker({
  value,
  onChange,
  position,
  onPositionChange,
  accentColor,
}: {
  value: MediaFit
  onChange: (fit: MediaFit) => void
  /** Crop anchor for `cover` — ignored, and its picker hidden, for every other fit. */
  position: MediaPosition
  onPositionChange: (position: MediaPosition) => void
  /** Selection ring colour, sampled from the picture itself. Falls back to the theme ring when absent. */
  accentColor?: string | null
}) {
  const ring = (active: boolean) =>
    cn(
      "grid place-items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      active && "text-foreground",
      active && !accentColor && "ring-[3px] ring-ring/50"
    )
  const glow = (active: boolean) =>
    active && accentColor ? { boxShadow: `0 0 0 3px ${accentColor}80` } : undefined

  return (
    <div className="flex items-center gap-1.5">
      {/* Only `cover` actually crops the picture, so only it needs an anchor. */}
      {value === "cover" && (
        <>
          <div className="flex gap-1">
            {POSITIONS.map(({ value: pos, label }) => (
              <button
                key={pos}
                type="button"
                onClick={() => onPositionChange(pos)}
                aria-label={label}
                aria-pressed={position === pos}
                title={label}
                style={glow(position === pos)}
                className={ring(position === pos)}
              >
                <PositionIcon position={pos} />
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
        </>
      )}

      {FITS.map(({ value: fit, label }) => (
        <button
          key={fit}
          type="button"
          onClick={() => onChange(fit)}
          aria-label={label}
          aria-pressed={value === fit}
          title={label}
          style={glow(value === fit)}
          className={ring(value === fit)}
        >
          <FitIcon fit={fit} />
        </button>
      ))}
    </div>
  )
}
