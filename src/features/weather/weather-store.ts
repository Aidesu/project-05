import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { LocationMode, ManualLocation, WeatherPosition } from "./types"

type WeatherState = {
  /** Whether the floating card is shown at all. */
  enabled: boolean
  /** Which corner of the viewport the card floats in. */
  position: WeatherPosition
  /** Primary location source; a saved `manualLocation` also serves as the
   * fallback when `geo` fails (permission denied, unsupported, timeout). */
  locationMode: LocationMode
  manualLocation: ManualLocation | null
  setEnabled: (enabled: boolean) => void
  setPosition: (position: WeatherPosition) => void
  setLocationMode: (mode: LocationMode) => void
  setManualLocation: (location: ManualLocation | null) => void
}

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      enabled: false,
      position: "bottom-right",
      locationMode: "geo",
      manualLocation: null,

      setEnabled: (enabled) => set({ enabled }),
      setPosition: (position) => set({ position }),
      setLocationMode: (locationMode) => set({ locationMode }),
      setManualLocation: (manualLocation) => set({ manualLocation }),
    }),
    {
      name: "mainboard.weather",
      version: 2,
      /** v2 added `position`existing boards keep the original bottom-right spot. */
      migrate: (persisted, version) => {
        const state = persisted as Partial<WeatherState> | undefined
        return {
          enabled: state?.enabled ?? false,
          position: version < 2 ? "bottom-right" : (state?.position ?? "bottom-right"),
          locationMode: state?.locationMode ?? "geo",
          manualLocation: state?.manualLocation ?? null,
        }
      },
    }
  )
)
