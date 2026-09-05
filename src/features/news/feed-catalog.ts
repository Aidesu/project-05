import catalog from "./feeds.json"

/**
 * One publisher's feed. `source` is the name shown on the card, rather than
 * the feed's own `<title>`: those read "BBC News - Home - Feed" or carry a
 * section suffix nobody needs under a headline.
 */
export type Feed = { source: string; url: string }

/**
 * The feeds behind every desk, and the single source of truth for the hosts
 * the extension may ask to read: `vite.config.ts` reads this same file to
 * write the manifest's `optional_host_permissions`, so the list the browser
 * grants can never drift from the list the code fetches.
 *
 * Every entry was checked from a browser for three things: it answers 200,
 * it parses as strict XML (the browser's parser is not the forgiving one
 * `curl` implies), and it carries pictures. The handful kept without pictures
 * (Phoronix, CleanTechnica) are here for their copy; the card draws its tinted
 * placeholder for those.
 */
export const FEEDS: Record<string, Feed[]> = catalog

/** `https://host/*` for every host in the catalog, deduplicated. */
export function originsOf(feeds: Feed[]): string[] {
  return [...new Set(feeds.map((feed) => `https://${new URL(feed.url).hostname}/*`))]
}

/** Every host the news feed could ever read, for the "all sources" check. */
export const ALL_FEED_ORIGINS = originsOf(Object.values(FEEDS).flat())
