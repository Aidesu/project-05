import { useState } from "react"
import { Pencil } from "lucide-react"

import { faviconUrl, hostnameOf } from "@/lib/url"

import type { Site } from "./types"

type SiteBubbleProps = {
  site: Site
  onEdit: (site: Site) => void
}

export function SiteBubble({ site, onEdit }: SiteBubbleProps) {
  const [faviconFailed, setFaviconFailed] = useState(false)

  return (
    <div className="group grid w-20 justify-items-center gap-2">
      <div className="relative">
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer noopener"
          title={hostnameOf(site.url)}
          className="grid size-16 place-items-center rounded-full border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {faviconFailed ? (
            <span className="text-lg font-semibold uppercase text-muted-foreground">
              {site.title.charAt(0)}
            </span>
          ) : (
            <img
              src={faviconUrl(site.url)}
              alt=""
              width={28}
              height={28}
              loading="lazy"
              onError={() => setFaviconFailed(true)}
              className="size-7 rounded"
            />
          )}
        </a>

        {/* Revealed on hover, but also on keyboard focus — hover-only would put
            editing out of reach without a mouse. */}
        <button
          type="button"
          onClick={() => onEdit(site)}
          aria-label={`Modifier ${site.title}`}
          className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover:opacity-100"
        >
          <Pencil className="size-3" />
        </button>
      </div>

      <span className="w-full truncate text-center text-xs text-muted-foreground">
        {site.title}
      </span>
    </div>
  )
}
