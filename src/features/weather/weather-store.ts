import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { LocationMode, ManualLocation } from "./types"

type WeatherState = {
  /** Whether the floating card is shown at all. */
  enabled: boolean
  /** Primary location source; a saved `manualLocation` also serves as the
   * fallback when `geo` fails (permission denied, unsupported, timeout). */
  locationMode: LocationMode
  manualLocation: ManualLocation | null
  setEnabled: (enabled: boolean) => void
  setLocationMode: (mode: LocationMode) => void
  setManualLocation: (location: ManualLocation | null) => void
}

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      enabled: false,
      locationMode: "geo",
      manualLocation: null,

      setEnabled: (enabled) => set({ enabled }),
      setLocationMode: (locationMode) => set({ locationMode }),
      setManualLocation: (manualLocation) => set({ manualLocation }),
    }),
    {
      name: "mainboard.weather",
      version: 1,
    }
  )
)
