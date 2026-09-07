import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { MediaPosition } from "./types"

/** The persisted half of the store: what a config file carries. */
export type MediaConfig = {
  /** Whether the floating card is shown at all. */
  enabled: boolean
  /** Which corner of the viewport the card floats in. */
  position: MediaPosition
}

type MediaState = MediaConfig & {
  setEnabled: (enabled: boolean) => void
  setPosition: (position: MediaPosition) => void
  /** Wholesale replacement from an imported config file (`@/features/config`). */
  importConfig: (config: MediaConfig) => void
}

/**
 * Off by default, and with a corner of its own: the card reads another tab's
 * player, which needs access the extension is not given at install time, so
 * turning it on is the moment someone is asked for it.
 */
export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      enabled: false,
      position: "bottom-left",

      setEnabled: (enabled) => set({ enabled }),
      setPosition: (position) => set({ position }),

      importConfig: (config) => set(config),
    }),
    {
      name: "mainboard.media",
      version: 1,
    }
  )
)
