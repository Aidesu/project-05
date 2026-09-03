import { useEffect, useState } from "react"

/** Ticks once a second so the clock in the weather card stays live. */
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return now
}
