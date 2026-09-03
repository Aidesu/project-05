import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Section } from "@/features/settings/section"

import { geocodeCity } from "./weather-api"
import { useWeatherStore } from "./weather-store"
import type { LocationMode } from "./types"

const MODES: { value: LocationMode; label: string }[] = [
  { value: "geo", label: "My location" },
  { value: "manual", label: "A city" },
]

export function WeatherSettings() {
  const enabled = useWeatherStore((state) => state.enabled)
  const locationMode = useWeatherStore((state) => state.locationMode)
  const manualLocation = useWeatherStore((state) => state.manualLocation)
  const setEnabled = useWeatherStore((state) => state.setEnabled)
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
