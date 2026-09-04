const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
]

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" })

/** "3 min ago", "5 hr ago" — anything under a minute reads as "just now". */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const elapsed = timestamp - now
  const magnitude = Math.abs(elapsed)

  for (const { unit, ms } of UNITS) {
    if (magnitude >= ms) return formatter.format(Math.round(elapsed / ms), unit)
  }
  return "just now"
}
