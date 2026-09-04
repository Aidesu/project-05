import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ChecklistItem, ChecklistPosition } from "./types"

/** The persisted half of the store: what a config file carries. */
export type ChecklistConfig = {
  /** Whether the floating card is shown at all. */
  enabled: boolean
  /** Which corner of the viewport the card floats in. Defaults away from the
   * weather card's corner so the two don't stack on top of each other. */
  position: ChecklistPosition
  items: ChecklistItem[]
}

type ChecklistState = ChecklistConfig & {
  setEnabled: (enabled: boolean) => void
  setPosition: (position: ChecklistPosition) => void
  addItem: (text: string) => void
  toggleItem: (id: string) => void
  removeItem: (id: string) => void
  /** Wholesale replacement from an imported config file (`@/features/config`). */
  importConfig: (config: ChecklistConfig) => void
}

export const useChecklistStore = create<ChecklistState>()(
  persist(
    (set) => ({
      enabled: false,
      position: "top-right",
      items: [],

      setEnabled: (enabled) => set({ enabled }),
      setPosition: (position) => set({ position }),

      addItem: (text) => {
        const trimmed = text.trim()
        if (!trimmed) return
        set((state) => ({
          items: [...state.items, { id: crypto.randomUUID(), text: trimmed, done: false }],
        }))
      },

      toggleItem: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, done: !item.done } : item
          ),
        })),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

      importConfig: (config) => set(config),
    }),
    {
      name: "mainboard.checklist",
      version: 1,
    }
  )
)
