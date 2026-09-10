import { useCallback, useEffect, useRef, useState } from "react"

import {
  readCachedLabel,
  readCachedWeather,
  writeCachedLabel,
  writeCachedWeather,
} from "./weather-cache"
import { fetchCurrentWeather, reverseGeocode, WeatherApiError } from "./weather-api"
import { useWeatherStore } from "./weather-store"
import type { ManualLocation, WeatherDisplay, WeatherSnapshot } from "./types"

/**
 * How often an open tab asks for a new reading. Matches the cache's own TTL
 * (`weather-cache.ts`), and forces past it: this is the tick that makes a
 * reading stale, so serving it the cache it just outgrew would freeze the card
 * for as long as the tab stayed open.
 */
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

  const load = useCallback(async (options?: { force?: boolean }) => {
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
        // Kept apart from the reading and for far longer: a place is not
        // renamed between two tabs, so only somewhere never seen before costs
        // this request at all.
        const label = readCachedLabel(lat, lon) ?? (await reverseGeocode(lat, lon))
        if (label) writeCachedLabel(lat, lon, label)
        place = { lat, lon, label: label ?? "Your location" }
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

    // A new tab a minute after the last one is asking about a temperature
    // that has not moved. `force` is the refresh button and the interval,
    // which are the two things that mean "no, actually ask".
    const cached = options?.force ? null : readCachedWeather(place.lat, place.lon)
    if (cached) {
      commit({ status: "ready", data: cached, label: place.label })
      return
    }

    try {
      commit({ status: "loading", label: place.label })
      const data = await fetchCurrentWeather(place.lat, place.lon)
      writeCachedWeather(place.lat, place.lon, data)
      commit({ status: "ready", data, label: place.label })
    } catch (error) {
      // Better the reading from an hour ago than an error where a temperature
      // should be: a rate limit or a flaky minute shouldn't empty the card.
      const stale = readCachedWeather(place.lat, place.lon, { allowStale: true })
      if (stale) {
        commit({ status: "ready", data: stale, label: place.label })
        return
      }
      fail(error)
    }
  }, [locationMode, manualLocation])

  const active = enabled && display === surface

  useEffect(() => {
    // Nothing to reset when inactive: the surface itself doesn't render, and
    // `load()` overwrites any stale result the moment it comes back.
    if (!active) return

    void load()
    const interval = setInterval(() => void load({ force: true }), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [active, load])

  /**
   * Its own callback rather than `load` itself: the card and the header line
   * both hand this straight to an `onClick`, which would call it with a React
   * event as its options — `force` undefined, and a refresh button that served
   * the cache it was pressed to get past.
   */
  const refresh = useCallback(() => void load({ force: true }), [load])

  return { ...result, refresh }
}
