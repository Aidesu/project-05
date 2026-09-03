import { useState } from "react"
import { Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SettingsSheet } from "@/features/settings/settings-sheet"

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-10 border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-4">
        {/* The wordmark is the logo — no icon beside it. */}
        <h1 className="text-2xl font-bold leading-none tracking-tighter">
          Hi<span className="text-muted-foreground">.</span>
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
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
