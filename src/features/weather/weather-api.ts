import type { ManualLocation, WeatherSnapshot } from "./types"

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
 * endpoint, so this uses BigDataCloud's free, key-less client API instead.
 * Best-effort: a failure here just falls back to a generic label.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client")
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lon))
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
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lon))
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
