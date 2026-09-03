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
    tags: site?.tags.join(", ") ?? "",
  }
}

function SiteForm({ site, onDone }: { site?: Site; onDone: () => void }) {
  const addSite = useSitesStore((state) => state.addSite)
  const updateSite = useSitesStore((state) => state.updateSite)
  const removeSite = useSitesStore((state) => state.removeSite)

  const [fields, setFields] = useState(() => initialFields(site))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function bind(key: keyof ReturnType<typeof initialFields>) {
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
      tags: fields.tags.split(","),
    }
    const result = site ? updateSite(site.id, draft) : addSite(draft)

    if (!result.ok) {
      setError(result.error)
      return
    }

    toast.success(site ? "Site mis à jour." : `${result.site.title} ajouté.`)
    onDone()
  }

  function handleDelete() {
    if (!site) return
    removeSite(site.id)
    toast.success(`${site.title} supprimé.`)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{site ? "Modifier le site" : "Ajouter un site"}</DialogTitle>
        <DialogDescription>
          {site
            ? "Le nom et l'icône sont repris du domaine si vous les laissez vides."
            : "Collez l'adresse du site. Son nom et son logo sont repris du domaine."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="site-url">Adresse</Label>
        <Input
          id="site-url"
          value={fields.url}
          onChange={bind("url")}
          placeholder="exemple.com"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
        />
      </div>

      {/* Adding asks for the address and nothing else — the title falls back to
          the domain and the icon is derived from it. The rest is enrichment,
          offered once the site is on the board. */}
      {site && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="site-title">Nom</Label>
            <Input
              id="site-title"
              value={fields.title}
              onChange={bind("title")}
              placeholder="Repris du domaine si vide"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="site-description">Note</Label>
            <Input
              id="site-description"
              value={fields.description}
              onChange={bind("description")}
              placeholder="À quoi sert ce site ?"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="site-tags">Tags</Label>
            <Input
              id="site-tags"
              value={fields.tags}
              onChange={bind("tags")}
              placeholder="veille, design, outils"
            />
            <p className="text-xs text-muted-foreground">Séparés par des virgules.</p>
          </div>
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
            Supprimer
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit">{site ? "Enregistrer" : "Ajouter"}</Button>
      </DialogFooter>

      {site && (
        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer {site.title} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le site est retiré du tableau. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  )
}
