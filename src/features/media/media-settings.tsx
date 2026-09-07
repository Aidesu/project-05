import { CornerPositionPicker } from "@/components/corner-position-picker"
import { Switch } from "@/components/ui/switch"
import { Section } from "@/features/settings/section"

import { useMediaStore } from "./media-store"

export function MediaSettings() {
  const enabled = useMediaStore((state) => state.enabled)
  const position = useMediaStore((state) => state.position)
  const setEnabled = useMediaStore((state) => state.setEnabled)
  const setPosition = useMediaStore((state) => state.setPosition)

  return (
    <Section
      title="Media player"
      hint="Shows whatever tab is playing, and skips tracks from here. The card asks for access to your tabs the first time you use it, and gives it back when you switch it off."
    >
      <div className="flex items-center justify-between">
        <span className="text-sm">Show the media player</span>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Show the media player"
        />
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
