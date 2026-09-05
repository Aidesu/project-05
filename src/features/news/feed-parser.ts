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
 * Turns escaped markup into the text it stands for: `&amp;` back to `&`, and
 * any tags around it dropped. Feeds nest HTML inside XML, so a title arrives
 * escaped once and an excerpt sometimes twice.
 */
export function decodeEntities(text: string): string {
  return new DOMParser().parseFromString(text, "text/html").documentElement.textContent ?? text
}

/** Rendered HTML (a title, an excerpt) reduced to the sentence underneath. */
export function plainText(html: string): string {
  return decodeEntities(html)
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

    articles.push({
      id: `rss-${host}-${link}`,
      title,
      url: link,
      source: feed.source,
      publishedAt,
      summary: summary ? clamp(summary, MAX_SUMMARY) : undefined,
      imageUrl: articleImage(item, link),
      author: firstText(item, "creator") ?? undefined,
    })
  }

  return articles
}
