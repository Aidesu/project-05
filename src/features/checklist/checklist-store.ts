import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ChecklistItem, ChecklistPosition } from "./types"

type ChecklistState = {
  /** Whether the floating card is shown at all. */
  enabled: boolean
  /** Which corner of the viewport the card floats in. Defaults away from the
   * weather card's corner so the two don't stack on top of each other. */
  position: ChecklistPosition
  items: ChecklistItem[]
  setEnabled: (enabled: boolean) => void
  setPosition: (position: ChecklistPosition) => void
  addItem: (text: string) => void
  toggleItem: (id: string) => void
  removeItem: (id: string) => void
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
    }),
    {
      name: "mainboard.checklist",
      version: 1,
    }
  )
)
