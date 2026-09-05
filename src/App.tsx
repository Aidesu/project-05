import { lazy, Suspense } from "react"

import { Header } from "@/components/layout/header"
import { BackgroundLayer } from "@/features/background/background-layer"
import { useBackgroundContrast } from "@/features/background/use-background-contrast"
import { ChecklistCard } from "@/features/checklist/checklist-card"
import { useGlassRoot } from "@/features/glass/use-glass-root"
import { Greeting } from "@/features/greeting/greeting"
import { NewsFeed } from "@/features/news/news-feed"
import { SiteBoard } from "@/features/sites/site-board"
import { WeatherCard } from "@/features/weather/weather-card"

/**
 * Nothing on the page can raise a toast until one of the lazily-loaded panels
 * is open, so the toaster loads alongside them rather than ahead of the first
 * paint. Rendered unconditionally: the fetch starts at mount and lands long
 * before any interaction could produce a toast.
 */
const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((module) => ({ default: module.Toaster }))
)

export default function App() {
  const contrast = useBackgroundContrast()
  useGlassRoot()

  return (
    // The page is exactly one viewport and never scrolls: the feed is the one
    // thing that grows, and it scrolls inside itself.
    <div className="h-svh overflow-hidden">
      <BackgroundLayer />
      {/* Only this partnot the background layer or the Toasterneeds to
          flip with the background's lightness: everything here sits
          directly on it with no opaque surface behind. */}
      <div className="flex h-full flex-col" data-on-bg={contrast ?? undefined}>
        <Header />
        <WeatherCard />
        <ChecklistCard />
        {/* Greeting and board take the height they need; the last row (the
            feed) takes whatever is left. */}
        {/* Wide enough for four columns of news on an ultrawide, while the
            greeting and the board stay centred inside it as before. */}
        {/* The spacing above and between the rows follows the viewport's
            height, so a short or zoomed window spends its pixels on the feed
            rather than on air. Both settle at their full size (48px, 32px) on
            anything 800px tall or more. */}
        <main className="mx-auto grid min-h-0 w-full max-w-[87.5rem] flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-[clamp(1rem,4svh,2rem)] px-6 pt-[clamp(1.5rem,6svh,3rem)] pb-3">
          <Greeting />
          <SiteBoard />
          <NewsFeed />
        </main>
      </div>
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </div>
  )
}
