import { Monitor, Moon, Sun } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { BackgroundSettings } from "@/features/background/background-settings"
import { ChecklistSettings } from "@/features/checklist/checklist-settings"
import { ConfigSettings } from "@/features/config/config-settings"
import { NewsSettings } from "@/features/news/news-settings"
import { WeatherSettings } from "@/features/weather/weather-settings"

import { Section } from "./section"

type SettingsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const THEMES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const { theme, setTheme } = useTheme()
  const activeTheme = theme ?? "system"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Page preferences, kept on this device.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-7 px-5 pb-10">
          <Section title="Theme" hint="“System” follows your device's setting.">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={activeTheme === value ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setTheme(value)}
                  aria-pressed={activeTheme === value}
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>
          </Section>

          <BackgroundSettings />
          <WeatherSettings />
          <ChecklistSettings />
          <NewsSettings />
          <ConfigSettings />
        </div>
      </SheetContent>
    </Sheet>
  )
}
