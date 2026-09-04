import { useState } from "react"
import { Plus, X } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useWeatherMetricsStore } from "@/features/weather/weather-metrics-store"
import { useWeatherStore } from "@/features/weather/weather-store"
import { CORNER_CLASSES } from "@/lib/corner"
import { cn } from "@/lib/utils"

import { useChecklistStore } from "./checklist-store"

// Clearance between the two cards when they end up stacked in one corner.
const STACK_GAP = 12

/**
 * Floating overlay, corner set in settings — same mechanism and the same
 * chrome-less treatment as the weather card: no card surface, just text and
 * icons sitting directly on the background, colored to follow its lightness.
 * Positioned independently by default; if a user still points both at the
 * same corner, this one steps aside: below the weather card in a top
 * corner, above it in a bottom corner, so neither one is covered.
 */
export function ChecklistCard() {
  const enabled = useChecklistStore((state) => state.enabled)
  const position = useChecklistStore((state) => state.position)
  const items = useChecklistStore((state) => state.items)
  const addItem = useChecklistStore((state) => state.addItem)
  const toggleItem = useChecklistStore((state) => state.toggleItem)
  const removeItem = useChecklistStore((state) => state.removeItem)

  const weatherEnabled = useWeatherStore((state) => state.enabled)
  const weatherPosition = useWeatherStore((state) => state.position)
  const weatherHeight = useWeatherMetricsStore((state) => state.height)

  const [draft, setDraft] = useState("")

  if (!enabled) return null

  function handleAdd() {
    addItem(draft)
    setDraft("")
  }

  const sharesCornerWithWeather = weatherEnabled && weatherPosition === position
  const stackOffset =
    sharesCornerWithWeather && weatherHeight != null ? weatherHeight + STACK_GAP : 0

  return (
    <div
      className={cn("fixed z-20 grid w-52 gap-2 text-foreground", CORNER_CLASSES[position])}
      style={
        stackOffset
          ? {
              transform: `translateY(${position.startsWith("top") ? stackOffset : -stackOffset}px)`,
            }
          : undefined
      }
    >
      <p className="text-xs text-muted-foreground">Checklist</p>

      {items.length > 0 && (
        <ul className="grid gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2">
              <Checkbox
                checked={item.done}
                onCheckedChange={() => toggleItem(item.id)}
                aria-label={item.text}
              />
              <span
                className={cn(
                  "flex-1 truncate text-sm",
                  item.done && "text-muted-foreground line-through"
                )}
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.text}`}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
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
