import { create } from "zustand"

/**
 * The weather card's live rendered height, in px — not persisted, since it's
 * a layout fact, not a preference. Lets the checklist card stack itself
 * clear of the weather card when both share the same corner.
 */
type WeatherMetricsState = {
  height: number | null
  setHeight: (height: number | null) => void
}

export const useWeatherMetricsStore = create<WeatherMetricsState>((set) => ({
  height: null,
  setHeight: (height) => set({ height }),
}))
