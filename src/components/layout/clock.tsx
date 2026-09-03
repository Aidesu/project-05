import { useClock } from "@/hooks/use-clock"

export function Clock() {
  const now = useClock()

  return (
    <div className="pointer-events-none text-center leading-tight">
      <p className="text-sm font-medium text-foreground">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="text-xs text-muted-foreground capitalize">
        {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
      </p>
    </div>
  )
}
