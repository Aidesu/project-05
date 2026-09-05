/** A headline, normalised from whichever API it came from. */
export type NewsArticle = {
  /** `${source-prefix}-${id}`, unique across categories, so it can key a list. */
  id: string
  title: string
  /** The publisher's own page for the story. */
  url: string
  /** Who published it: "BBC", "Ars Technica", "DEV"… */
  source: string
  publishedAt: number
  /** Only the sources that expose one: headline-only feeds leave it out. */
  summary?: string
  imageUrl?: string
  author?: string
  /** Short source-specific facts ("2068 points", "6 min read"), shown in the dialog. */
  facts?: string[]
  /** A second link worth offering: the Hacker News thread, the Wikipedia
   * article behind a story… */
  secondaryLink?: { label: string; url: string }
}

/** The desks that ship with the app, each backed by a curated source list. */
export type BuiltInCategoryId =
  | "world"
  | "geopolitics"
  | "business"
  | "science"
  | "sports"
  | "tech"
  | "gaming"
  | "screen"
  | "music"
  | "open-source"
  | "energy"
  | "space"
  | "dev"
  | "hn"

/**
 * A desk someone made themselves. Prefixed rather than a bare id so a custom
 * desk can never collide with a built-in one, and so persisted settings can be
 * told apart on sight.
 */
export type CustomCategoryId = `custom:${string}`

export type NewsCategoryId = BuiltInCategoryId | CustomCategoryId

/** One feed added by hand, already checked to parse when it was added. */
export type CustomFeed = {
  id: string
  url: string
  /** The name shown on the card: the feed's own title, unless it was edited. */
  source: string
}

/** A desk someone made, and the feeds they filed under it. */
export type CustomDesk = {
  id: CustomCategoryId
  label: string
  feeds: CustomFeed[]
}

export type NewsCategory = {
  id: NewsCategoryId
  label: string
  /** Credited under the feed: every source here is free and key-less. */
  attribution: string
  /**
   * The `https://host/*` patterns this desk reads straight from the
   * publishers, and so needs host access for. Empty for the desks whose APIs
   * answer a cross-origin request unasked, which is what lets those keep
   * working when access is refused.
   */
  origins: string[]
  fetch: (signal: AbortSignal) => Promise<NewsArticle[]>
}
