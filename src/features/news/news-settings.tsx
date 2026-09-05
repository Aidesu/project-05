import { ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Section } from "@/features/settings/section"

import { CustomDesksSettings } from "./custom-desks-settings"
import { ALL_FEED_ORIGINS } from "./feed-catalog"
import { useHostAccess, useHostAccessStore } from "./host-access"
import { useNewsCategories } from "./use-news-categories"
import { useNewsStore } from "./news-store"

export function NewsSettings() {
  const enabled = useNewsStore((state) => state.enabled)
  const categories = useNewsStore((state) => state.categories)
  const setEnabled = useNewsStore((state) => state.setEnabled)
  const toggleCategory = useNewsStore((state) => state.toggleCategory)

  const hostAccess = useHostAccess()
  const requestAccess = useHostAccessStore((state) => state.request)
  const allCategories = useNewsCategories()

  return (
    <Section
      title="News"
      hint="Headlines from publishers' own feeds and free public APIs. No account, no key, no tracking."
    >
      <div className="flex items-center justify-between">
        <span className="text-sm">Show the news feed</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Show the news feed" />
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((category) => (
              <Button
                key={category.id}
                size="xs"
                variant={categories.includes(category.id) ? "default" : "secondary"}
                onClick={() => toggleCategory(category.id)}
                aria-pressed={categories.includes(category.id)}
              >
                {category.label}
              </Button>
            ))}
          </div>

          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground">Pick at least one category.</p>
          )}

          <CustomDesksSettings />

          {/* Offered here for the whole catalogue, so someone who turns several
              desks on at once answers one prompt instead of one per desk. The
              feed asks for its own desks' publishers on its own. */}
          {hostAccess === false && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-2.5">
              <p className="text-xs text-muted-foreground">
                Most desks are read straight from the publishers' own feeds, which the browser
                allows only once you say so.
              </p>
              <Button
                size="xs"
                className="shrink-0 gap-1"
                onClick={() => void requestAccess(ALL_FEED_ORIGINS)}
              >
                <ShieldCheck className="size-3" />
                Allow
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  )
}
