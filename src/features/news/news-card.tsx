import { memo, useState } from "react"
import { Bookmark, Eye, ImageOff } from "lucide-react"

import { Card } from "@/components/ui/card"
import { relativeTime } from "@/lib/relative-time"
import { faviconUrl, safeImageUrl } from "@/lib/url"
import { cn } from "@/lib/utils"

import { selectIsSaved, useNewsSavedStore } from "./news-saved-store"
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

/**
 * Card height, and with it the whole grid's rhythm: it follows the viewport
 * rather than sitting at a fixed 288px, so a short window (or a zoomed one,
 * which is the same thing in CSS pixels) gets proportionally smaller cards
 * instead of two enormous ones.
 */
export const NEWS_CARD_HEIGHT = "h-[clamp(14rem,32svh,18rem)]"

/** Stands in for the picture on sources that publish none (Wikipedia, HN, most of DEV). */
function ImagePlaceholder({ source }: { source: string }) {
  const hue = sourceHue(source)

  return (
    <div
      className="grid h-full place-items-center gap-1 bg-muted"
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
 * Keeps a story, or lets it go. Its own component so that saving one card
 * re-renders that card's button and nothing else: `NewsCard` is memoised, and
 * subscribing it to the saved list would undo that for all sixty on screen.
 *
 * Once saved it stays visible, since the filled marker is the only thing
 * telling the two states apart at a glance; unsaved it waits for the pointer
 * or the keyboard, so the grid stays a wall of headlines.
 */
function SaveToggle({ article }: { article: NewsArticle }) {
  const saved = useNewsSavedStore(selectIsSaved(article.url))
  const toggle = useNewsSavedStore((state) => state.toggle)

  return (
    <button
      type="button"
      onClick={() => toggle(article)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this story"}
      title={saved ? "Remove from saved" : "Save this story"}
      className={cn(
        "absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full",
        // Over a photograph as often as over the placeholder, so it carries its
        // own backdrop rather than trusting whatever is behind it.
        "bg-background/70 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        saved ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
      )}
    >
      <Bookmark className={cn("size-3.5", saved && "fill-current")} />
    </button>
  )
}

/**
 * One story in the grid. Every card is the same height whatever the source
 * gave us (picture or placeholder, standfirst or not), so the rows line up;
 * the full text waits in the dialog the card opens.
 *
 * The surface is translucent rather than solid, so the wallpaper still reads
 * through it.
 *
 * Memoised, and handed the article back through `onOpen` rather than closing
 * over it: "All" can put sixty of these in the grid, and opening one of them
 * changes only the feed's own state: no reason for the other fifty-nine to
 * re-render behind the dialog.
 */
export const NewsCard = memo(function NewsCard({
  article,
  onOpen,
}: {
  article: NewsArticle
  onOpen: (article: NewsArticle) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = imageFailed ? undefined : safeImageUrl(article.imageUrl)

  // A story already opened steps back the way a visited link does: the surface
  // and its picture fade, the headline drops to the muted colour, and an eye
  // closes the line above it.
  const seen = useNewsSeenStore((state) => state.seen[article.url] !== undefined)

  return (
    <div className="group/card relative h-full">
      <button
        type="button"
        onClick={() => onOpen(article)}
        className="group h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Card
          data-seen={seen || undefined}
          className={cn(
            NEWS_CARD_HEIGHT,
            "gap-0 overflow-hidden border-border/60 bg-card/80 py-0 shadow-sm backdrop-blur-sm transition-[background-color,box-shadow,border-color] group-hover:bg-card group-hover:shadow-md",
            seen && "border-border/25 bg-card/55"
          )}
        >
          {/* Three fifths to the picture, two to the words. At two fifths the
              frame came out around 2.8:1 against a column that never narrows
              past 17.5rem, wide enough that `object-cover` cropped every
              portrait to a letterbox strip. Three fifths lands between 16:9 and
              3:2 across the whole card range, and the words still fit: the
              headline is all that's left down there. */}
          <div className={cn("h-3/5 shrink-0", seen && "opacity-55 grayscale-[40%]")}>
            {image ? (
              <div className="h-full overflow-hidden bg-muted">
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  // Publishers' CDNs have no business learning the extension's
                  // own address, which is what a default referrer would send.
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
            ) : (
              <ImagePlaceholder source={article.source} />
            )}
          </div>

          <div className="grid min-h-0 flex-1 content-start gap-1.5 overflow-hidden p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <img
                src={faviconUrl(article.url, 32)}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
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

            {/* The headline alone. The standfirst used to sit under it in two
                clamped lines, which was rarely a whole sentence and never the
                story, and the dialog this card opens carries it in full, next
                to the picture and the source's own facts. So the card asks the
                one question and leaves the answering to the dialog. */}
            <h3
              className={cn(
                "line-clamp-2 text-sm leading-snug font-medium",
                seen && "font-normal text-muted-foreground"
              )}
            >
              {article.title}
            </h3>
          </div>
        </Card>
      </button>

      {/* A sibling of the card rather than a child: the card is itself a
          button, and a button cannot nest inside another one. */}
      <SaveToggle article={article} />
    </div>
  )
})
