import { lazy, Suspense, useState } from "react"
import { Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WeatherCompact } from "@/features/weather/weather-compact"

import { Clock } from "./clock"

/**
 * The settings panel is the heaviest thing on the page (every feature's
 * controls, the gradient editor, the whole import/export path), and none of
 * it is on screen until the gear is pressed. Split out, it costs a new tab
 * nothing; the button warms it on hover, so the click still opens instantly.
 */
const SettingsSheet = lazy(() =>
  import("@/features/settings/settings-sheet").then((module) => ({
    default: module.SettingsSheet,
  }))
)

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Sticky: once loaded the sheet stays mounted, so closing and reopening it
  // animates the way it always did rather than suspending again.
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  function openSettings() {
    setSettingsLoaded(true)
    setSettingsOpen(true)
  }

  return (
    <header className="sticky top-0 z-10">
      <div className="relative flex w-full items-center justify-between px-6 py-4">
        {/* The wordmark is the logo; no icon beside it. */}
        <h1 className="text-2xl font-bold leading-none tracking-tighter text-foreground">
          Hi<span className="text-muted-foreground">.</span>
        </h1>

        <div className="absolute left-1/2 -translate-x-1/2">
          <Clock />
        </div>

        {/* The clock above is out of the flow, so the wordmark and this group
            are what `justify-between` actually spaces. Both sit at the same
            height, and the pill renders nothing at all unless the weather is
            set to the header, so the row's height never moves. */}
        <div className="flex items-center gap-2">
          <WeatherCompact />

          <Button
            variant="ghost"
            size="icon-sm"
            className="glass-control text-foreground"
            onClick={openSettings}
            onPointerEnter={() => setSettingsLoaded(true)}
            onFocus={() => setSettingsLoaded(true)}
            aria-label="Open settings"
          >
            <Settings />
          </Button>
        </div>
      </div>

      {settingsLoaded && (
        <Suspense fallback={null}>
          <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
    </header>
  )
}
