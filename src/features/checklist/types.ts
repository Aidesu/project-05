import type { Corner } from "@/lib/corner"

export type ChecklistPosition = Corner

export type ChecklistItem = {
  id: string
  text: string
  done: boolean
}
