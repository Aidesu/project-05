import { useMemo, useState, type KeyboardEvent } from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useSitesStore } from "./sites-store"

type SiteTagsFieldProps = {
  value: string[]
  onChange: (tags: string[]) => void
}

/**
 * Picks from tags already used elsewhere on the board, or types a new one.
 * Selected tags are removable chips; the rest of the board's tags sit below
 * as one-click add buttons, same look as the board's own filter row.
 */
export function SiteTagsField({ value, onChange }: SiteTagsFieldProps) {
  const sites = useSitesStore((state) => state.sites)
  const [draft, setDraft] = useState("")

  const availableTags = useMemo(() => {
    const known = [...new Set(sites.flatMap((site) => site.tags))].sort()
    return known.filter((tag) => !value.includes(tag))
  }, [sites, value])

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setDraft("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((current) => current !== tag))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    addTag(draft)
  }

  return (
    <div className="grid gap-2">
      {(value.length > 0 || availableTags.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="xs"
              variant="default"
              onClick={() => removeTag(tag)}
            >
              {tag}
              <X className="size-3" />
            </Button>
          ))}
          {availableTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => addTag(tag)}
            >
              {tag}
              <Plus className="size-3" />
            </Button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New tag"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => addTag(draft)}
          aria-label="Add tag"
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
