import { useState } from "react"
import { Pencil } from "lucide-react"

import { faviconUrl, hostnameOf } from "@/lib/url"
import { cn } from "@/lib/utils"

import type { Site } from "./types"

type SiteBubbleProps = {
  site: Site
  onEdit: (site: Site) => void
}

export function SiteBubble({ site, onEdit }: SiteBubbleProps) {
  const [faviconFailed, setFaviconFailed] = useState(false)

  return (
    <div className="group grid w-24 justify-items-center">
      <div className="relative">
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer noopener"
          title={hostnameOf(site.url)}
          className={cn(
            "grid size-20 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
            <img
              src={faviconUrl(site.url)}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              onError={() => setFaviconFailed(true)}
              className="size-9 rounded"
            />
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
    </div>
  )
}
