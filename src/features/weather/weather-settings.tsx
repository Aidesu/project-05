import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Section } from "@/features/settings/section"
import { cn } from "@/lib/utils"

import { geocodeCity } from "./weather-api"
import { useWeatherStore } from "./weather-store"
import type { LocationMode, WeatherPosition } from "./types"

const MODES: { value: LocationMode; label: string }[] = [
  { value: "geo", label: "My location" },
  { value: "manual", label: "A city" },
]

const POSITIONS: { value: WeatherPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
]

/** Tiny screen outline with a filled dot in the corner it representsthe
 * selector's own preview, not a stock icon. */
function CornerIcon({ position }: { position: WeatherPosition }) {
  const isTop = position.startsWith("top")
  const isLeft = position.endsWith("left")

  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <rect x={isLeft ? 5 : 14} y={isTop ? 5 : 14} width="5" height="5" rx="1.25" fill="currentColor" />
    </svg>
  )
}

export function WeatherSettings() {
  const enabled = useWeatherStore((state) => state.enabled)
  const position = useWeatherStore((state) => state.position)
  const locationMode = useWeatherStore((state) => state.locationMode)
  const manualLocation = useWeatherStore((state) => state.manualLocation)
  const setEnabled = useWeatherStore((state) => state.setEnabled)
  const setPosition = useWeatherStore((state) => state.setPosition)
  const setLocationMode = useWeatherStore((state) => state.setLocationMode)
  const setManualLocation = useWeatherStore((state) => state.setManualLocation)

  const [query, setQuery] = useState(manualLocation?.label ?? "")
  const [searching, setSearching] = useState(false)

  async function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed) return

    setSearching(true)
    try {
      const found = await geocodeCity(trimmed)
      if (!found) {
        toast.error("City not found.")
        return
      }
      setManualLocation(found)
      setQuery(found.label)
      toast.success(`Saved: ${found.label}`)
    } catch {
      toast.error("City search is unavailable right now.")
    } finally {
      setSearching(false)
    }
  }

  return (
    <Section title="Weather" hint="A floating card with the current conditions.">
      <div className="flex items-center justify-between">
        <span className="text-sm">Show the weather card</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Show the weather card" />
      </div>

      {enabled && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm">Position</span>
            <div className="flex gap-1.5">
              {POSITIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPosition(value)}
                  aria-label={label}
                  aria-pressed={position === value}
                  title={label}
                  className={cn(
                    "grid place-items-center rounded-md border-2 p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    position === value ? "border-primary text-foreground" : "border-transparent"
                  )}
                >
                  <CornerIcon position={value} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ value, label }) => (
              <Button
                key={value}
                variant={locationMode === value ? "default" : "secondary"}
                size="sm"
                onClick={() => setLocationMode(value)}
                aria-pressed={locationMode === value}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              placeholder={
                locationMode === "manual" ? "Paris, Tokyo…" : "Fallback city (optional)"
              }
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={handleSearch}
              disabled={searching}
              aria-label="Search"
            >
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>

          {locationMode === "manual" && !manualLocation && (
            <p className="text-xs text-muted-foreground">Search for a city to enable the card.</p>
          )}
          {locationMode === "geo" && manualLocation && (
            <p className="text-xs text-muted-foreground">
              Used if location access is denied or unavailable.
            </p>
          )}
        </>
      )}
    </Section>
  )
}
