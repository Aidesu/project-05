import { CornerPositionPicker } from "@/components/corner-position-picker"
import { Switch } from "@/components/ui/switch"
import { Section } from "@/features/settings/section"

import { useChecklistStore } from "./checklist-store"

export function ChecklistSettings() {
  const enabled = useChecklistStore((state) => state.enabled)
  const position = useChecklistStore((state) => state.position)
  const setEnabled = useChecklistStore((state) => state.setEnabled)
  const setPosition = useChecklistStore((state) => state.setPosition)

  return (
    <Section title="Checklist" hint="A floating to-do list, kept on this device.">
      <div className="flex items-center justify-between">
        <span className="text-sm">Show the checklist</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Show the checklist" />
      </div>

      {enabled && (
        <div className="flex items-center justify-between">
          <span className="text-sm">Position</span>
          <CornerPositionPicker value={position} onChange={setPosition} />
        </div>
      )}
    </Section>
  )
}
