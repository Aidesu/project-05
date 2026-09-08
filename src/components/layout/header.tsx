import { lazy, Suspense, useState } from "react"
import { Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WeatherCompact } from "@/features/weather/weather-compact"
import { useCompactLayout } from "@/hooks/use-compact-layout"
import { cn } from "@/lib/utils"

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
  const compact = useCompactLayout()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Sticky: once loaded the sheet stays mounted, so closing and reopening it
  // animates the way it always did rather than suspending again.
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  function openSettings() {
    setSettingsLoaded(true)
    setSettingsOpen(true)
  }

  return (
    // Sticky is free while the page is exactly one viewport: nothing scrolls
    // under it, and it is only there so the row keeps its place above the
    // background layer. Once the document itself scrolls it would stop being
    // free - a strip of unbacked text laid over moving headlines - so it goes
    // up with the rest of the page instead, and the gear comes back with a
    // scroll to the top.
    <header className={cn("relative z-10", !compact && "sticky top-0")}>
      <div className="relative flex w-full items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
        {/* The wordmark is the logo; no icon beside it. */}
        <h1 className="text-2xl font-bold leading-none tracking-tighter text-foreground">
          Hi<span className="text-muted-foreground">.</span>
        </h1>

        {/* Centred on the page rather than between its neighbours, which is
            what taking it out of the flow buys - until there is no width to
            spare, and a long date run under the weather pill is a worse
            answer than an off-centre clock. Below 40rem the three of them
            simply share the row. */}
        <div className="absolute left-1/2 -translate-x-1/2 max-[40rem]:static max-[40rem]:translate-x-0">
          <Clock />
        </div>

        {/* Where the clock is out of the flow, the wordmark and this group are
            what `justify-between` actually spaces; where it isn't, all three
            share the row. Either way they sit at the same height, and the pill
            renders nothing at all unless the weather is set to the header, so
            the row's height never moves. */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
