import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { RotateCcw, Upload } from "lucide-react"
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
import { putAsset } from "@/lib/asset-store"
import { normalizeUrl } from "@/lib/url"

import { SiteTagsField } from "./site-tags-field"
import { useSitesStore } from "./sites-store"
import type { Site, SiteIcon } from "./types"
import { useSiteIconUrl } from "./use-site-icon"

/** Kept well under the practical IndexedDB comfort zone for a single icon. */
const MAX_ICON_UPLOAD_MB = 5

/**
 * What the icon control is showing, distinct from `SiteIcon`: "default"
 * covers a never-customised icon, and "file" is a pending upload not yet
 * written to IndexedDBthat only happens on save, so cancelling leaves no
 * orphaned blob behind.
 */
type IconField =
  | { type: "default" }
  | { type: "url"; url: string }
  | { type: "upload"; assetId: string }
  | { type: "file"; file: File }

function iconFieldOf(icon: SiteIcon | undefined): IconField {
  if (!icon) return { type: "default" }
  return icon
}

/** `null` when there's no pending file. */
function useFilePreviewUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  return url
}

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
    icon: iconFieldOf(site?.icon),
  }
}

function SiteForm({ site, onDone }: { site?: Site; onDone: () => void }) {
  const addSite = useSitesStore((state) => state.addSite)
  const updateSite = useSitesStore((state) => state.updateSite)
  const removeSite = useSitesStore((state) => state.removeSite)

  const [fields, setFields] = useState(() => initialFields(site))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [iconUrlInput, setIconUrlInput] = useState("")
  const [savingIcon, setSavingIcon] = useState(false)

  const pendingFile = fields.icon.type === "file" ? fields.icon.file : null
  const filePreview = useFilePreviewUrl(pendingFile)
  const resolvedPreview = useSiteIconUrl(
    fields.icon.type === "url" || fields.icon.type === "upload" ? fields.icon : undefined,
    fields.url
  )
  const iconPreview = filePreview ?? resolvedPreview

  function bind(key: "url" | "title" | "description") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      setFields((current) => ({ ...current, [key]: value }))
      setError(null)
    }
  }

  function handleIconFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // so re-picking the same file still fires onChange
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.")
      return
    }
    if (file.size > MAX_ICON_UPLOAD_MB * 1024 * 1024) {
      toast.error(`File too large (max ${MAX_ICON_UPLOAD_MB} MB).`)
      return
    }

    setFields((current) => ({ ...current, icon: { type: "file", file } }))
  }

  function applyIconUrl() {
    const url = normalizeUrl(iconUrlInput)
    if (!url) {
      toast.error("Invalid address.")
      return
    }
    setFields((current) => ({ ...current, icon: { type: "url", url } }))
    setIconUrlInput("")
  }

  function resetIcon() {
    setFields((current) => ({ ...current, icon: { type: "default" } }))
    setIconUrlInput("")
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    let icon: SiteIcon | undefined
    if (fields.icon.type === "file") {
      setSavingIcon(true)
      try {
        const assetId = await putAsset(fields.icon.file)
        icon = { type: "upload", assetId }
      } catch {
        setSavingIcon(false)
        setError("Could not save the icon image.")
        return
      }
      setSavingIcon(false)
    } else if (fields.icon.type === "default") {
      icon = undefined
    } else {
      icon = fields.icon
    }

    const draft = {
      url: fields.url,
      title: fields.title,
      description: fields.description,
      tags: fields.tags,
      hidden: fields.hidden,
      icon,
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
            <Label>Icon</Label>
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted">
                {iconPreview ? (
                  <img
                    src={iconPreview}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold uppercase text-muted-foreground">
                    {(fields.title || fields.url).charAt(0)}
                  </span>
                )}
              </div>

              <div className="grid flex-1 gap-2">
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm" disabled={savingIcon}>
                    <label className="cursor-pointer">
                      <Upload />
                      Upload
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        onChange={handleIconFile}
                        className="sr-only"
                      />
                    </label>
                  </Button>
                  {fields.icon.type !== "default" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetIcon}
                      disabled={savingIcon}
                    >
                      <RotateCcw />
                      Reset
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={iconUrlInput}
                    onChange={(event) => setIconUrlInput(event.target.value)}
                    placeholder="…or paste an image address"
                    aria-label="Icon address"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button type="button" size="sm" onClick={applyIconUrl} disabled={savingIcon}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
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
        <Button type="button" variant="ghost" onClick={onDone} disabled={savingIcon}>
          Cancel
        </Button>
        <Button type="submit" disabled={savingIcon}>
          {savingIcon ? "Saving…" : site ? "Save" : "Add"}
        </Button>
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
