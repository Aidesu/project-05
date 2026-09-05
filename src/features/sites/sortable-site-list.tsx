import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { SiteBubble } from "./site-bubble"
import type { Site } from "./types"

/**
 * Every part of the board that needs dnd-kit, in the one module that imports
 * it. Nothing here is on screen at first paint — the grip only appears on
 * hover — so `site-board.tsx` loads this once the page is idle rather than
 * making a new tab parse a drag-and-drop library before it can show anything.
 */

function SortableSiteBubble({ site, onEdit }: { site: Site; onEdit: (site: Site) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: site.id,
  })

  return (
    <SiteBubble
      site={site}
      onEdit={onEdit}
      drag={{
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        handleProps: { ...attributes, ...listeners },
        isDragging,
      }}
    />
  )
}

export default function SortableSiteList({
  sites,
  onEdit,
  onReorder,
}: {
  sites: Site[]
  onEdit: (site: Site) => void
  onReorder: (activeId: string, overId: string) => void
}) {
  // A short activation distance keeps ordinary clicks (opening a site,
  // pressing edit) from being swallowed as an accidental drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sites.map((site) => site.id)} strategy={rectSortingStrategy}>
        {sites.map((site) => (
          <SortableSiteBubble key={site.id} site={site} onEdit={onEdit} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
