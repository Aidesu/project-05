import { coarse } from "./weather-api"
import type { WeatherSnapshot } from "./types"

const KEY = "mainboard.weather.cache"

/**
 * How long a reading is reused before the service is asked again. The same
 * fifteen minutes the open tab refreshes on, so a tab left open all afternoon
 * and one opened a second ago agree on how old a temperature may be.
 *
 * Without it every new tab was two requests — the place name and the forecast
 * — for a temperature that had not moved since the last one: on a page opened
 * dozens of times a day, a hundred requests to two free services, each one
 * carrying where its reader is. The news feed made this bargain already
 * (`news-cache.ts`); the weather simply never did.
 */
const TTL_MS = 15 * 60 * 1000

/**
 * A place outlives a temperature by a long way. The coordinates are already
 * rounded to about a kilometre before anything is asked, and nothing at that
 * scale is renamed inside a week, so the name is worth keeping long after the
 * reading beside it has gone stale.
 */
const LABEL_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Places kept, of each kind. One or two in ordinary use — home, and the city
 * someone typed — so this is the ceiling for the traveller rather than a
 * budget anyone reaches.
 */
const MAX_PLACES = 8

type LabelEntry = { label: string; at: number }

type Cache = {
  /** Keyed by rounded coordinates: a reading only ever speaks for its place. */
  readings?: Record<string, WeatherSnapshot>
  labels?: Record<string, LabelEntry>
}

/** The key a place is filed under, at the precision it is asked for at. */
function keyOf(lat: number, lon: number): string {
  return `${coarse(lat)},${coarse(lon)}`
}

function read(): Cache {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Cache) : {}
  } catch {
    return {}
  }
}

function write(cache: Cache): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // The same bargain the news cache makes: a full quota costs a cache hit,
    // never the reading itself.
  }
}

/** The newest `MAX_PLACES` entries, so a year of travel doesn't accumulate. */
function pruned<T>(entries: Record<string, T>, ageOf: (entry: T) => number): Record<string, T> {
  const kept = Object.entries(entries)
  if (kept.length <= MAX_PLACES) return entries

  return Object.fromEntries(
    kept.sort(([, a], [, b]) => ageOf(b) - ageOf(a)).slice(0, MAX_PLACES)
  )
}

/**
 * A reading whose numbers survived the round trip through `localStorage`.
 *
 * Nothing but this app writes that key, so this is not a trust boundary — it
 * is the half-written entry and the storage cleared mid-write, either of which
 * would otherwise put "NaN°" on the card rather than fetch a fresh reading.
 */
function isReading(value: unknown): value is WeatherSnapshot {
  if (typeof value !== "object" || value === null) return false
  const reading = value as Record<string, unknown>

  return (
    ["temperature", "feelsLike", "humidity", "windSpeed", "code", "fetchedAt"].every(
      (field) => typeof reading[field] === "number" && Number.isFinite(reading[field])
    ) && typeof reading.isDay === "boolean"
  )
}

/**
 * The cached reading for a place, or `null` once it has gone stale.
 * `allowStale` ignores the age: a temperature from an hour ago beats an error
 * message where a number should be, which is the same call `readCachedNews`
 * makes for the same reason.
 */
export function readCachedWeather(
  lat: number,
  lon: number,
  options?: { allowStale?: boolean }
): WeatherSnapshot | null {
  const entry = read().readings?.[keyOf(lat, lon)]
  if (!isReading(entry)) return null
  if (!options?.allowStale && Date.now() - entry.fetchedAt > TTL_MS) return null
  return entry
}

export function writeCachedWeather(lat: number, lon: number, data: WeatherSnapshot): void {
  const cache = read()
  const readings = { ...cache.readings, [keyOf(lat, lon)]: data }
  write({ ...cache, readings: pruned(readings, (reading) => reading.fetchedAt) })
}

/** The name of a place, or `null` where it was never looked up or has aged out. */
export function readCachedLabel(lat: number, lon: number): string | null {
  const entry = read().labels?.[keyOf(lat, lon)]
  if (!entry || typeof entry.label !== "string" || typeof entry.at !== "number") return null
  return Date.now() - entry.at > LABEL_TTL_MS ? null : entry.label
}

export function writeCachedLabel(lat: number, lon: number, label: string): void {
  const cache = read()
  const labels = { ...cache.labels, [keyOf(lat, lon)]: { label, at: Date.now() } }
  write({ ...cache, labels: pruned(labels, (entry) => entry.at) })
}
