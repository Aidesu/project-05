import { useRef, useState } from "react"
import { Plus, X } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useFloatingCard } from "@/features/floating/use-floating-card"
import { CORNER_CLASSES } from "@/lib/corner"
import { cn } from "@/lib/utils"

import { useChecklistStore } from "./checklist-store"
import type { ChecklistItem } from "./types"

/**
 * One line of the list, reading or being reworded.
 *
 * The text is a button, so a typo is fixed where it is rather than by deleting
 * the item and typing it again. Each row keeps its own draft: clicking another
 * row blurs this one, which is what puts it away, so only ever one row is open.
 */
function ChecklistRow({
  item,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: ChecklistItem
  onToggle: () => void
  onEdit: (text: string) => void
  onRemove: () => void
}) {
  /** The text being edited, `null` while the row is only being read: one piece
   * of state rather than a flag beside a value that means nothing without it. */
  const [draft, setDraft] = useState<string | null>(null)
  /** Set by Escape, read by the blur that Escape itself causes. */
  const cancelled = useRef(false)

  return (
    <li className="group flex min-w-0 items-start gap-2">
      <Checkbox
        checked={item.done}
        onCheckedChange={onToggle}
        aria-label={item.text}
        className="mt-0.5"
      />

      {draft === null ? (
        <>
          <button
            type="button"
            onClick={() => setDraft(item.text)}
            aria-label={`Edit ${item.text}`}
            className={cn(
              "min-w-0 flex-1 cursor-text rounded-sm text-left text-sm wrap-anywhere transition-opacity hover:opacity-70",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              item.done && "text-muted-foreground line-through"
            )}
          >
            {item.text}
          </button>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.text}`}
            className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // Both keys leave by the same door: the blur below is the one place
          // an edit is kept or dropped, so there is no second path to keep in
          // step with it. Clicking away lands there too, and keeps the edit.
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
            else if (event.key === "Escape") {
              cancelled.current = true
              event.currentTarget.blur()
            }
          }}
          onBlur={() => {
            if (!cancelled.current) onEdit(draft)
            cancelled.current = false
            setDraft(null)
          }}
          autoFocus
          aria-label={`Edit ${item.text}`}
          className="h-6 flex-1 px-1.5 py-0 text-sm shadow-none"
        />
      )}
    </li>
  )
}

/**
 * Floating overlay, corner set in settings, same mechanism and the same
 * chrome-less treatment as the weather card: no card surface, just text and
 * icons sitting directly on the background, colored to follow its lightness.
 * Positioned independently by default; if a user still points several cards at
 * the same corner, they queue rather than pile up: `useFloatingCard` puts this
 * one after the weather card and the player, below them in a top corner and
 * above them in a bottom one, so none of them is covered.
 */
export function ChecklistCard() {
  const enabled = useChecklistStore((state) => state.enabled)
  const position = useChecklistStore((state) => state.position)
  const items = useChecklistStore((state) => state.items)
  const addItem = useChecklistStore((state) => state.addItem)
  const editItem = useChecklistStore((state) => state.editItem)
  const toggleItem = useChecklistStore((state) => state.toggleItem)
  const removeItem = useChecklistStore((state) => state.removeItem)

  const { ref, style } = useFloatingCard("checklist", position, enabled)

  const [draft, setDraft] = useState("")

  if (!enabled) return null

  function handleAdd() {
    addItem(draft)
    setDraft("")
  }

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "glass-panel glass:p-3 fixed z-20 grid w-[min(17.5rem,calc(100vw-3rem))] gap-2 text-foreground",
        CORNER_CLASSES[position]
      )}
    >
      <p className="text-xs text-muted-foreground">Checklist</p>

      {/* `min-w-0` down the chain: a grid item is `min-width: auto`, so without
          it a row grows to fit its widest word and takes the card (fixed to a
          corner, so straight off the screen) with it. */}
      {items.length > 0 && (
        <ul className="grid min-w-0 gap-1.5">
          {items.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={() => toggleItem(item.id)}
              onEdit={(text) => editItem(item.id, text)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && handleAdd()}
          placeholder="Add an item…"
          className="h-8 bg-transparent text-sm shadow-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          aria-label="Add item"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
