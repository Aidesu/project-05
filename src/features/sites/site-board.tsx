import { useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { Eye } from "lucide-react"

import { Button } from "@/components/ui/button"

import { SiteBubble } from "./site-bubble"
import { SiteFormDialog } from "./site-form-dialog"
import { useSitesStore } from "./sites-store"
import type { Site } from "./types"

// Not a real tag: no site ever carries it, so it can't collide with one a
// user types. Selecting it bypasses the hidden filter entirely.
const ALL_FILTER = "__all__"

export function SiteBoard() {
  const sites = useSitesStore((state) => state.sites)
  const reorderSite = useSitesStore((state) => state.reorderSite)

  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Site | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  // A short activation distance keeps ordinary clicks (opening a site,
  // pressing edit) from being swallowed as an accidental drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const tags = useMemo(
    () => [...new Set(sites.flatMap((site) => site.tags))].sort(),
    [sites]
  )

  // A tag no site carries any more (last card deleted, tag renamed) would
  // filter the board down to nothing, so it is ignored rather than corrected.
  const effectiveTag =
    activeTag !== null && (activeTag === ALL_FILTER || tags.includes(activeTag))
      ? activeTag
      : null

  // Filtering is derived at render time, never stored: one source of truth.
  // A hidden site only ever shows up once its own tag is the active filter,
  // or once "All" is selected, which shows every site unfiltered.
  const visibleSites = useMemo(() => {
    if (effectiveTag === ALL_FILTER) return sites
    if (effectiveTag) return sites.filter((site) => site.tags.includes(effectiveTag))
    return sites.filter((site) => !site.hidden)
  }, [sites, effectiveTag])

  function openAdd() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(site: Site) {
    setEditing(site)
    setDialogOpen(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderSite(String(active.id), String(over.id))
    }
  }

  return (
    <div className="grid gap-4">
      {(tags.length > 0 || sites.some((site) => site.hidden)) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Button
            size="xs"
            variant={effectiveTag === ALL_FILTER ? "default" : "outline"}
            className="gap-1"
            onClick={() => setActiveTag(effectiveTag === ALL_FILTER ? null : ALL_FILTER)}
          >
            <Eye className="size-3" />
            All
          </Button>
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

      {sites.length === 0 ? (
        // Nothing to hide the button behindit's the only thing here, so it
        // stays front and centre instead of waiting on a hover.
        <div className="grid justify-items-center gap-2">
          <button
            type="button"
            onClick={openAdd}
            aria-label="Add a site"
            className="grid size-[54px] place-items-center rounded-full border border-dashed text-2xl leading-none text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            +
          </button>
          <p className="text-center text-sm text-muted-foreground">Add your first site.</p>
        </div>
      ) : (
        <div className="flex justify-center">
          {/* Sites are the only in-flow content herethe centering above is
              theirs alone. Add sits outside that flow (absolute), so it never
              shifts where the sites themselves land. */}
          <div className="group/sites relative flex min-h-20 flex-wrap items-start gap-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleSites.map((site) => site.id)}
                strategy={rectSortingStrategy}
              >
                {visibleSites.map((site) => (
                  <SiteBubble key={site.id} site={site} onEdit={openEdit} />
                ))}
              </SortableContext>
            </DndContext>

            {/* Hidden until the section is hoveredfocus-within too, so it
                stays reachable by keyboard. */}
            <div className="absolute top-0 left-full ml-6 grid w-20 justify-items-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/sites:opacity-100">
              <button
                type="button"
                onClick={openAdd}
                aria-label="Add a site"
                className="grid size-[54px] place-items-center rounded-full border border-dashed text-2xl leading-none text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                +
              </button>
              <span className="w-full truncate text-center text-xs text-muted-foreground">
                Add
              </span>
            </div>
          </div>
        </div>
      )}

      <SiteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} site={editing} />
    </div>
  )
}
