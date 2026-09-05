import { useEffect, useRef } from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { CORNER_CLASSES } from "@/lib/corner"

import { describeWeatherCode } from "./weather-codes"
import { useWeather } from "./use-weather"
import { useWeatherMetricsStore } from "./weather-metrics-store"
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
 * Floating overlay, corner set in settings. No card chromejust icon and
 * text, independent of the board layout above it.
 */
export function WeatherCard() {
  const enabled = useWeatherStore((state) => state.enabled)
  const position = useWeatherStore((state) => state.position)
  const weather = useWeather()
  const setHeight = useWeatherMetricsStore((state) => state.setHeight)

  const cardRef = useRef<HTMLDivElement>(null)

  // Reported so the checklist card can stack clear of this one when both
  // share a corner; re-measures itself whenever the content's height changes
  // (loading -> ready -> error, etc).
  useEffect(() => {
    const el = cardRef.current
    if (!enabled || !el) {
      setHeight(null)
      return
    }
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(el)
    return () => {
      observer.disconnect()
      setHeight(null)
    }
  }, [enabled, setHeight])

  if (!enabled) return null

  return (
    <div
      ref={cardRef}
      className={`glass-panel glass:px-2 glass:py-1.5 fixed z-20 flex justify-center ${CORNER_CLASSES[position]}`}
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
