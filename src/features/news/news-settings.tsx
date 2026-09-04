import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Section } from "@/features/settings/section"

import { NEWS_CATEGORIES } from "./news-sources"
import { useNewsStore } from "./news-store"

export function NewsSettings() {
  const enabled = useNewsStore((state) => state.enabled)
  const categories = useNewsStore((state) => state.categories)
  const setEnabled = useNewsStore((state) => state.setEnabled)
  const toggleCategory = useNewsStore((state) => state.toggleCategory)

  return (
    <Section title="News" hint="Headlines from free, public APIs — no account, no key, no tracking.">
      <div className="flex items-center justify-between">
        <span className="text-sm">Show the news feed</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Show the news feed" />
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {NEWS_CATEGORIES.map((category) => (
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
        </>
      )}
    </Section>
  )
}
