import { useState } from "react"
import { Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SettingsSheet } from "@/features/settings/settings-sheet"

import { Clock } from "./clock"

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-10">
      <div className="relative flex w-full items-center justify-between px-6 py-4">
        {/* The wordmark is the logono icon beside it. */}
        <h1 className="text-2xl font-bold leading-none tracking-tighter text-foreground">
          Hi<span className="text-muted-foreground">.</span>
        </h1>

        <div className="absolute left-1/2 -translate-x-1/2">
          <Clock />
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-foreground"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          <Settings />
        </Button>
      </div>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}
