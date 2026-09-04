import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripHorizontal, Pencil } from "lucide-react"

import { hostnameOf } from "@/lib/url"
import { cn } from "@/lib/utils"

import type { Site } from "./types"
import { useSiteIconUrl } from "./use-site-icon"

type SiteBubbleProps = {
  site: Site
  onEdit: (site: Site) => void
}

export function SiteBubble({ site, onEdit }: SiteBubbleProps) {
  const iconSrc = useSiteIconUrl(site.icon, site.url)
  const [faviconFailed, setFaviconFailed] = useState(false)

  // A bubble stays mounted (keyed by site.id) across edits, so a fresh icon
  // deserves a fresh chance rather than staying stuck on a past failure.
  // Adjusted during render rather than in an effect, per the React docs'
  // "storing information from previous renders" pattern.
  const [trackedSrc, setTrackedSrc] = useState(iconSrc)
  if (iconSrc !== trackedSrc) {
    setTrackedSrc(iconSrc)
    setFaviconFailed(false)
  }

  // dnd-kit owns the live reorder preview (transform/transition) and the
  // drop math; this component only wires a handle to it, it doesn't
  // implement any reordering itself.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: site.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group grid w-20 justify-items-center gap-0.5 rounded-2xl",
        isDragging && "z-10 opacity-40"
      )}
    >
      <div className="relative">
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer noopener"
          draggable={false}
          title={hostnameOf(site.url)}
          className={cn(
            "grid size-[54px] place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            // A loaded favicon carries its own edgesonly the fallback
            // initial needs a border to read as a button.
            faviconFailed ? "border hover:border-foreground/30" : "hover:opacity-80"
          )}
        >
          {faviconFailed ? (
            <span className="text-xl font-semibold uppercase text-muted-foreground">
              {site.title.charAt(0)}
            </span>
          ) : (
            iconSrc && (
              <img
                src={iconSrc}
                alt=""
                width={38}
                height={38}
                loading="lazy"
                draggable={false}
                onError={() => setFaviconFailed(true)}
                className="size-[38px] rounded"
              />
            )
          )}
        </a>

        {/* Revealed on hover, but also on keyboard focushover-only would put
            editing out of reach without a mouse. */}
        <button
          type="button"
          onClick={() => onEdit(site)}
          aria-label={`Edit ${site.title}`}
          className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover:opacity-100"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {/* The actual drag source, below the centered iconno background, so
          it stays out of the way until you're looking for it. The space is
          reserved even when invisible, so its fade-in on hover doesn't push
          neighbouring bubbles around. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${site.title}`}
        className="grid size-3.5 touch-none cursor-grab place-items-center rounded text-muted-foreground/70 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing group-hover:opacity-100"
      >
        <GripHorizontal className="size-3.5" />
      </button>
    </div>
  )
}
