import { useEffect, useRef, useState, type FormEvent } from "react"
import { Loader2, Rss, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

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
import { relativeTime } from "@/lib/relative-time"
import { normalizeFeedUrl, safeImageUrl } from "@/lib/url"

import { useCustomFeedsStore } from "./custom-feeds-store"
import { NewsApiError } from "./errors"
import { discoverFeed, FeedAccessError, originPatternOf, previewOf } from "./feed-discovery"
import type { FeedCandidate } from "./feed-discovery"
import { useHostAccessStore } from "./host-access"
import type { CustomCategoryId } from "./types"

type Stage =
  | { step: "typing" }
  | { step: "searching" }
  /** A feed was found on a host we may not read: one button away from working. */
  | { step: "blocked"; hostname: string; retry: string }
  | { step: "found"; candidate: FeedCandidate }

/**
 * Adds a feed to a desk, and refuses to do it blind: whatever is typed is
 * fetched and parsed first, and what gets saved is a feed whose headlines are
 * on screen at the moment the button is pressed.
 */
export function CustomFeedDialog({
  open,
  onOpenChange,
  deskId,
  deskLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deskId: CustomCategoryId
  deskLabel: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted fresh each time, so a previous search never bleeds into
            the next one and there is no reset to remember. */}
        <FeedFinder
          key={String(open)}
          deskId={deskId}
          deskLabel={deskLabel}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function FeedFinder({
  deskId,
  deskLabel,
  onDone,
}: {
  deskId: CustomCategoryId
  deskLabel: string
  onDone: () => void
}) {
  const addFeed = useCustomFeedsStore((state) => state.addFeed)
  const requestAccess = useHostAccessStore((state) => state.request)

  const [address, setAddress] = useState("")
  const [name, setName] = useState("")
  const [stage, setStage] = useState<Stage>({ step: "typing" })
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  // Closing the dialog mid-search shouldn't leave a request running against a
  // form that no longer exists.
  useEffect(() => () => controller.current?.abort(), [])

  /**
   * Everything after the permission prompt. Split out because the prompt has
   * to be raised straight from a click (Firefox drops the user gesture across
   * an `await`), so the two entry points below each ask for their own origin
   * first and then hand over to this.
   */
  async function search(url: string) {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort

    setStage({ step: "searching" })
    setError(null)

    try {
      const candidate = await discoverFeed(url, abort.signal)
      if (abort.signal.aborted) return
      setStage({ step: "found", candidate })
      setName(candidate.title)
    } catch (failure) {
      if (abort.signal.aborted) return
      if (failure instanceof FeedAccessError) {
        setStage({ step: "blocked", hostname: failure.hostname, retry: url })
        return
      }
      setStage({ step: "typing" })
      setError(
        failure instanceof NewsApiError ? failure.message : "Couldn't read anything there."
      )
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const url = normalizeFeedUrl(address)
    if (!url) {
      setError(
        address.trim().toLowerCase().startsWith("http://")
          ? "Only https addresses can be read."
          : "That doesn't look like a web address."
      )
      return
    }

    // First await in the handler, so the gesture still counts.
    const granted = await requestAccess([originPatternOf(url)])
    if (!granted) {
      setError("Without permission for that site its feed can't be read.")
      return
    }
    await search(url)
  }

  async function allowBlockedHost() {
    if (stage.step !== "blocked") return

    const granted = await requestAccess([`https://${stage.hostname}/*`])
    if (!granted) {
      setError(`Without permission for ${stage.hostname} its feed can't be read.`)
      setStage({ step: "typing" })
      return
    }
    await search(stage.retry)
  }

  function save() {
    if (stage.step !== "found") return

    const result = addFeed(deskId, { url: stage.candidate.url, source: name })
    if (!result.ok) {
      setError(result.error)
      return
    }

    toast.success(`${result.feed.source} added to ${deskLabel}.`)
    onDone()
  }

  const searching = stage.step === "searching"

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add a feed to {deskLabel}</DialogTitle>
        <DialogDescription>
          Paste a site's address and its feed is found for you, or paste the feed's own address
          if you have it.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="feed-url">Site or feed address</Label>
        <div className="flex gap-2">
          <Input
            id="feed-url"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setError(null)
              if (stage.step !== "typing") setStage({ step: "typing" })
            }}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error !== null}
          />
          <Button type="submit" variant="secondary" disabled={searching || !address.trim()}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {searching ? "Looking…" : "Find"}
          </Button>
        </div>
      </div>

      {stage.step === "blocked" && (
        <div className="grid gap-2 rounded-lg border border-border/60 p-3">
          <p className="text-sm">
            The feed is on <span className="font-medium">{stage.hostname}</span>, which needs its
            own permission.
          </p>
          <Button type="button" size="sm" className="justify-self-start gap-1" onClick={allowBlockedHost}>
            <ShieldCheck className="size-3.5" />
            Allow {stage.hostname}
          </Button>
        </div>
      )}

      {stage.step === "found" && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="feed-name">Name</Label>
            <Input
              id="feed-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={stage.candidate.title}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Rss className="size-3 shrink-0" />
              <span className="truncate">{stage.candidate.url}</span>
            </p>
          </div>

          {/* Proof, not a promise: these came back from the feed a moment ago. */}
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">
              Latest from this feed, {stage.candidate.articles.length} stories available
            </p>
            <ul className="grid gap-2 rounded-lg border border-border/60 p-2">
              {previewOf(stage.candidate).map((article) => {
                const image = safeImageUrl(article.imageUrl)
                return (
                  <li key={article.id} className="flex items-center gap-2">
                    <div className="size-9 shrink-0 overflow-hidden rounded bg-muted">
                      {image && (
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{article.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {relativeTime(article.publishedAt)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={stage.step !== "found"}>
          Add feed
        </Button>
      </DialogFooter>
    </form>
  )
}
