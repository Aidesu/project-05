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
