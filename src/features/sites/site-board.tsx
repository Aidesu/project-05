import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

import { SiteBubble } from "./site-bubble"
import { SiteFormDialog } from "./site-form-dialog"
import { useSitesStore } from "./sites-store"
import type { Site } from "./types"

export function SiteBoard() {
  const sites = useSitesStore((state) => state.sites)

  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Site | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  const tags = useMemo(
    () => [...new Set(sites.flatMap((site) => site.tags))].sort(),
    [sites]
  )

  // A tag no site carries any more (last card deleted, tag renamed) would
  // filter the board down to nothing, so it is ignored rather than corrected.
  const effectiveTag = activeTag !== null && tags.includes(activeTag) ? activeTag : null

  // Filtering is derived at render time, never stored: one source of truth.
  // A hidden site only ever shows up once its own tag is the active filter
  // selecting a tag already restricts to matching sites, so nothing extra is
  // needed there.
  const visibleSites = useMemo(
    () =>
      effectiveTag
        ? sites.filter((site) => site.tags.includes(effectiveTag))
        : sites.filter((site) => !site.hidden),
    [sites, effectiveTag]
  )

  function openAdd() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(site: Site) {
    setEditing(site)
    setDialogOpen(true)
  }

  return (
    <div className="grid gap-8">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {tags.map((tag) => (
            <Button
              key={tag}
              size="xs"
              variant={effectiveTag === tag ? "default" : "secondary"}
              onClick={() => setActiveTag(effectiveTag === tag ? null : tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        {/* Sites are the only in-flow content herethe centering above is
            theirs alone. Add sits outside that flow (absolute), so it never
            shifts where the sites themselves land. */}
        <div className="group/sites relative flex min-h-20 flex-wrap items-start gap-4">
          {visibleSites.map((site) => (
            <SiteBubble key={site.id} site={site} onEdit={openEdit} />
          ))}

          {/* Hidden until the section is hoveredfocus-within too, so it
              stays reachable by keyboard. */}
          <div className="absolute top-0 left-full ml-6 grid w-24 justify-items-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/sites:opacity-100">
            <button
              type="button"
              onClick={openAdd}
              aria-label="Add a site"
              className="grid size-20 place-items-center rounded-full border border-dashed text-2xl leading-none text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              +
            </button>
            <span className="w-full truncate text-center text-xs text-muted-foreground">
              Add
            </span>
          </div>
        </div>
      </div>

      {sites.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No sites yetadd your first address with the button above.
        </p>
      )}

      <SiteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} site={editing} />
    </div>
  )
}
