import { useCallback, useEffect, useRef, useState } from "react"

import { fetchCurrentWeather, reverseGeocode, WeatherApiError } from "./weather-api"
import { useWeatherStore } from "./weather-store"
import type { WeatherSnapshot } from "./types"

const REFRESH_INTERVAL_MS = 15 * 60 * 1000

type WeatherResult =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "loading"; label: string | null }
  | { status: "ready"; data: WeatherSnapshot; label: string }
  | { status: "error"; message: string }

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error
}

function locateBrowser(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation isn't available in this browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 10 * 60 * 1000,
    })
  })
}

export function useWeather() {
  const enabled = useWeatherStore((state) => state.enabled)
  const locationMode = useWeatherStore((state) => state.locationMode)
  const manualLocation = useWeatherStore((state) => state.manualLocation)

  const [result, setResult] = useState<WeatherResult>({ status: "idle" })
  // Guards against a stale response landing after a newer request started
  // (e.g. the refresh interval firing mid-flight, or settings changing).
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    const commit = (next: WeatherResult) => {
      if (requestId.current === id) setResult(next)
    }

    try {
      let lat: number
      let lon: number
      let label: string

      if (locationMode === "manual") {
        if (!manualLocation) {
          commit({ status: "error", message: "Add a city in settings to see the weather." })
          return
        }
        ;({ lat, lon, label } = manualLocation)
      } else {
        commit({ status: "locating" })
        const position = await locateBrowser()
        lat = position.coords.latitude
        lon = position.coords.longitude
        label = (await reverseGeocode(lat, lon)) ?? "Your location"
      }

      commit({ status: "loading", label })
      const data = await fetchCurrentWeather(lat, lon)
      commit({ status: "ready", data, label })
    } catch (error) {
      // Browser geolocation failed: fall back to the saved city, if any.
      if (locationMode === "geo" && manualLocation) {
        try {
          commit({ status: "loading", label: manualLocation.label })
          const data = await fetchCurrentWeather(manualLocation.lat, manualLocation.lon)
          commit({ status: "ready", data, label: manualLocation.label })
          return
        } catch {
          // Fall through to the error below.
        }
      }

      const message =
        error instanceof WeatherApiError
          ? error.message
          : isGeolocationError(error)
            ? "Location access was denied or timed out."
            : "Couldn't load the weather."
      commit({ status: "error", message })
    }
  }, [locationMode, manualLocation])

  useEffect(() => {
    // Nothing to reset when disabled: the card itself doesn't render, and
    // `load()` overwrites any stale result the moment it's enabled again.
    if (!enabled) return

    void load()
    const interval = setInterval(() => void load(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [enabled, load])

  return { ...result, refresh: load }
}
