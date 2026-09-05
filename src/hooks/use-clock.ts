import { useEffect, useState } from "react"

const MINUTE_MS = 60_000

/**
 * Ticks once a minute, on the minute, so the clock in the header stays live.
 *
 * A new tab is often the tab left open, and nothing on screen shows seconds —
 * a per-second interval was re-rendering sixty times for every visible change.
 * The delay is recomputed from the wall clock each tick rather than fixed, so
 * the minute turns over when it actually does and no drift accumulates.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    function schedule() {
      const next = new Date()
      setNow(next)
      timeout = setTimeout(schedule, MINUTE_MS - (next.getTime() % MINUTE_MS))
    }

    timeout = setTimeout(schedule, MINUTE_MS - (Date.now() % MINUTE_MS))
    return () => clearTimeout(timeout)
  }, [])

  return now
}
