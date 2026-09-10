import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { LocationMode, ManualLocation, WeatherDisplay, WeatherPosition } from "./types"

/** The persisted half of the store: what a config file carries. */
export type WeatherConfig = {
  /** Whether the weather is shown at all. */
  enabled: boolean
  /** Which of the two surfaces it is shown on. */
  display: WeatherDisplay
  /** Which corner of the viewport the card floats in. Kept while the header
   * line is showing, so switching back lands in the corner it was left in. */
  position: WeatherPosition
  /** Primary location source; a saved `manualLocation` also serves as the
   * fallback when `geo` fails (permission denied, unsupported, timeout). */
  locationMode: LocationMode
  manualLocation: ManualLocation | null
}

type WeatherState = WeatherConfig & {
  setEnabled: (enabled: boolean) => void
  setDisplay: (display: WeatherDisplay) => void
  setPosition: (position: WeatherPosition) => void
  setLocationMode: (mode: LocationMode) => void
  setManualLocation: (location: ManualLocation | null) => void
  /** Wholesale replacement from an imported config file (`@/features/config`). */
  importConfig: (config: WeatherConfig) => void
}

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      enabled: false,
      // The card is what the weather has always been, so it stays the default:
      // an existing board that had it on keeps the corner it put it in.
      display: "card",
      position: "bottom-right",
      // Manual by default: turning the card on shouldn't itself trigger a
      // browser geolocation prompt — that's only fired once the user opts
      // into "My location" themselves.
      locationMode: "manual",
      manualLocation: null,

      setEnabled: (enabled) => set({ enabled }),
      setDisplay: (display) => set({ display }),
      setPosition: (position) => set({ position }),
      setLocationMode: (locationMode) => set({ locationMode }),
      setManualLocation: (manualLocation) => set({ manualLocation }),

      importConfig: (config) => set(config),
    }),
    {
      name: "mainboard.weather",
      version: 3,
      /**
       * v2 added `position` — existing boards keep the original bottom-right spot.
       * v3 added `display`, and the card is what those boards were already
       * showing, so that is what they carry on showing.
       */
      migrate: (persisted, version) => {
        const state = persisted as Partial<WeatherState> | undefined
        return {
          enabled: state?.enabled ?? false,
          display: version < 3 ? "card" : (state?.display ?? "card"),
          position: version < 2 ? "bottom-right" : (state?.position ?? "bottom-right"),
          locationMode: state?.locationMode ?? "manual",
          manualLocation: state?.manualLocation ?? null,
        }
      },
    }
  )
)
