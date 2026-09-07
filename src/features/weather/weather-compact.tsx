import { CloudOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import { describeWeatherCode } from "./weather-codes"
import { useWeather } from "./use-weather"
import { useWeatherStore } from "./weather-store"

/**
 * The weather as one pill in the header, beside the gear: the condition's icon
 * and the temperature, and nothing else.
 *
 * The alternative to the floating card rather than an addition to it. Both
 * read the same store and only the chosen one renders, so only one of them is
 * ever fetching (`use-weather.ts`).
 *
 * Everything the card spells out - the description, the feels-like, the place
 * it is for - is here too, in the tooltip: a strip along the top of the page
 * has room for a number, and the rest is one hover away. It refreshes on click
 * exactly as the card does.
 */
export function WeatherCompact() {
  const enabled = useWeatherStore((state) => state.enabled)
  const display = useWeatherStore((state) => state.display)
  const weather = useWeather("header")

  // `idle` is the frame before the first load starts. An empty pill sat in the
  // header reads as something broken, and the reading is a moment away.
  if (!enabled || display !== "header" || weather.status === "idle") return null

  const loading = weather.status === "locating" || weather.status === "loading"
  const ready = weather.status === "ready" ? weather : null
  const conditions = ready ? describeWeatherCode(ready.data.code, ready.data.isDay) : null
  // Capitalised because it is rendered as a component below.
  const Icon = conditions?.Icon

  const detail = ready
    ? `${Math.round(ready.data.temperature)}° · ${conditions?.label} · Feels like ${Math.round(
        ready.data.feelsLike
      )}° · ${ready.label}`
    : weather.status === "error"
      ? weather.message
      : "Loading weather…"

  return (
    <Button
      variant="ghost"
      size="sm"
      className="glass-control px-2.5 text-foreground"
      onClick={weather.refresh}
      // A second press mid-flight would only start the same request again.
      disabled={loading}
      title={detail}
      aria-label={ready ? `Refresh weather: ${detail}` : detail}
    >
      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {weather.status === "error" && <CloudOff className="size-4 text-muted-foreground" />}
      {ready && Icon && (
        <>
          <Icon className="size-4" />
          <span className="text-sm leading-none font-medium">
            {Math.round(ready.data.temperature)}°
          </span>
        </>
      )}
    </Button>
  )
}
