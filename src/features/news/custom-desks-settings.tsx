import { useState } from "react"
import { Check, Pencil, Plus, Rss, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hostnameOf } from "@/lib/url"

import { CustomFeedDialog } from "./custom-feed-dialog"
import { useCustomFeedsStore } from "./custom-feeds-store"
import { useNewsStore } from "./news-store"
import type { CustomDesk } from "./types"

/**
 * Desks someone builds themselves, and the feeds filed under them.
 *
 * Sits under the category buttons in settings rather than in a screen of its
 * own: a custom desk becomes one more button up there the moment it exists, so
 * the two belong together.
 */
export function CustomDesksSettings() {
  const desks = useCustomFeedsStore((state) => state.desks)
  const addDesk = useCustomFeedsStore((state) => state.addDesk)
  const toggleCategory = useNewsStore((state) => state.toggleCategory)
  const chosen = useNewsStore((state) => state.categories)

  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)

  function create() {
    const result = addDesk(label)
    if (!result.ok) {
      setError(result.error)
      return
    }

    // A desk nobody asked to see would be a tab that never appears: made here,
    // so it is switched on the moment it exists.
    if (!chosen.includes(result.desk.id)) toggleCategory(result.desk.id)
    setLabel("")
    setError(null)
    toast.success(`${result.desk.label} created.`)
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            create()
          }}
          placeholder="Name a new desk"
          aria-label="New desk name"
          autoComplete="off"
        />
        <Button type="button" variant="secondary" onClick={create} disabled={!label.trim()}>
          <Plus />
          Add
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {desks.map((desk) => (
        <DeskRow key={desk.id} desk={desk} />
      ))}
    </div>
  )
}

function DeskRow({ desk }: { desk: CustomDesk }) {
  const renameDesk = useCustomFeedsStore((state) => state.renameDesk)
  const removeDesk = useCustomFeedsStore((state) => state.removeDesk)
  const removeFeed = useCustomFeedsStore((state) => state.removeFeed)

  const [renaming, setRenaming] = useState<string | null>(null)
  const [addingFeed, setAddingFeed] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function commitRename() {
    if (renaming !== null) renameDesk(desk.id, renaming)
    setRenaming(null)
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border/60 p-2.5">
      {renaming === null ? (
        <div className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{desk.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {desk.feeds.length} feed{desk.feeds.length === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Rename ${desk.label}`}
            onClick={() => setRenaming(desk.label)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${desk.label}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            value={renaming}
            onChange={(event) => setRenaming(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitRename()
              }
              if (event.key === "Escape") setRenaming(null)
            }}
            aria-label={`Name of ${desk.label}`}
            className="h-8"
            autoFocus
          />
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Save name" onClick={commitRename}>
            <Check />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Cancel rename"
            onClick={() => setRenaming(null)}
          >
            <X />
          </Button>
        </div>
      )}

      {desk.feeds.length > 0 && (
        <ul className="grid gap-1">
          {desk.feeds.map((feed) => (
            <li key={feed.id} className="flex items-center gap-1.5 text-xs">
              <Rss className="size-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={feed.url}>
                {feed.source}
                <span className="text-muted-foreground"> · {hostnameOf(feed.url)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${feed.source}`}
                onClick={() => {
                  removeFeed(desk.id, feed.id)
                  toast.success(`${feed.source} removed.`)
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="justify-self-start gap-1"
        onClick={() => setAddingFeed(true)}
      >
        <Plus className="size-3" />
        Add a feed
      </Button>

      <CustomFeedDialog
        open={addingFeed}
        onOpenChange={setAddingFeed}
        deskId={desk.id}
        deskLabel={desk.label}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {desk.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {desk.feeds.length} feed{desk.feeds.length === 1 ? "" : "s"} go with it. The
              sites themselves are untouched. The browser keeps the permissions you granted;
              you can take those back from its own settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removeDesk(desk.id)
                toast.success(`${desk.label} deleted.`)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
