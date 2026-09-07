import { isSafeHttpUrl } from "@/lib/url"

import type { Feed } from "./feed-catalog"
import type { NewsArticle } from "./types"

/** Media RSS: where most newsrooms hang the picture that belongs to a story. */
const MEDIA_NS = "http://search.yahoo.com/mrss/"

/**
 * How much of a standfirst is kept. Feeds are inconsistent about `description`:
 * most put an excerpt there, a few put the entire article. The dialog wants a
 * paragraph, not a page.
 */
const MAX_SUMMARY = 400

/**
 * How much of the story itself is kept, when a feed carries it.
 *
 * Ten of the catalogue's feeds publish a whole article rather than an excerpt,
 * and the median one is about 3,300 characters, so this holds all of nearly
 * every one of them. It exists for the other end: the GitHub Blog files posts
 * of 200,000 characters, and sixty of those would be four times what
 * `localStorage` holds in total (`news-feeds.ts` does that arithmetic).
 */
const MAX_CONTENT = 6000

/** Block elements worth a paragraph of their own, innermost one winning. */
const BLOCKS = "p, li, blockquote, h2, h3, h4, h5, h6, pre"

/**
 * Turns escaped markup into the text it stands for: `&amp;` back to `&`, and
 * any tags around it dropped. Feeds nest HTML inside XML, so a title arrives
 * escaped once and an excerpt sometimes twice.
 */
export function decodeEntities(text: string): string {
  return new DOMParser().parseFromString(text, "text/html").documentElement.textContent ?? text
}

/** The tidying both of the readers below share, once the markup is gone. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    // A trimmed excerpt trails off into the theme's own marker. Each pattern
    // needs the marker at the very end, and the "read more" one needs the
    // ellipsis in front of it, so an excerpt that happens to say "read more"
    // mid-sentence survives intact.
    .replace(/\s*(\[…\]|\[\.\.\.\])\s*$/, "…")
    .replace(/…\s*read more\s*$/i, "…")
    .replace(/\s*continue reading\b[^.!?]*$/i, "…")
    // Where the marker followed a finished sentence, the ellipsis is noise.
    .replace(/([.!?])…$/, "$1")
    .trim()
}

/** Rendered HTML (a title, an excerpt) reduced to the sentence underneath. */
export function plainText(html: string): string {
  return tidy(decodeEntities(html))
}

/**
 * The same, for a whole article rather than a sentence: paragraph breaks are
 * what separate a story from a wall of text, so the markup is walked for its
 * blocks instead of being flattened.
 *
 * Only blocks that hold no block of their own are read, so a `<p>` inside a
 * `<blockquote>` is counted once rather than twice. A body with no blocks at
 * all - plenty of feeds write one long run of text with `<br>` in it - falls
 * back to reading it flat.
 */
function articleText(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html")
  // Otherwise a feed that inlines a tracking script publishes it as prose.
  for (const element of document.querySelectorAll("script, style, noscript")) element.remove()

  const found: string[] = []
  for (const block of document.body.querySelectorAll(BLOCKS)) {
    if (block.querySelector(BLOCKS)) continue
    const text = tidy(block.textContent ?? "")
    if (text) found.push(text)
  }

  return found.length > 0 ? found.join("\n\n") : tidy(document.body.textContent ?? "")
}

/** Cut to length on a word boundary, so a clamped standfirst still reads. */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const lastSpace = cut.lastIndexOf(" ")
  return `${cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit).trimEnd()}…`
}

/**
 * Descendants rather than children: `media:content` is sometimes wrapped in a
 * `media:group`, and an item is small enough that the walk costs nothing.
 * `namespace` left out means "however the feed chose to write it".
 */
function descendants(item: Element, localName: string, namespace?: string): Element[] {
  const found: Element[] = []
  for (const element of item.getElementsByTagName("*")) {
    if (element.localName !== localName) continue
    if (namespace !== undefined && element.namespaceURI !== namespace) continue
    found.push(element)
  }
  return found
}

function firstText(item: Element, ...localNames: string[]): string | undefined {
  for (const localName of localNames) {
    for (const element of descendants(item, localName)) {
      // `media:title` and `media:description` describe the picture, not the
      // story: the story's own elements are the unnamespaced ones.
      if (element.namespaceURI === MEDIA_NS) continue
      const text = element.textContent?.trim()
      if (text) return text
    }
  }
  return undefined
}

