import { useState } from "react"
import { Eye, ImageOff } from "lucide-react"

import { Card } from "@/components/ui/card"
import { relativeTime } from "@/lib/relative-time"
import { faviconUrl } from "@/lib/url"
import { cn } from "@/lib/utils"

import { useNewsSeenStore } from "./news-seen-store"
import type { NewsArticle } from "./types"

/**
 * A hue derived from the publisher's name, so every story from the same source
 * gets the same tint and the wall of placeholders doesn't read as one flat
 * block. Deterministic: no state, no palette to keep in sync.
 */
function sourceHue(source: string): number {
  let hash = 0
  for (const character of source) hash = (hash * 31 + character.charCodeAt(0)) % 360
  return hash
}

/** Stands in for the picture on sources that publish none (Wikipedia, HN, most of DEV). */
function ImagePlaceholder({ source }: { source: string }) {
  const hue = sourceHue(source)

  return (
    <div
      className="grid h-36 place-items-center gap-1 bg-muted"
      style={{
        backgroundImage: `linear-gradient(135deg, oklch(0.7 0.09 ${hue} / 0.35), oklch(0.6 0.11 ${(hue + 40) % 360} / 0.12))`,
      }}
    >
      <ImageOff className="size-5 text-muted-foreground/60" />
      <span className="text-[11px] text-muted-foreground/60">No image</span>
    </div>
  )
}

/**
 * One story in the grid. Every card is the same height whatever the source
 * gave us — picture or placeholder, standfirst or not — so the rows line up;
 * the full text waits in the dialog the card opens.
 *
 * The surface is translucent rather than solid, so the wallpaper still reads
 * through it.
 */
export function NewsCard({ article, onOpen }: { article: NewsArticle; onOpen: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = imageFailed ? undefined : article.imageUrl

  // A story already opened steps back the way a visited link does: the surface
  // and its picture fade, the headline drops to the muted colour, and an eye
  // closes the line above it.
  const seen = useNewsSeenStore((state) => state.seen[article.url] !== undefined)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card
        data-seen={seen || undefined}
        className={cn(
          "h-72 gap-0 overflow-hidden border-border/60 bg-card/80 py-0 shadow-sm backdrop-blur-sm transition-[background-color,box-shadow,border-color] group-hover:bg-card group-hover:shadow-md",
          seen && "border-border/25 bg-card/55"
        )}
      >
        <div className={cn("shrink-0", seen && "opacity-55 grayscale-[40%]")}>
          {image ? (
            <div className="h-36 overflow-hidden bg-muted">
              <img
                src={image}
                alt=""
                loading="lazy"
                onError={() => setImageFailed(true)}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
          ) : (
            <ImagePlaceholder source={article.source} />
          )}
        </div>

        <div className="grid content-start gap-1.5 p-3.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <img
              src={faviconUrl(article.url, 32)}
              alt=""
              loading="lazy"
              className={cn("size-3.5 shrink-0 rounded-[3px]", seen && "opacity-55 grayscale")}
            />
            <span className="truncate">{article.source}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{relativeTime(article.publishedAt)}</span>
            {seen && (
              <>
                <Eye className="ml-auto size-3 shrink-0" aria-hidden />
                <span className="sr-only">Already opened.</span>
              </>
            )}
          </div>

          {/* Sources with no standfirst (Wikipedia, HN) give the headline the
              room the summary would have taken, so the card fills either way. */}
          <h3
            className={cn(
              "text-sm leading-snug font-medium",
              article.summary ? "line-clamp-2" : "line-clamp-4",
              seen && "font-normal text-muted-foreground"
            )}
          >
            {article.title}
          </h3>

          {article.summary && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}
        </div>
      </Card>
    </button>
  )
}
