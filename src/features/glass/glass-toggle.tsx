import { Switch } from "@/components/ui/switch"

import { useGlassStore } from "./glass-store"

/**
 * Lives inside the panel's "Theme" section rather than in a section of its
 * own: it is the same choice as light/dark/system, one step further in, and
 * it reads as a modifier of the theme above it.
 */
export function GlassToggle() {
  const enabled = useGlassStore((state) => state.enabled)
  const setEnabled = useGlassStore((state) => state.setEnabled)

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">Glass</span>
      <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Glass" />
    </div>
  )
}
