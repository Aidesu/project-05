export type LocationMode = "geo" | "manual"

export type WeatherPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

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
