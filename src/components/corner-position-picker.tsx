import type { Corner } from "@/lib/corner"
import { cn } from "@/lib/utils"

const CORNERS: { value: Corner; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
]

/** Tiny screen outline with a filled dot in the corner it represents: the
 * selector's own preview, not a stock icon. */
function CornerIcon({ corner }: { corner: Corner }) {
  const isTop = corner.startsWith("top")
  const isLeft = corner.endsWith("left")

  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x={isLeft ? 5 : 14} y={isTop ? 5 : 14} width="5" height="5" rx="1.25" fill="currentColor" />
    </svg>
  )
}

/** Shared corner picker for any floating widget (weather, checklist, …). */
export function CornerPositionPicker({
  value,
  onChange,
}: {
  value: Corner
  onChange: (corner: Corner) => void
}) {
  return (
    <div className="flex gap-1.5">
      {CORNERS.map(({ value: corner, label }) => (
        <button
          key={corner}
          type="button"
          onClick={() => onChange(corner)}
          aria-label={label}
          aria-pressed={value === corner}
          title={label}
          className={cn(
            "grid place-items-center rounded-md border-2 p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === corner ? "border-primary text-foreground" : "border-transparent"
          )}
        >
          <CornerIcon corner={corner} />
        </button>
      ))}
    </div>
  )
}
