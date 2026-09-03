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
  const visibleSites = useMemo(
    () => (effectiveTag ? sites.filter((site) => site.tags.includes(effectiveTag)) : sites),
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
    <div className="grid gap-6">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
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

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid w-20 justify-items-center gap-2">
          <button
            type="button"
            onClick={openAdd}
            aria-label="Ajouter un site"
            className="grid size-16 place-items-center rounded-full border border-dashed text-2xl leading-none text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            +
          </button>
          <span className="w-full truncate text-center text-xs text-muted-foreground">
            Ajouter
          </span>
        </div>

        {visibleSites.map((site) => (
          <SiteBubble key={site.id} site={site} onEdit={openEdit} />
        ))}
      </div>

      {sites.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun site pour l&apos;instant — ajoutez une première adresse avec le bouton ci-dessus.
        </p>
      )}

      <SiteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} site={editing} />
    </div>
  )
}
