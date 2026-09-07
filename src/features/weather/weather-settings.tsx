import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { CornerPositionPicker } from "@/components/corner-position-picker"
import { Section } from "@/features/settings/section"

import { geocodeCity } from "./weather-api"
import { useWeatherStore } from "./weather-store"
import type { LocationMode, WeatherDisplay } from "./types"

const MODES: { value: LocationMode; label: string }[] = [
  { value: "geo", label: "My location" },
  { value: "manual", label: "A city" },
]

const DISPLAYS: { value: WeatherDisplay; label: string }[] = [
  { value: "card", label: "Floating card" },
  { value: "header", label: "In the header" },
]

export function WeatherSettings() {
  const enabled = useWeatherStore((state) => state.enabled)
  const display = useWeatherStore((state) => state.display)
  const position = useWeatherStore((state) => state.position)
  const locationMode = useWeatherStore((state) => state.locationMode)
  const manualLocation = useWeatherStore((state) => state.manualLocation)
  const setEnabled = useWeatherStore((state) => state.setEnabled)
  const setDisplay = useWeatherStore((state) => state.setDisplay)
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
    <Section
      title="Weather"
      hint="The current conditions, either as a floating card or as one line beside the settings gear."
    >
      <div className="flex items-center justify-between">
        <span className="text-sm">Show the weather</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Show the weather" />
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {DISPLAYS.map(({ value, label }) => (
              <Button
                key={value}
                variant={display === value ? "default" : "secondary"}
                size="sm"
                onClick={() => setDisplay(value)}
                aria-pressed={display === value}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* The header line has one spot and it is not a corner, so the
              picker belongs to the card alone. The corner it is set to is
              kept either way, and is waiting where it was left. */}
          {display === "card" && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Position</span>
              <CornerPositionPicker value={position} onChange={setPosition} />
            </div>
          )}

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
            <p className="text-xs text-muted-foreground">
              Search for a city to see the weather.
            </p>
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
