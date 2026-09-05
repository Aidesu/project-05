import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bookmark, Eye, RefreshCw, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { isSafeHttpUrl } from "@/lib/url"
import { cn } from "@/lib/utils"

import { useHostAccess, useHostAccessStore } from "./host-access"
import { NEWS_CARD_HEIGHT, NewsCard } from "./news-card"
import { useNewsSavedStore } from "./news-saved-store"
import { newsCategory, originsFor } from "./news-sources"
import { useNews } from "./use-news"
import { useNewsSeenStore } from "./news-seen-store"
import { ALL_CATEGORIES, SAVED_CATEGORY, useNewsStore } from "./news-store"
import { useNewsCategories } from "./use-news-categories"
import type { NewsTab } from "./news-store"
import type { NewsArticle } from "./types"

/**
 * How much of the remaining distance a forwarded wheel covers each frame.
 * ~0.2 lands within a few pixels in about ten frames, which is roughly the
 * ease-out the browser itself puts on a wheel tick.
 */
const WHEEL_EASING = 0.2

/**
 * Columns are laid by width, not by breakpoint: as many ~18rem cards as fit,
 * which is two on a laptop, four across a 1400px column and one on a phone or
 * a heavily zoomed window: no step changes on the way.
 */
const NEWS_GRID = "grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-3"

/**
 * Cards mounted before anything is scrolled, and how many more join them each
 * time the end of the list comes near. A new tab paints a screenful instead of
 * the whole feed: at the ceiling above that would be a hundred and fifty cards
 * and twice as many images, nearly all of them below the fold.
 */
const CARDS_PER_PAGE = 24

/**
 * How far ahead of the last card the next batch is asked for. Generous on
 * purpose: the batch has to be mounted before it is scrolled to, or the reader
 * meets the end of the list and waits.
 */
const LOAD_AHEAD = "800px"

/** One array, so "no stories yet" keeps a stable identity between renders and
 * everything downstream can compare by reference. */
const NO_ARTICLES: NewsArticle[] = []

/**
 * The full story, and the dialog machinery it needs, waits until a card is
 * actually opened: the grid itself only ever shows headlines. Fetched as
 * soon as the pointer reaches the list, so the click that follows doesn't.
 */
const NewsArticleDialog = lazy(() =>
  import("./news-article-dialog").then((module) => ({ default: module.NewsArticleDialog }))
)

/**
 * The element the browser will scroll for a wheel landing here, or null when
 * nothing under the pointer scrolls itself. Returns the node rather than a
 * boolean because it matters *which* one it is: a wheel the browser sends to
 * the feed has to call off our own glide, or the two fight over `scrollTop`.
 */
function scrollerAt(target: EventTarget | null): Element | null {
  let node = target instanceof Element ? target : null

  while (node) {
    // The cheap property read first: most nodes on the way up don't overflow,
    // and `getComputedStyle` on every one of them runs on every wheel tick.
    if (node.scrollHeight > node.clientHeight) {
      const { overflowY } = getComputedStyle(node)
      if (overflowY === "auto" || overflowY === "scroll") return node
    }
    node = node.parentElement
  }

  return null
}

/**
 * The centre column's last block: category tabs ("All" plus every category
 * chosen in settings) over a scrolling three-column grid of story cards. The
 * cards carry a headline, its source and, where the source provides one, a
 * picture and a standfirst; the full story waits in the dialog, so the page
 * itself stays quiet.
 */
