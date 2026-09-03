export type Site = {
  id: string
  /** Normalised absolute URLthe deduplication key. */
  url: string
  title: string
  description?: string
  tags: string[]
  /** Epoch milliseconds, not `Date`: localStorage round-trips through JSON. */
  createdAt: number
  updatedAt: number
}

/** What the form collects. The store derives everything else. */
export type SiteDraft = {
  url: string
  title: string
  description: string
  tags: string[]
}
