import { create } from "zustand"
import { persist } from "zustand/middleware"

import { deleteAsset } from "@/lib/asset-store"

import { BUILT_IN_GRADIENTS } from "./presets"
import { assetIdOf, type Background, type GradientSpec } from "./types"

type BackgroundState = {
  background: Background
  /** The built-in presets, each of which stays editable. */
  gradients: GradientSpec[]
  /** Whether the active gradient's blooms drift. */
  gradientAnimated: boolean
  setBackground: (background: Background) => void
  setGradientAnimated: (animated: boolean) => void
  saveGradient: (spec: GradientSpec) => void
  resetGradients: () => void
}

const NONE: Background = { kind: "none" }
const DEFAULT_BACKGROUND: Background = { kind: "gradient", preset: BUILT_IN_GRADIENTS[0].id }

/**
 * Only the *description* of the background is persisted herea colour, a
 * preset id, a URL or an asset id. Uploaded bytes live in IndexedDB
 * (`@/lib/asset-store`), well clear of the localStorage quota.
 */
export const useBackgroundStore = create<BackgroundState>()(
  persist(
    (set, get) => ({
      background: DEFAULT_BACKGROUND,
      gradients: BUILT_IN_GRADIENTS,
      gradientAnimated: true,

      setBackground: (background) => {
        const previousAssetId = assetIdOf(get().background)
        set({ background })

        // Drop the replaced upload so IndexedDB does not collect orphans.
        if (previousAssetId && previousAssetId !== assetIdOf(background)) {
          void deleteAsset(previousAssetId).catch(() => {})
        }
      },

      setGradientAnimated: (gradientAnimated) => set({ gradientAnimated }),

      saveGradient: (spec) =>
        set((state) => {
          const known = state.gradients.some((gradient) => gradient.id === spec.id)
          return {
            gradients: known
              ? state.gradients.map((gradient) => (gradient.id === spec.id ? spec : gradient))
              : [...state.gradients, spec],
          }
        }),

      resetGradients: () =>
        set((state) => {
          const current = state.background
          const orphaned =
            current.kind === "gradient" &&
            !BUILT_IN_GRADIENTS.some((gradient) => gradient.id === current.preset)

          return { gradients: BUILT_IN_GRADIENTS, background: orphaned ? DEFAULT_BACKGROUND : current }
        }),
    }),
    {
      name: "mainboard.background",
      version: 3,
      partialize: (state) => ({
        background: state.background,
        gradients: state.gradients,
        gradientAnimated: state.gradientAnimated,
      }),
      /** Same contract as the sites store: bump `version`, add a branch here. */
      migrate: (persisted, version) => {
        const state = persisted as
          | { background?: Background; gradients?: GradientSpec[]; gradientAnimated?: boolean }
          | undefined

        // v1 held only `background`; gradients were hard-coded CSS strings.
        // v3 added the drift toggle, off for anyone upgrading.
        const gradients = version < 2 ? BUILT_IN_GRADIENTS : state?.gradients ?? BUILT_IN_GRADIENTS
        return {
          background: state?.background ?? NONE,
          gradients,
          gradientAnimated: state?.gradientAnimated ?? false,
        }
      },
    }
  )
)
