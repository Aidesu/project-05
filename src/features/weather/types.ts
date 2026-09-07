import type { Corner } from "@/lib/corner"

export type LocationMode = "geo" | "manual"

export type WeatherPosition = Corner

/**
 * Where the weather is shown. Declared as a list so a config file can be
 * checked against it, the same way the corners are.
 *
 * The two are alternatives, not layers: the floating card has room for the
 * description and the feels-like, the header line has room for a number, and
 * whichever one is chosen is the only one on screen.
 */
export const WEATHER_DISPLAYS = ["card", "header"] as const

export type WeatherDisplay = (typeof WEATHER_DISPLAYS)[number]

export type ManualLocation = {
  label: string
  lat: number
  lon: number
}

export type WeatherSnapshot = {
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  /** WMO weather code, as returned by Open-Meteo. */
  code: number
  isDay: boolean
  /** Epoch milliseconds, not `Date`: consistent with the rest of the app's storage. */
  fetchedAt: number
}
