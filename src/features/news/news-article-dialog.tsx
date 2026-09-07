import { useEffect, useState } from "react"
import { ArrowUpRight, Bookmark, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { hostnameOf, safeImageUrl } from "@/lib/url"
import { relativeTime } from "@/lib/relative-time"

import { selectIsSaved, useNewsSavedStore } from "./news-saved-store"
import { thumbnail } from "./thumbnail"
import type { NewsArticle } from "./types"

/**
 * The picture at the size the publisher filed it, which is the whole reason a
 * card was clicked: the grid outside deliberately loads a fraction of it
 * (`thumbnail.ts`), and this is where the rest arrives.
 *
 * It opens on the grid's own copy, which the browser still holds, and swaps to
 * the full-size one the moment that has loaded. Without the swap the dialog
 * would open on an empty frame and fill in a second later, which is exactly
 * what the smaller thumbnails would otherwise have cost it.
 *
 * Remote images 404 often enough that a broken frame would be the norm, and a
 * source that isn't a plain https address is never rendered at all.
 */
function ArticleImage({ src, alt }: { src: string | undefined; alt: string }) {
  const safe = safeImageUrl(src)
  // The card's own `srcSet`, not just its 1x address: the entry the browser
  // picks here is decided by the same screen density that decided it out in
  // the grid, so what the dialog opens on is the copy already in the cache.
  const preview = safe ? thumbnail(safe) : undefined
  const previewSrc = preview?.src

  const [failed, setFailed] = useState(false)
  const [full, setFull] = useState(false)

  useEffect(() => {
    if (!safe || safe === previewSrc) return

    // Fetched off-screen so the swap happens on an image that is ready, rather
    // than blanking the frame the reader is already looking at.
    const loader = new Image()
    loader.referrerPolicy = "no-referrer"
    loader.onload = () => setFull(true)
    loader.src = safe

    return () => {
      loader.onload = null
    }
    // Both plain strings: an object here would be a new one every render, and
    // the effect would re-run for ever.
  }, [safe, previewSrc])

  if (failed || !safe) return null

  return (
    <img
      src={full ? safe : (previewSrc ?? safe)}
      srcSet={full ? undefined : preview?.srcSet}
      alt={alt}
      // On screen the instant the dialog opens, so there is nothing to defer.
      decoding="async"
      referrerPolicy="no-referrer"
      // Only what is actually being shown can fail here: the full-size fetch
      // above fails quietly, and the reader keeps the smaller copy.
      onError={() => setFailed(true)}
      className="max-h-56 w-full rounded-md object-cover"
    />
  )
}

/**
 * As much of the story as the feed handed over.
 *
 * Ten of the catalogue's feeds publish the whole article and the rest publish
 * a standfirst, so this is whichever of the two arrived (`feed-parser.ts`):
 * there is no half-way state to show, and nothing here goes back to the
 * publisher for more. The dialog scrolls, which is what a long one needs.
 *
 * Paragraphs rather than one block of text: the parser keeps the breaks the
 * article was written with, and an article without them is a wall.
 */
function ArticleBody({ article }: { article: NewsArticle }) {
  const body = article.content ?? article.summary
  if (!body) return null

  return (
    <div className="grid gap-3">
      {body.split("\n\n").map((paragraph, index) => (
        // Index keys: these are paragraphs of one immutable string, never
        // reordered and never edited.
        <p key={index} className="text-sm leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

/**
 * The same toggle the card carries, offered again here because this is where
 * the story is actually read and so where the decision to keep it is made.
 * A component of its own so its hooks never sit behind the dialog's `article`
 * being null.
 */
function SaveArticleButton({ article }: { article: NewsArticle }) {
  const saved = useNewsSavedStore(selectIsSaved(article.url))
  const toggle = useNewsSavedStore((state) => state.toggle)

  return (
    <Button variant="secondary" size="sm" aria-pressed={saved} onClick={() => toggle(article)}>
      <Bookmark className={saved ? "fill-current" : undefined} />
      {saved ? "Saved" : "Save"}
    </Button>
  )
}

/**
 * The whole story a headline can carry, kept off the board itself: summary,
 * image and per-source facts live here, so the feed outside stays a plain list
 * of titles.
 */
export function NewsArticleDialog({
  article,
  onOpenChange,
}: {
  article: NewsArticle | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={article !== null} onOpenChange={onOpenChange}>
      {article && (
        <DialogContent className="max-h-[85svh] gap-4 overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base leading-snug">{article.title}</DialogTitle>
            <DialogDescription>
              {[article.source, article.author, relativeTime(article.publishedAt)]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>

          {/* Keyed by the story, so opening another one starts from its own
              smaller copy rather than from whatever the last one had loaded. */}
          <ArticleImage key={article.url} src={article.imageUrl} alt="" />

          <ArticleBody article={article} />

          {article.facts && article.facts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {article.facts.map((fact) => (
                <span
                  key={fact}
                  className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {fact}
                </span>
              ))}
            </div>
          )}

          <DialogFooter className="sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{hostnameOf(article.url)}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <SaveArticleButton article={article} />
              {article.secondaryLink && (
                <Button variant="secondary" size="sm" asChild>
                  <a href={article.secondaryLink.url} rel="noreferrer">
                    <ExternalLink />
                    {article.secondaryLink.label}
                  </a>
                </Button>
              )}
              <Button size="sm" asChild>
                <a href={article.url} rel="noreferrer">
                  Read the article
                  <ArrowUpRight />
                </a>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
