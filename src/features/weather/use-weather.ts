import { useCallback, useEffect, useRef, useState } from "react"

import { fetchCurrentWeather, reverseGeocode, WeatherApiError } from "./weather-api"
import { useWeatherStore } from "./weather-store"
import type { ManualLocation, WeatherDisplay, WeatherSnapshot } from "./types"

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

/**
 * The current conditions for whichever surface asks. Both the floating card
 * and the header line call this, and the surface they name is checked against
 * the one that is switched on: only the surface actually on screen loads, so
 * the two of them never fetch the same reading twice.
 */
export function useWeather(surface: WeatherDisplay) {
  const enabled = useWeatherStore((state) => state.enabled)
  const display = useWeatherStore((state) => state.display)
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

    const fail = (error: unknown) => {
      commit({
        status: "error",
        message:
          error instanceof WeatherApiError
            ? error.message
            : isGeolocationError(error)
              ? "Location access was denied or timed out."
              : "Couldn't load the weather.",
      })
    }

    /** Where the reading is for. Settled before anything is fetched, so the
     * two failures below stay distinct. */
    let place: ManualLocation

    if (locationMode === "manual") {
      if (!manualLocation) {
        commit({ status: "error", message: "Add a city in settings to see the weather." })
        return
      }
      place = manualLocation
    } else {
      try {
        commit({ status: "locating" })
        const position = await locateBrowser()
        const { latitude: lat, longitude: lon } = position.coords
        place = { lat, lon, label: (await reverseGeocode(lat, lon)) ?? "Your location" }
      } catch (error) {
        // Only the browser refusing to say where we are, which is what a saved
        // city is the fallback for. The forecast itself is deliberately not in
        // this `try`: the service answers the same way whichever coordinates
        // it is handed, so retrying it against the saved city would be a
        // second request for the same failure — and one that succeeded would
        // quietly show another place's weather under "My location".
        if (!manualLocation) return fail(error)
        place = manualLocation
      }
    }

    try {
      commit({ status: "loading", label: place.label })
      const data = await fetchCurrentWeather(place.lat, place.lon)
      commit({ status: "ready", data, label: place.label })
    } catch (error) {
      fail(error)
    }
  }, [locationMode, manualLocation])

  const active = enabled && display === surface

  useEffect(() => {
    // Nothing to reset when inactive: the surface itself doesn't render, and
    // `load()` overwrites any stale result the moment it comes back.
    if (!active) return

    void load()
    const interval = setInterval(() => void load(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [active, load])

  return { ...result, refresh: load }
}
