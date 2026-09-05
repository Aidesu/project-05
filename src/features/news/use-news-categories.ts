import { useMemo } from "react"

import { useCustomFeedsStore } from "./custom-feeds-store"
import { customNewsCategory, NEWS_CATEGORIES } from "./news-sources"
import type { NewsCategory } from "./types"

/**
 * Every desk on offer (the built-in ones, then whatever someone has built for
 * themselves) recomputed only when their desks change.
 *
 * The one place components should read the desk list from: `NEWS_CATEGORIES`
 * alone is the built-in half, and a component rendering just that would drop
 * custom desks the moment one is added.
 */
export function useNewsCategories(): NewsCategory[] {
  const desks = useCustomFeedsStore((state) => state.desks)

  return useMemo(
    () => [...NEWS_CATEGORIES, ...desks.map(customNewsCategory)],
    [desks]
  )
}
