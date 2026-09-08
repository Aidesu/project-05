import { ChecklistCard } from "@/features/checklist/checklist-card"
import { MediaPlayerCard } from "@/features/media/media-player-card"
import { WeatherCard } from "@/features/weather/weather-card"
import { useCompactLayout } from "@/hooks/use-compact-layout"

/**
 * The weather, the player and the checklist, in one place because on a narrow
 * page they end up in one place.
 *
 * On a wide page nothing here lays them out: each one positions itself `fixed`
 * in the corner its settings name, and a fixed child is not a flex item, so
 * this contributes no row and no gap to the column it is written into.
 *
 * Compact, they come back into the flow and land here, between the board and
 * the news: one column, in `FLOATING_ORDER`, so the order they are read in is
 * the order they would have stacked in had they shared a corner. The wrapper
 * collapses when all three are switched off, so the page's gap doesn't open
 * around nothing.
 */
export function CardDock() {
  const compact = useCompactLayout()

  const cards = (
    <>
      <WeatherCard />
      <MediaPlayerCard />
      <ChecklistCard />
    </>
  )

  if (!compact) return cards

  return <div className="grid justify-items-center gap-3 empty:hidden">{cards}</div>
}
