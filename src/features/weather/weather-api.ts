import type { ManualLocation, WeatherSnapshot } from "./types"

/**
 * Decimal places the two services are asked for.
 *
 * Two is about 1.1 km, which is below anything a forecast or a place name can
 * tell apart, and it is the difference between handing a third party the
 * neighbourhood someone is in and handing it their doorstep. The browser
 * reports far finer than that, and there is nothing to do with the rest.
 *
 * Rounded here rather than at the call sites, deliberately: this module is the
 * only place either service is reached, so nothing can arrive at full
 * precision by coming in another way.
 */
const COORD_DECIMALS = 2

/** One coordinate at the precision above. Also the key the cache groups a
 * reading under, so a cache hit and a request mean the same place. */
export function coarse(value: number): number {
  // `+` rather than `Number(...)`: it drops the "-0" that a coordinate just
  // south or west of zero rounds to, which would key two names for one place.
  return +value.toFixed(COORD_DECIMALS) || 0
}

/** Thrown for failures worth showing verbatim in the card (vs. a generic fallback message). */
export class WeatherApiError extends Error {}

/** Forward geocoding: turns a place name into coordinates. No API key required. */
export async function geocodeCity(query: string): Promise<ManualLocation | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
  url.searchParams.set("name", query)
  url.searchParams.set("count", "1")
  url.searchParams.set("format", "json")

  const response = await fetch(url)
  if (!response.ok) throw new WeatherApiError("City search is unavailable right now.")

  const data = (await response.json()) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[]
  }
  const result = data.results?.[0]
  if (!result) return null

  const label = [result.name, result.admin1, result.country].filter(Boolean).join(", ")
  return { label, lat: result.latitude, lon: result.longitude }
}

/**
 * Reverse geocoding for the "my location" label. Open-Meteo has no reverse
 * endpoint, so this uses BigDataCloud's free, key-less client API instead —
 * the one service the app reaches that is named nowhere else, which is why
 * the README lists it beside Open-Meteo.
 *
 * Called once per place rather than once per reading: the name is cached for
 * a week (`weather-cache.ts`), so an ordinary week of new tabs asks this
 * nothing at all. Best-effort either way: a failure falls back to a generic
 * label.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client")
  url.searchParams.set("latitude", String(coarse(lat)))
  url.searchParams.set("longitude", String(coarse(lon)))
  url.searchParams.set("localityLanguage", "en")

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const data = (await response.json()) as {
      city?: string
      locality?: string
      principalSubdivision?: string
    }
    return data.city || data.locality || data.principalSubdivision || null
  } catch {
    return null
  }
}

export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(coarse(lat)))
  url.searchParams.set("longitude", String(coarse(lon)))
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day"
  )
  url.searchParams.set("timezone", "auto")

  const response = await fetch(url)
  if (!response.ok) throw new WeatherApiError("The weather service is unavailable right now.")

  const data = (await response.json()) as {
    current: {
      temperature_2m: number
      apparent_temperature: number
      relative_humidity_2m: number
      weather_code: number
      wind_speed_10m: number
      is_day: number
    }
  }

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    code: data.current.weather_code,
    isDay: data.current.is_day === 1,
    fetchedAt: Date.now(),
  }
}
