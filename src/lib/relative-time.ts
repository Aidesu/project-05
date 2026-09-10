const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
]

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" })

/** "3 min ago", "5 hr ago": anything under a minute reads as "just now". */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const elapsed = timestamp - now
  const magnitude = Math.abs(elapsed)

  for (const { unit, ms } of UNITS) {
    // Truncated, not rounded. A story filed a hundred minutes ago is an hour
    // and forty old, and rounding calls that "2 hr ago" — reporting a headline
    // as older than it is, in the one place a reader is judging exactly that.
    // The unit is already the largest that fits, so this is never zero.
    if (magnitude >= ms) return formatter.format(Math.trunc(elapsed / ms), unit)
  }
  return "just now"
}
