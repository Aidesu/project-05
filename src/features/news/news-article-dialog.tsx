import { useState } from "react"
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
import type { NewsArticle } from "./types"

/**
 * Remote images 404 often enough that a broken frame would be the norm, and a
 * source that isn't a plain https address is never rendered at all.
 */
function ArticleImage({ src, alt }: { src: string | undefined; alt: string }) {
  const [failed, setFailed] = useState(false)

  const safe = safeImageUrl(src)
  if (failed || !safe) return null

  return (
    <img
      src={safe}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="max-h-56 w-full rounded-md object-cover"
    />
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

          <ArticleImage src={article.imageUrl} alt="" />

          {article.summary && (
            <p className="text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
          )}

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
