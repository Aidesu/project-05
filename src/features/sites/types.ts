/** Where a custom icon's bytes come from. Absent means "derive from the URL". */
export type SiteIcon =
  | { type: "url"; url: string }
  | { type: "upload"; assetId: string }

export type Site = {
  id: string
  /** Normalised absolute URLthe deduplication key. */
  url: string
  title: string
  description?: string
  tags: string[]
  /** Left off the board unless one of its tags is the active filter. */
  hidden: boolean
  /** Overrides the derived favicon when set. */
  icon?: SiteIcon
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
  hidden: boolean
  icon?: SiteIcon
}

/** The IndexedDB asset a site's icon holds, when it holds one. */
export function iconAssetIdOf(icon: SiteIcon | undefined): string | null {
  return icon?.type === "upload" ? icon.assetId : null
}
