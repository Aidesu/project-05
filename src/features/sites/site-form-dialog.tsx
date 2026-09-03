import { useState, type ChangeEvent, type FormEvent } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SiteTagsField } from "./site-tags-field"
import { useSitesStore } from "./sites-store"
import type { Site } from "./types"

type SiteFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing an existing card, absent when adding a new one. */
  site?: Site
}

export function SiteFormDialog({ open, onOpenChange, site }: SiteFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The form is mounted fresh on every open (and whenever the edited
            site changes), so it initialises from props and needs no reset. */}
        <SiteForm key={site?.id ?? "new"} site={site} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function initialFields(site?: Site) {
  return {
    url: site?.url ?? "",
    title: site?.title ?? "",
    description: site?.description ?? "",
    tags: site?.tags ?? [],
    hidden: site?.hidden ?? false,
  }
}

function SiteForm({ site, onDone }: { site?: Site; onDone: () => void }) {
  const addSite = useSitesStore((state) => state.addSite)
  const updateSite = useSitesStore((state) => state.updateSite)
  const removeSite = useSitesStore((state) => state.removeSite)

  const [fields, setFields] = useState(() => initialFields(site))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function bind(key: "url" | "title" | "description") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      setFields((current) => ({ ...current, [key]: value }))
      setError(null)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const draft = {
      url: fields.url,
      title: fields.title,
      description: fields.description,
      tags: fields.tags,
      hidden: fields.hidden,
    }
    const result = site ? updateSite(site.id, draft) : addSite(draft)

    if (!result.ok) {
      setError(result.error)
      return
    }

    toast.success(site ? "Site updated." : `${result.site.title} added.`)
    onDone()
  }

  function handleDelete() {
    if (!site) return
    removeSite(site.id)
    toast.success(`${site.title} deleted.`)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{site ? "Edit site" : "Add a site"}</DialogTitle>
        <DialogDescription>
          {site
            ? "The name and icon are derived from the domain if you leave them blank."
            : "Paste the site's address. Its name and logo are derived from the domain."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="site-url">Address</Label>
        <Input
          id="site-url"
          value={fields.url}
          onChange={bind("url")}
          placeholder="example.com"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
        />
      </div>

      {/* Adding asks for the address and nothing elsethe title falls back to
          the domain and the icon is derived from it. The rest is enrichment,
          offered once the site is on the board. */}
      {site && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="site-title">Name</Label>
            <Input
              id="site-title"
              value={fields.title}
              onChange={bind("title")}
              placeholder="Derived from the domain if blank"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="site-description">Note</Label>
            <Input
              id="site-description"
              value={fields.description}
              onChange={bind("description")}
              placeholder="What is this site for?"
            />
          </div>

          <div className="grid gap-2">
            <Label>Tags</Label>
            <SiteTagsField
              value={fields.tags}
              onChange={(tags) => setFields((current) => ({ ...current, tags }))}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={fields.hidden}
              onCheckedChange={(checked) =>
                setFields((current) => ({ ...current, hidden: checked === true }))
              }
            />
            <span>
              Hide from the board
              <span className="block text-xs text-muted-foreground">
                Only shows up when one of its tags is selected above.
                {fields.hidden && fields.tags.length === 0 && (
                  <> Add a tag, or it won't be reachable.</>
                )}
              </span>
            </span>
          </label>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        {site && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{site ? "Save" : "Add"}</Button>
      </DialogFooter>

      {site && (
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {site.title}?</AlertDialogTitle>
              <AlertDialogDescription>
                The site is removed from the board. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  )
}
