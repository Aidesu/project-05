import { useState } from "react"
import { ArrowUpRight, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { hostnameOf } from "@/lib/url"
import { relativeTime } from "@/lib/relative-time"

import type { NewsArticle } from "./types"

/** Remote images 404 often enough that a broken frame would be the norm. */
function ArticleImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="max-h-56 w-full rounded-md object-cover"
    />
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

          {article.imageUrl && <ArticleImage src={article.imageUrl} alt="" />}

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
              {article.secondaryLink && (
                <Button variant="secondary" size="sm" asChild>
                  <a href={article.secondaryLink.url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    {article.secondaryLink.label}
                  </a>
                </Button>
              )}
              <Button size="sm" asChild>
                <a href={article.url} target="_blank" rel="noreferrer">
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
