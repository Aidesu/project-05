import { useState, type CSSProperties } from "react"
import { GripHorizontal, Pencil } from "lucide-react"

import { hostnameOf } from "@/lib/url"
import { cn } from "@/lib/utils"

import type { Site } from "./types"
import { useSiteIconUrl } from "./use-site-icon"

/**
 * Everything dnd-kit needs wired into a bubble, handed down rather than taken
 * from a hook here: the library is loaded after the first paint (see
 * `sortable-site-list.tsx`), and a bubble has to render fully before it
 * arrives. Absent means "not draggable yet".
 */
export type SiteDragBinding = {
  setNodeRef: (node: HTMLElement | null) => void
  style: CSSProperties
  /** `attributes` and `listeners`, spread onto the grip. */
  handleProps: Record<string, unknown>
  isDragging: boolean
}

type SiteBubbleProps = {
  site: Site
  onEdit: (site: Site) => void
  drag?: SiteDragBinding
}

export function SiteBubble({ site, onEdit, drag }: SiteBubbleProps) {
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

  return (
    // dnd-kit owns the live reorder preview (transform/transition) and the
    // drop math; this component only wires a handle to it, it doesn't
    // implement any reordering itself.
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        "group grid w-18 justify-items-center gap-0.5 rounded-2xl",
        drag?.isDragging && "z-10 opacity-40"
      )}
    >
      <div className="relative">
        <a
          href={site.url}
          rel="noreferrer"
          draggable={false}
          title={hostnameOf(site.url)}
          className={cn(
            "glass-control grid size-[60px] place-items-center rounded-full transition-[transform,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            // Lifts under the pointer the way a dock icon does, over a faint
            // disc so there is something to lift. Under glass the disc is
            // already there and brightens instead (`index.css`).
            "hover:-translate-y-0.5 hover:scale-105 hover:bg-foreground/8 active:translate-y-0 active:scale-100",
            // A loaded favicon carries its own edgesonly the fallback
            // initial needs a border to read as a button.
            faviconFailed && "border hover:border-foreground/30"
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
                width={34}
                height={34}
                loading="lazy"
                // The favicon provider gets the hostname it needs and nothing
                // else, not the extension's own address.
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setFaviconFailed(true)}
                className="size-[34px] rounded"
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
          className="glass-control absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover:opacity-100"
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
        {...drag?.handleProps}
        aria-label={`Reorder ${site.title}`}
        className={cn(
          "grid size-3.5 touch-none cursor-grab place-items-center rounded text-muted-foreground/70 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing group-hover:opacity-100",
          // Hidden rather than dropped in the moment before dnd-kit lands, so
          // the reserved space stays and nothing shifts when it arrives.
          !drag && "invisible"
        )}
      >
        <GripHorizontal className="size-3.5" />
      </button>
    </div>
  )
}
