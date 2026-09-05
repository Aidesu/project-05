import { create } from "zustand"
import { persist } from "zustand/middleware"

/** The persisted half of the store: what a config file carries. */
export type GlassConfig = {
  /** Whether the page's surfaces are translucent rather than flat. */
  enabled: boolean
}

type GlassState = GlassConfig & {
  setEnabled: (enabled: boolean) => void
  /** Wholesale replacement from an imported config file (`@/features/config`). */
  importConfig: (config: GlassConfig) => void
}

/**
 * One switch for the whole page's material. It changes no layout and owns no
 * colours of its own: everything it does is in the `[data-glass]` block of
 * `index.css`, which this store turns on through `useGlassRoot`.
 *
 * Off by default, including for anyone upgrading: the flat surfaces are what
 * the app has always looked like, and a wallpaper someone tuned against them
 * shouldn't change under them on an update.
 */
export const useGlassStore = create<GlassState>()(
  persist(
    (set) => ({
      enabled: false,

      setEnabled: (enabled) => set({ enabled }),

      importConfig: (config) => set(config),
    }),
    {
      name: "mainboard.glass",
      version: 1,
    }
  )
)
