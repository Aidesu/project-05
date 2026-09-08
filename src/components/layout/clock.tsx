import { useNarrowLayout } from "@/hooks/use-compact-layout"
import { useClock } from "@/hooks/use-clock"

export function Clock() {
  const now = useClock()
  const narrow = useNarrowLayout()

  return (
    <div className="pointer-events-none text-center leading-tight">
      <p className="text-sm font-medium text-foreground">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      {/* The written-out date is the first thing to go when the row runs short
          of width: "Wed 24 Sep" says the same thing in a third of the space,
          and on a narrow header the clock is sharing the row with the wordmark
          and the controls rather than floating over them. */}
      <p className="text-xs text-muted-foreground capitalize">
        {now.toLocaleDateString(
          [],
          narrow
            ? { weekday: "short", day: "numeric", month: "short" }
            : { weekday: "long", day: "numeric", month: "long" }
        )}
      </p>
    </div>
  )
}
