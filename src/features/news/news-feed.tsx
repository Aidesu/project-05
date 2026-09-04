import { useEffect, useMemo, useRef, useState } from "react"
import { Eye, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

import { NewsArticleDialog } from "./news-article-dialog"
import { NewsCard } from "./news-card"
import { newsCategory, NEWS_CATEGORIES } from "./news-sources"
import { useNews } from "./use-news"
import { useNewsSeenStore } from "./news-seen-store"
import { ALL_CATEGORIES, useNewsStore } from "./news-store"
import type { NewsTab } from "./news-store"
import type { NewsArticle } from "./types"

/**
 * How much of the remaining distance a forwarded wheel covers each frame.
 * ~0.2 lands within a few pixels in about ten frames, which is roughly the
 * ease-out the browser itself puts on a wheel tick.
 */
const WHEEL_EASING = 0.2

/** Whether the wheel landed on something that already scrolls itself. */
function scrollsItself(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null

  while (node) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return true
    }
    node = node.parentElement
  }

  return false
}

/**
 * The centre column's last block: category tabs — "All" plus every category
 * chosen in settings — over a scrolling three-column grid of story cards. The
 * cards carry a headline, its source and, where the source provides one, a
 * picture and a standfirst; the full story waits in the dialog, so the page
 * itself stays quiet.
 */
export function NewsFeed() {
  const enabled = useNewsStore((state) => state.enabled)
  const categories = useNewsStore((state) => state.categories)
  const activeCategory = useNewsStore((state) => state.activeCategory)
  const setActiveCategory = useNewsStore((state) => state.setActiveCategory)
  const markSeen = useNewsSeenStore((state) => state.markSeen)

  // A category switched off in settings shouldn't leave the feed empty, so the
  // active tab is derived rather than corrected in the store.
  const active: NewsTab | null =
    activeCategory === ALL_CATEGORIES || categories.includes(activeCategory)
      ? activeCategory
      : (categories[0] ?? null)

  // What the active tab actually loads: every chosen category under "All",
  // one under a category tab, nothing when the feed is off or empty. Memoised
  // because the hook reloads whenever this list changes identity.
  const loading = useMemo(() => {
    if (!enabled || active === null) return []
    return active === ALL_CATEGORIES ? categories : [active]
  }, [enabled, active, categories])

  const news = useNews(loading)

  const [selected, setSelected] = useState<NewsArticle | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Nothing else on the page scrolls, so a wheel anywhere on it — over the
  // greeting, the board, the empty margins — is meant for the feed. Panels
  // that scroll on their own (the settings sheet, the article dialog, the
  // feed itself) keep their wheel.
  useEffect(() => {
    // Over the grid the browser eases the scroll itself; jumping straight to
    // `scrollTop + delta` here would land in visible steps beside it. So a
    // forwarded wheel sets a target and a frame loop eases towards it, which
    // is the same movement the native one makes.
    let target: number | null = null
    let frame = 0
    const eases = !window.matchMedia("(prefers-reduced-motion: reduce)").matches

    function step() {
      const list = listRef.current
      if (!list || target === null) {
        frame = 0
        return
      }

      // Re-clamped every frame: switching category mid-glide can leave the
      // target past the end of a shorter list.
      target = Math.min(target, list.scrollHeight - list.clientHeight)
      const distance = target - list.scrollTop

      if (Math.abs(distance) < 1) {
        list.scrollTop = target
        target = null
        frame = 0
        return
      }

      list.scrollTop += distance * WHEEL_EASING
      frame = requestAnimationFrame(step)
    }

    function forward(event: WheelEvent) {
      const list = listRef.current
      if (!list || scrollsItself(event.target)) return

      // Line-mode deltas (a classic mouse on Firefox) come in lines, not pixels.
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY

      if (!eases) {
        list.scrollTop += delta
        return
      }

      // Ticks accumulate onto the target rather than restarting from where the
      // glide currently is, so spinning the wheel keeps its full travel.
      const limit = list.scrollHeight - list.clientHeight
      target = Math.min(Math.max((target ?? list.scrollTop) + delta, 0), limit)
      if (!frame) frame = requestAnimationFrame(step)
    }

    window.addEventListener("wheel", forward, { passive: true })
    return () => {
      window.removeEventListener("wheel", forward)
      cancelAnimationFrame(frame)
    }
  }, [])

  if (!enabled) return null

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-col gap-2">
      {categories.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {/* Same shape as the board's "All" filter: leading, outlined, with
              the eye that means "hold nothing back". */}
          <Button
            size="xs"
            variant={active === ALL_CATEGORIES ? "default" : "outline"}
            className="gap-1"
            onClick={() => setActiveCategory(ALL_CATEGORIES)}
            aria-pressed={active === ALL_CATEGORIES}
          >
            <Eye className="size-3" />
            All
          </Button>
          {NEWS_CATEGORIES.filter((category) => categories.includes(category.id)).map(
            (category) => (
              <Button
                key={category.id}
                size="xs"
                variant={active === category.id ? "default" : "secondary"}
                onClick={() => setActiveCategory(category.id)}
                aria-pressed={active === category.id}
              >
                {category.label}
              </Button>
            )
          )}
        </div>
      )}

      {loading.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Pick a news category in settings.
        </p>
      )}

      {/* Placeholders rather than a spinner: the grid keeps its shape while
          the headlines land, so the page below doesn't jump. */}
      {news.status === "loading" && (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-xl border border-border/60 bg-card/40"
            />
          ))}
        </div>
      )}

      {news.status === "error" && (
        <button
          type="button"
          onClick={news.refresh}
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-opacity hover:opacity-80"
        >
          <RefreshCw className="size-3.5" />
          {news.message}
        </button>
      )}

      {news.status === "ready" && news.articles.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Nothing filed under this category today.
        </p>
      )}

      {news.status === "ready" && news.articles.length > 0 && (
        <>
          {/* The one scrolling region on the page, and it scrolls without a
              scrollbar: the grid ends flush with the wallpaper. */}
          <ul
            ref={listRef}
            className="scrollbar-none grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto overscroll-contain sm:grid-cols-2 lg:grid-cols-3"
          >
            {news.articles.map((article) => (
              <li key={article.id}>
                <NewsCard
                  article={article}
                  onOpen={() => {
                    markSeen(article.url)
                    setSelected(article)
                  }}
                />
              </li>
            ))}
          </ul>

          {/* Credit and refresh sit on one quiet line under the list; the
              refresh only appears once the section is hovered or focused. */}
          <div className="group/meta flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {/* One category credits its sources here; "All" leaves it to the
                cards, each of which names its own publisher. */}
            {active && active !== ALL_CATEGORIES && (
              <span>{newsCategory(active).attribution}</span>
            )}
            <button
              type="button"
              onClick={news.refresh}
              aria-label="Refresh the news"
              className="opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/meta:opacity-100"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
        </>
      )}

      <NewsArticleDialog article={selected} onOpenChange={() => setSelected(null)} />
    </section>
  )
}
