import { lazy, Suspense } from "react"

import { Header } from "@/components/layout/header"
import { BackgroundLayer } from "@/features/background/background-layer"
import { useBackgroundContrast } from "@/features/background/use-background-contrast"
import { CardDock } from "@/features/floating/card-dock"
import { useGlassRoot } from "@/features/glass/use-glass-root"
import { Greeting } from "@/features/greeting/greeting"
import { NewsFeed } from "@/features/news/news-feed"
import { SiteBoard } from "@/features/sites/site-board"
import { useCompactLayout } from "@/hooks/use-compact-layout"
import { cn } from "@/lib/utils"

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
  const compact = useCompactLayout()
  useGlassRoot()

  return (
    // Two shapes, one page (`use-compact-layout.ts`). Given room, the page is
    // exactly one viewport and never scrolls: the feed is the one thing that
    // grows, and it scrolls inside itself. On a phone that trade stops paying,
    // because the corner cards are in the flow and there is no viewport left to
    // divide, so the document scrolls the way a document does.
    <div className={compact ? "min-h-svh" : "h-svh overflow-hidden"}>
      <BackgroundLayer />
      {/* Only this part - not the background layer or the Toaster - needs to
          flip with the background's lightness: everything here sits directly
          on it with no opaque surface behind. */}
      <div
        className={compact ? "flex min-h-svh flex-col" : "flex h-full flex-col"}
        data-on-bg={contrast ?? undefined}
      >
        <Header />
        {/* Greeting, board and dock take the height they need; the feed takes
            whatever is left of the viewport, or its own height once the page
            is the thing that scrolls.

            A column rather than a fixed set of grid rows, because the number
            of rows is no longer fixed: the dock is three fixed cards and no
            row at all on a wide page, and one row of stacked cards on a
            narrow one.

            Wide enough for four columns of news on an ultrawide, while the
            greeting and the board stay centred inside it as before. The
            spacing above and between the rows follows the viewport's height,
            so a short or zoomed window spends its pixels on the feed rather
            than on air; both settle at their full size (48px, 32px) on
            anything 800px tall or more. The side gutters are the one thing
            that follows width instead: 24px of margin either side of a 360px
            screen is a seventh of the page. */}
        <main
          className={cn(
            "mx-auto flex w-full max-w-[87.5rem] flex-col gap-[clamp(1rem,4svh,2rem)] px-4 pt-[clamp(1.5rem,6svh,3rem)] pb-3 sm:px-6",
            // Given a viewport to divide, this is what divides it, and it may
            // shrink below its content because the feed inside it scrolls.
            // Compact it must not: nothing in here scrolls on its own any
            // more, so the column is as tall as what is in it and the document
            // grows to match.
            !compact && "min-h-0 flex-1"
          )}
        >
          <Greeting />
          <SiteBoard />
          <CardDock />
          <NewsFeed />
        </main>
      </div>
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </div>
  )
}
