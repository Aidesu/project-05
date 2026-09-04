/** A headline, normalised from whichever API it came from. */
export type NewsArticle = {
  /** `${source-prefix}-${id}` — unique across categories, so it can key a list. */
  id: string
  title: string
  /** The publisher's own page for the story. */
  url: string
  /** Who published it: "BBC", "Ars Technica", "DEV"… */
  source: string
  publishedAt: number
  /** Only the sources that expose one — headline-only feeds leave it out. */
  summary?: string
  imageUrl?: string
  author?: string
  /** Short source-specific facts ("2068 points", "6 min read"), shown in the dialog. */
  facts?: string[]
  /** A second link worth offering: the Hacker News thread, the Wikipedia
   * article behind a story… */
  secondaryLink?: { label: string; url: string }
}

export type NewsCategoryId =
  | "world"
  | "business"
  | "science"
  | "tech"
  | "space"
  | "dev"
  | "hn"

export type NewsCategory = {
  id: NewsCategoryId
  label: string
  /** Credited under the feed — every source here is free and key-less. */
  attribution: string
  fetch: (signal: AbortSignal) => Promise<NewsArticle[]>
}
