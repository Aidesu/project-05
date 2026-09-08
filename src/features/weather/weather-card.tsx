import { Loader2, RefreshCw } from "lucide-react"

import { useFloatingCard } from "@/features/floating/use-floating-card"
import { cn } from "@/lib/utils"

import { describeWeatherCode } from "./weather-codes"
import { useWeather } from "./use-weather"
import { useWeatherStore } from "./weather-store"
import type { WeatherSnapshot } from "./types"

function WeatherReady({ data, onRefresh }: { data: WeatherSnapshot; onRefresh: () => void }) {
  const { label: description, Icon } = describeWeatherCode(data.code, data.isDay)

  return (
    <button
      type="button"
      onClick={onRefresh}
      aria-label="Refresh weather"
      className="grid justify-items-center gap-1 rounded-lg px-3 py-1 text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-center gap-3">
        <Icon className="size-8" />
        <p className="text-2xl leading-none font-semibold">{Math.round(data.temperature)}°</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {description} · Feels like {Math.round(data.feelsLike)}°
      </p>
    </button>
  )
}

/**
 * Floating overlay, corner set in settings. No card chrome - just icon and
 * text, independent of the board layout above it. On a compact page it gives
 * the corner back and sits at the top of the dock instead (`card-dock.tsx`),
 * where it keeps its natural width and is centred by the dock.
 */
export function WeatherCard() {
  const enabled = useWeatherStore((state) => state.enabled)
  const display = useWeatherStore((state) => state.display)
  const position = useWeatherStore((state) => state.position)
  const weather = useWeather("card")

  // The corner is only this card's while the card is the chosen surface: shown
  // in the header instead, it gives the corner back rather than reserving room
  // for something that is no longer there (`weather-compact.tsx`).
  const visible = enabled && display === "card"

  // Its size goes to `@/features/floating`, which is what lets the other
  // corner cards stack clear of it and the news feed leave its corner alone.
  // Re-measured whenever the content's height changes (loading -> ready ->
  // error, and back).
  const { ref, style, placement } = useFloatingCard("weather", position, visible)

  if (!visible) return null

  return (
    <div
      ref={ref}
      style={style}
      className={cn("glass-panel glass:px-2 glass:py-1.5 flex justify-center", placement)}
    >
      {(weather.status === "locating" || weather.status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading weather…
        </div>
      )}

      {weather.status === "error" && (
        <button
          type="button"
          onClick={weather.refresh}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-opacity hover:opacity-80"
        >
          <RefreshCw className="size-3.5" />
          {weather.message}
        </button>
      )}

      {weather.status === "ready" && <WeatherReady data={weather.data} onRefresh={weather.refresh} />}
    </div>
  )
}