export function NewsFeed() {
  const enabled = useNewsStore((state) => state.enabled)
  const chosen = useNewsStore((state) => state.categories)
  const activeCategory = useNewsStore((state) => state.activeCategory)
  const setActiveCategory = useNewsStore((state) => state.setActiveCategory)
  const markSeen = useNewsSeenStore((state) => state.markSeen)
  const available = useNewsCategories()

  // Settings can name a desk that no longer exists (a custom one deleted, or
  // an imported file describing desks this build never had), so the feed works
  // from the intersection rather than from the stored list.
  const categories = useMemo(() => {
    const known = new Set(available.map((category) => category.id))
    return chosen.filter((id) => known.has(id))
  }, [available, chosen])

  // Saved stories carry their own copy of the article, so they outlive the
  // feed they came from. Their addresses were gated when they were saved, but
  // they have sat in `localStorage` since, so they pass the same guard the
  // fetched ones do before ending up in an `href`.
  const savedStore = useNewsSavedStore((state) => state.articles)
  const saved = useMemo(
    () => savedStore.filter((article) => isSafeHttpUrl(article.url)),
    [savedStore]
  )
  const savedTab = saved.length > 0

  // A category switched off in settings shouldn't leave the feed empty, so the
  // active tab is derived rather than corrected in the store. Written as a
  // function so the two non-category tabs are ruled out before `categories` is
  // asked about the rest.
  const usable = (tab: NewsTab): boolean => {
    if (tab === ALL_CATEGORIES) return true
    if (tab === SAVED_CATEGORY) return savedTab
    return categories.includes(tab)
  }

  const active: NewsTab | null = usable(activeCategory)
    ? activeCategory
    : (categories[0] ?? (savedTab ? SAVED_CATEGORY : null))

  const showingSaved = active === SAVED_CATEGORY

  // What the active tab actually loads: every chosen category under "All",
  // one under a category tab, nothing when the feed is off, empty, or showing
  // saved stories, which never touch the network. Memoised because the hook
  // reloads whenever this list changes identity.
  const loading = useMemo(() => {
    if (!enabled || active === null || active === SAVED_CATEGORY) return []
    return active === ALL_CATEGORIES ? categories : [active]
  }, [enabled, active, categories])

  const news = useNews(loading)
  const refreshNews = news.refresh

  // Host access can also be granted from the browser's own UI, or from
  // settings, so the feed follows the permission rather than only its own
  // prompt: the moment it arrives, the desks that were blocked reload.
  const hostAccess = useHostAccess()
  const previousAccess = useRef(hostAccess)
  const requestAccess = useHostAccessStore((state) => state.request)

  useEffect(() => {
    if (hostAccess === true && previousAccess.current === false) refreshNews()
    previousAccess.current = hostAccess
  }, [hostAccess, refreshNews])

  // Raised straight from the click: Firefox drops the user gesture across an
  // `await` and refuses the prompt without one. Only the open desks' hosts are
  // asked for, so the browser lists the publishers actually being read.
  const grantAccess = () => {
    void requestAccess(originsFor(loading)).then((granted) => {
      if (granted) refreshNews()
    })
  }

  // A desk with no feeds on it yet: "nothing today" would be a statement
  // about the news where the truth is about the desk.
  const emptyDesk =
    active !== null &&
    active !== ALL_CATEGORIES &&
    active.startsWith("custom:") &&
    available.find((category) => category.id === active)?.origins.length === 0

  // The grid draws from one list either way: the store on the saved tab, the
  // fetched headlines everywhere else.
  const articles = showingSaved ? saved : news.status === "ready" ? news.articles : NO_ARTICLES

  // Grows as the list is scrolled. Reset whenever the tab changes or a reload
  // brings a different set, so a new feed starts at the top with one screenful
  // rather than inheriting however far the last one had been opened up.
  const [shown, setShown] = useState(CARDS_PER_PAGE)
  const [shownFor, setShownFor] = useState(articles)
  const sentinel = useRef<HTMLLIElement>(null)

  // Adjusted during the render that brings a new list rather than in an effect
  // afterwards: React re-runs the component before committing, so the grid
  // never paints one frame of the previous tab's scroll depth. Comparing by
  // reference is what `NO_ARTICLES` is for.
  if (shownFor !== articles) {
    setShownFor(articles)
    setShown(CARDS_PER_PAGE)
  }

  useEffect(() => {
    if (shown >= articles.length) return

    const marker = sentinel.current
    const list = listRef.current
    if (!marker || !list) return

    // Rebuilt on every batch rather than left running: an observer whose target
    // stays intersecting after the list grows reports no change, and the feed
    // would stop loading with the reader still at the bottom. Re-observing
    // always delivers a fresh reading, so batches chain until the marker is
    // genuinely out of range.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown((current) => Math.min(current + CARDS_PER_PAGE, articles.length))
        }
      },
      { root: list, rootMargin: `${LOAD_AHEAD} 0px` }
    )

    observer.observe(marker)
    return () => observer.disconnect()
  }, [shown, articles.length])

  const [selected, setSelected] = useState<NewsArticle | null>(null)
  // Sticky, like the settings sheet: mounted once, so a second story opens
  // without suspending.
  const [dialogLoaded, setDialogLoaded] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)

  // Stable, so `NewsCard`'s memoisation actually holds across a re-render.
  const openArticle = useCallback(
    (article: NewsArticle) => {
      setDialogLoaded(true)
      markSeen(article.url)
      setSelected(article)
    },
    [markSeen]
  )

  // Nothing else on the page scrolls, so a wheel anywhere on it (over the
  // greeting, the board, the empty margins) is meant for the feed. Panels
  // that scroll on their own (the settings sheet, the article dialog, the
  // feed itself) keep their wheel.
  useEffect(() => {
    // Over the grid the browser eases the scroll itself; jumping straight to
    // `scrollTop + delta` here would land in visible steps beside it. So a
    // forwarded wheel sets a target and a frame loop eases towards it, which
    // is the same movement the native one makes.
    //
    // The two must never run at once. Whenever the browser takes the list over
    // (the pointer crosses back onto the grid, a card takes focus, the list is
    // swapped for another category's) the glide lets go on the spot, rather
    // than dragging `scrollTop` back to a target set before any of that.
    let target: number | null = null
    let frame = 0
    /** The `scrollTop` the glide itself last wrote, or -1 between glides. */
    let written = -1
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")

    function stop() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      target = null
      written = -1
    }

    function step() {
      const list = listRef.current
      // No list left to scroll: the category switched, or the feed went back
      // to placeholders. The target belonged to that list, so it goes too.
      if (!list || target === null) return stop()

      // Someone else moved the list (a native wheel over the grid, a focused
      // card scrolled into view), and they get the last word.
      if (written >= 0 && Math.abs(list.scrollTop - written) > 1) return stop()

      // Re-clamped every frame: switching category mid-glide can leave the
      // target past the end of a shorter list.
      target = Math.min(target, Math.max(list.scrollHeight - list.clientHeight, 0))
      const distance = target - list.scrollTop

      if (Math.abs(distance) < 1) {
        list.scrollTop = target
        return stop()
      }

      // At least a whole pixel per frame: an eased step finer than the browser's
      // scroll granularity would round to nothing and idle here forever.
      const easedStep = Math.abs(distance) * WHEEL_EASING
      list.scrollTop += Math.sign(distance) * Math.max(easedStep, 1)
      // Read back rather than kept: the browser clamps and rounds what it took.
      written = list.scrollTop
      frame = requestAnimationFrame(step)
    }

    function forward(event: WheelEvent) {
      const list = listRef.current
      if (!list) return

      // A dialog or the settings sheet is open: Radix marks the page behind it
      // `aria-hidden`, and nothing back there should move, not even when the
      // panel itself is too short to have a scrollbar of its own to catch the
      // wheel.
      if (list.closest("[aria-hidden='true']")) return stop()

      const scroller = scrollerAt(event.target)
      if (scroller) {
        // The browser is about to scroll the feed itself. Hand it over: a glide
        // still easing towards an older target would undo the tick.
        if (scroller === list) stop()
        return
      }

      // Non-pixel deltas: lines on a classic mouse under Firefox, pages on the
      // few devices that send them.
      let delta = event.deltaY
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16
      else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= list.clientHeight

      const limit = Math.max(list.scrollHeight - list.clientHeight, 0)

      // Read per event, not once at mount: the setting can change mid-session.
      if (reduced.matches) {
        stop()
        list.scrollTop = Math.min(Math.max(list.scrollTop + delta, 0), limit)
        return
      }

      // Ticks accumulate onto the target rather than restarting from where the
      // glide currently is, so spinning the wheel keeps its full travel. With
      // no glide running the list's own position is the only honest start.
      const from = frame ? (target ?? list.scrollTop) : list.scrollTop
      target = Math.min(Math.max(from + delta, 0), limit)
      if (!frame) {
        written = -1
        frame = requestAnimationFrame(step)
      }
    }

    window.addEventListener("wheel", forward, { passive: true })
    return () => {
      window.removeEventListener("wheel", forward)
      stop()
    }
  }, [])

  if (!enabled) return null

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[87.5rem] flex-col gap-2">
      {(categories.length > 1 || savedTab) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {/* Sits ahead of "All" and only once something has been kept, so the
              row is unchanged for anyone who never saves a story. */}
          {savedTab && (
            <Button
              size="xs"
              variant={showingSaved ? "default" : "outline"}
              className="gap-1"
              onClick={() => setActiveCategory(SAVED_CATEGORY)}
              aria-pressed={showingSaved}
            >
              <Bookmark className="size-3" />
              Saved
            </Button>
          )}

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
          {available.filter((category) => categories.includes(category.id)).map(
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

      {loading.length === 0 && !showingSaved && (
        <p className="text-center text-sm text-muted-foreground">
          Pick a news category in settings.
        </p>
      )}

      {/* Placeholders rather than a spinner: the grid keeps its shape while
          the headlines land, so the page below doesn't jump. */}
      {!showingSaved && news.status === "loading" && (
        <div className={cn(NEWS_GRID, "min-h-0 flex-1 overflow-hidden")}>
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className={cn(
                NEWS_CARD_HEIGHT,
                "animate-pulse rounded-xl border border-border/60 bg-card/40"
              )}
            />
          ))}
        </div>
      )}

      {!showingSaved && news.status === "error" && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p>{news.message}</p>
          {news.needsAccess ? (
            // The one failure worth a real button: nothing is broken, the
            // browser is simply waiting to be told these publishers are wanted.
            <Button size="xs" className="gap-1" onClick={grantAccess}>
              <ShieldCheck className="size-3" />
              Allow these sources
            </Button>
          ) : (
            <button
              type="button"
              onClick={refreshNews}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            >
              <RefreshCw className="size-3.5" />
              Try again
            </button>
          )}
        </div>
      )}

      {emptyDesk && (
        <p className="text-center text-sm text-muted-foreground">
          No feeds on this desk yet. Add one in settings.
        </p>
      )}

      {!showingSaved && news.status === "ready" && news.articles.length === 0 && !emptyDesk && (
        <p className="text-center text-sm text-muted-foreground">
          Nothing filed under this category today.
        </p>
      )}

      {articles.length > 0 && (
        <>
          {/* The one scrolling region on the page, and it scrolls without a
              scrollbar: the grid ends flush with the wallpaper. */}
          <ul
            ref={listRef}
            onPointerEnter={() => setDialogLoaded(true)}
            className={cn(NEWS_GRID, "scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain")}
          >
            {articles.slice(0, shown).map((article) => (
              // Off-screen cards skip layout and paint entirely; the intrinsic
              // size keeps the scrollbar honest while they are skipped, and the
              // `auto` keyword lets the browser use the real height once a card
              // has been rendered even once.
              <li
                key={article.id}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_18rem]"
              >
                <NewsCard article={article} onOpen={openArticle} />
              </li>
            ))}

            {/* What the observer watches. A grid cell of its own, spanning the
                row so it never sits beside a card and shifts one out of line. */}
            {shown < articles.length && (
              <li ref={sentinel} aria-hidden className="col-span-full h-px" />
            )}
          </ul>

          {/* Credit and refresh sit on one quiet line under the list; the
              refresh only appears once the section is hovered or focused. */}
          <div className="group/meta flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {showingSaved ? (
              // Nothing to credit and nothing to refetch: these came from the
              // store, and they only change when someone saves or lets go.
              <span>
                {saved.length} saved {saved.length === 1 ? "story" : "stories"}
              </span>
            ) : (
              <>
                {/* One category credits its sources here; "All" leaves it to
                    the cards, each of which names its own publisher. */}
                {active && active !== ALL_CATEGORIES && (
                  <span>{newsCategory(active).attribution}</span>
                )}
                <button
                  type="button"
                  onClick={refreshNews}
                  aria-label="Refresh the news"
                  className="opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/meta:opacity-100"
                >
                  <RefreshCw className="size-3" />
                </button>
              </>
            )}
          </div>
        </>
      )}

      {dialogLoaded && (
        <Suspense fallback={null}>
          <NewsArticleDialog article={selected} onOpenChange={() => setSelected(null)} />
        </Suspense>
      )}
    </section>
  )
}
