const MAX_URL_LENGTH = 2048
const HAS_PROTOCOL = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Turns what a person actually types ("example.com", "example.com/docs") into a
 * canonical absolute URL, or `null` when it cannot become one. Normalising on
 * write is what makes deduplication a plain string comparison downstream.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null

  let url: URL
  try {
    url = new URL(HAS_PROTOCOL.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null

  url.hash = ""
  return url.toString()
}

/** `normalizeUrl` with one extra bar: `https:` and nothing else. */
function normalizeHttpsUrl(input: string): string | null {
  const url = normalizeUrl(input)
  return url?.startsWith("https://") ? url : null
}

/**
 * A feed address, or `null`. The page's CSP allows `connect-src https:` and
 * nothing else, so a plain-http feed could never be fetched, accepting one
 * would only mean storing a source that silently fails later, which is worse
 * than refusing it at the door.
 */
export function normalizeFeedUrl(input: string): string | null {
  return normalizeHttpsUrl(input)
}

/**
 * A wallpaper or icon address, or `null`. The same bar as a feed's, for the
 * same reason one step along: the manifest allows `img-src … https:` and
 * `media-src … https:`, so an `http:` picture is one the page is never
 * permitted to paint. Accepting one stores a background or an icon that looks
 * saved and simply never appears, which reads as the app losing it.
 */
export function normalizeMediaUrl(input: string): string | null {
  return normalizeHttpsUrl(input)
}

/**
 * Whether a string is an `http:`/`https:` URL and nothing else. The guard for
 * addresses that arrive from outside the UI (a config file, a news API) and
 * end up in an `href`, an `<img src>` or a CSS `url()`: everything the form
 * fields accept already went through `normalizeUrl`, but nothing else did.
 */
export function isSafeHttpUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false

  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/**
 * A picture's address raised to `https:`, or `undefined` where it is not an
 * address this page may load at all.
 *
 * For addresses arriving from a file rather than from a form. The manifest
 * allows `img-src`/`media-src` over https only, so a plain-http picture cannot
 * be shown as it stands, and the two ways to handle that are both worse than
 * this one: refusing it loses an icon someone chose, and keeping it stores a
 * picture the page is never permitted to paint.
 *
 * Rewriting is right far more often than not — a host still written as http in
 * an old file almost always answers https today, and serves the same bytes at
 * it. Where it doesn't, the picture fails to load and the card falls back to
 * its placeholder, which is exactly what the http address would have done.
 *
 * `upgraded` is what lets the import say it changed something rather than
 * quietly rewriting what someone wrote.
 */
export function httpsUpgrade(value: string): { url: string; upgraded: boolean } | undefined {
  if (value.length > MAX_URL_LENGTH) return undefined

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }

  // Left verbatim when nothing has to change, so a well-formed file round-trips
  // through an import byte for byte.
  if (url.protocol === "https:") return { url: value, upgraded: false }
  if (url.protocol !== "http:") return undefined

  url.protocol = "https:"
  return { url: url.toString(), upgraded: true }
}

/**
 * A remote image address worth rendering, or `undefined`. Only `https:`: an
 * extension page loading a picture over plain http announces what is on the
 * board to anyone on the wire, and the manifest's CSP blocks it anyway.
 */
export function safeImageUrl(value: string | undefined): string | undefined {
  if (!value || value.length > MAX_URL_LENGTH) return undefined

  try {
    return new URL(value).protocol === "https:" ? value : undefined
  } catch {
    return undefined
  }
}

/** Display host for an already-normalised URL — "www." dropped, never throws. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Chrome's `_favicon` endpoint (MV3, "favicon" permission) serves icons the
 * browser already holds: instant, available offline, and no third-party
 * request. Firefox exposes `chrome` too but has no such endpoint, so it stays
 * on the fallback along with a plain browser tab.
 */
function extensionFaviconEndpoint(): string | null {
  if (typeof browser !== "undefined") return null
  if (typeof chrome === "undefined" || !chrome?.runtime?.getURL) return null
  return chrome.runtime.getURL("/_favicon/")
}

/**
 * Favicon derived from the URL rather than stored, so nothing to fetch, cache
 * or invalidate. Swap the provider here if it ever needs to change.
 */
export function faviconUrl(url: string, size = 64): string {
  const endpoint = extensionFaviconEndpoint()

  if (endpoint) {
    const favicon = new URL(endpoint)
    favicon.searchParams.set("pageUrl", url)
    favicon.searchParams.set("size", String(size))
    return favicon.toString()
  }

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostnameOf(url))}&sz=${size}`
}