/**
 * The story's own page. RSS puts it in `<link>`'s text, Atom in the `href` of
 * the `alternate` link; `<guid>` is the last resort, and only when it happens
 * to be an address, plenty of feeds (the CBC's among them) use an opaque id.
 */
function articleLink(item: Element): string | undefined {
  for (const link of descendants(item, "link")) {
    const href = link.getAttribute("href")
    const rel = link.getAttribute("rel")
    if (href) {
      if (rel && rel !== "alternate") continue
      return href
    }
    const text = link.textContent?.trim()
    if (text) return text
  }

  const guid = firstText(item, "guid", "id")
  return guid && isSafeHttpUrl(guid) ? guid : undefined
}

/** Bodies that may carry an inline picture, richest first. */
const IMAGE_BODIES = ["encoded", "content", "description", "summary"]
/** Bodies that may carry the standfirst, most deliberate first. */
const SUMMARY_BODIES = ["summary", "description", "encoded", "content"]
/** The same four read for the story itself, where the richest wins instead. */
const CONTENT_BODIES = ["encoded", "content", "description", "summary"]

function bodies(item: Element, order: string[]): string[] {
  const found: string[] = []
  for (const localName of order) {
    for (const element of descendants(item, localName)) {
      if (element.namespaceURI === MEDIA_NS) continue
      const text = element.textContent?.trim()
      if (text) found.push(text)
    }
  }
  return found
}

/** Tracking pixels and avatars dressed as illustrations. */
function isDecorative(image: Element): boolean {
  const width = Number(image.getAttribute("width"))
  const height = Number(image.getAttribute("height"))
  if ((width > 0 && width <= 2) || (height > 0 && height <= 2)) return true
  const source = image.getAttribute("src") ?? ""
  return /gravatar|feedburner|\/pixel|\/avatar|1x1|spacer/i.test(source)
}

/** Resolved against the story's own address, since feeds write `//host/…`. */
function absolute(url: string, base: string | undefined): string | undefined {
  try {
    return new URL(url, base).toString()
  } catch {
    return undefined
  }
}

/**
 * Two publishers advertise a thumbnail where a card wants a picture (the BBC
 * a 240px strip, Phys.org a 90px square), and both serve the full-size version
 * of the same file under a different path segment. Every image in both feeds
 * was checked against these rewrites before they were added.
 *
 * Deliberately a short table rather than a general rule: it is coupling to two
 * CDNs' URL shapes, and the blast radius has to stay visible. Should either
 * change its scheme the pattern simply stops matching and the small original
 * is used unaltered. The narrower risk (the pattern still matching but that
 * size withdrawn) costs the picture rather than the story, since the card
 * falls back to its placeholder on a failed load.
 */
