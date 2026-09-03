import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-4">
        {/* The wordmark is the logo — no icon beside it. */}
        <h1 className="text-2xl font-bold leading-none tracking-tighter">
          Hi<span className="text-muted-foreground">.</span>
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  )
}