const IMAGE_UPGRADES: [pattern: RegExp, replacement: string][] = [
  // ichef.bbci.co.uk/ace/standard/240/… (the width is its own path segment.
  [/(\/\/ichef\.bbci\.co\.uk\/[^/]+\/[^/]+\/)\d+\//, "$1800/"],
  // scx1.b-cdn.net/csz/news/tmb/…) "tmb" is the thumbnail rendition.
  [/(\/\/scx\d+\.b-cdn\.net\/csz\/news\/)tmb\//, "$1800a/"],
]

/** An address resolved, and asked for at a size worth putting on a card. */
function imageUrl(raw: string, base: string | undefined): string | undefined {
  const resolved = absolute(raw, base)
  if (!resolved) return undefined

  for (const [pattern, replacement] of IMAGE_UPGRADES) {
    if (pattern.test(resolved)) return resolved.replace(pattern, replacement)
  }
  return resolved
}

/**
 * The picture for a story, tried in the order feeds actually carry one:
 * `media:content`, `media:thumbnail`, an image `<enclosure>`, and failing all
 * three the first real `<img>` in the body, which is the only thing the
 * Verge, the CBC, NPR or Electrek give you.
 *
 * Where a feed offers several sizes of the same picture (the Guardian ships a
 * 140px and a 460px), the widest wins: these fill a card, and the small one is
 * a thumbnail for a list.
 */
function articleImage(item: Element, link: string | undefined): string | undefined {
  for (const localName of ["content", "thumbnail"]) {
    let best: { url: string; width: number } | undefined
    for (const media of descendants(item, localName, MEDIA_NS)) {
      const url = media.getAttribute("url")
      if (!url) continue
      const type = media.getAttribute("type") ?? ""
      const medium = media.getAttribute("medium") ?? ""
      // A `media:content` can just as well be the audio or video of a story.
      if (type && !type.startsWith("image/")) continue
      if (medium && medium !== "image") continue
      if (!type && !medium && !/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(url)) continue

      const width = Number(media.getAttribute("width")) || 0
      if (!best || width > best.width) best = { url, width }
    }
    if (best) return imageUrl(best.url, link)
  }

  for (const enclosure of descendants(item, "enclosure")) {
    const url = enclosure.getAttribute("url")
    if (url && (enclosure.getAttribute("type") ?? "").startsWith("image/")) {
      return imageUrl(url, link)
    }
  }

  for (const body of bodies(item, IMAGE_BODIES)) {
    const document = new DOMParser().parseFromString(body, "text/html")
    for (const image of document.querySelectorAll("img[src]")) {
      if (isDecorative(image)) continue
      const source = image.getAttribute("src")
      if (source) return imageUrl(source, link)
    }
  }

  return undefined
}

/**
 * A feed's own name, for the moment someone adds one by hand and the dialog
 * has to tell them what they just found. Only used there, so it pays for a
 * second parse rather than complicating what `parseFeed` returns.
 */
export function parseFeedTitle(xml: string): string | undefined {
  const document = new DOMParser().parseFromString(xml, "application/xml")
  if (document.querySelector("parsererror")) return undefined

  // A direct child of the channel, or an item's own title would answer first.
  const root = document.querySelector("channel, feed")
  for (const child of root?.children ?? []) {
    if (child.localName !== "title" || child.namespaceURI === MEDIA_NS) continue
    const title = plainText(child.textContent ?? "")
    if (title) return title
  }
  return undefined
}

/**
 * One feed's XML into cards. Anything the parser cannot make sense of is
 * dropped rather than guessed at: a headline with no address is not a story.
 */
export function parseFeed(xml: string, feed: Feed): NewsArticle[] {
  const document = new DOMParser().parseFromString(xml, "application/xml")
  // The browser's XML parser reports a malformed document in-band, as a
  // `<parsererror>` element, rather than by throwing.
  if (document.querySelector("parsererror")) return []

  const host = new URL(feed.url).hostname
  const articles: NewsArticle[] = []

  for (const item of document.querySelectorAll("item, entry")) {
    const link = articleLink(item)
    const rawTitle = firstText(item, "title")
    if (!link || !isSafeHttpUrl(link) || !rawTitle) continue

    const title = plainText(rawTitle)
    if (!title) continue

    const published = firstText(item, "pubDate", "published", "date", "updated")
    const publishedAt = published ? Date.parse(published) : Number.NaN
    // Sorting the merged feed is the whole point of the timestamp, so a story
    // whose date is missing or unreadable is left out rather than floated to
    // the top of the grid on a `Date.now()` guess.
    if (Number.isNaN(publishedAt)) continue

    const summary = bodies(item, SUMMARY_BODIES)
      .map((body) => plainText(body))
      .find((text) => text.length > 0)

    // The longest of whatever the item carries, not the first: a feed that
    // fills both `description` and `content:encoded` puts the excerpt in one
    // and the article in the other, and which is which varies by publisher.
    const content = bodies(item, CONTENT_BODIES)
      .map((body) => articleText(body))
      .reduce((longest, text) => (text.length > longest.length ? text : longest), "")

    // Against the standfirst as it will be *stored*, not as it arrived. A feed
    // whose description runs past `MAX_SUMMARY` is exactly the case this is
    // for, and comparing with the full-length one would rule it out.
    const standfirst = summary ? clamp(summary, MAX_SUMMARY) : undefined

    articles.push({
      id: `rss-${host}-${link}`,
      title,
      url: link,
      source: feed.source,
      publishedAt,
      summary: standfirst,
      // Only where there is more of the story than the standfirst gave: on the
      // feeds that publish an excerpt and stop, the two would be one paragraph
      // stored twice.
      content:
        content.length > (standfirst?.length ?? 0) ? clamp(content, MAX_CONTENT) : undefined,
      imageUrl: articleImage(item, link),
      author: firstText(item, "creator") ?? undefined,
    })
  }

  return articles
}
