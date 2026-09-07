/**
 * Smaller copies of publishers' pictures, asked for through the resizing their
 * own CDNs already do.
 *
 * A feed hands over one address, and it is usually the full-size photograph:
 * the grid then paints a 1.5 MB picture into a frame 300 pixels wide, sixty of
 * them at once. Nothing here transcodes anything, which would mean downloading
 * the very bytes this exists to avoid. Each rule rewrites an address into the
 * same CDN's own smaller rendition instead.
 *
 * Every rule below was measured against the live host before it was written
 * down, at the 400px the grid actually asks for:
 *
 *   Variety      1.6 MB -> 16 KB     The Verge   1.5 MB -> 24 KB
 *   Pitchfork    5.4 MB -> 22 KB     Wired       977 KB -> 13 KB
 *   NASA         2.4 MB -> 45 KB     Deadline    316 KB -> 32 KB
 *   Sky News     325 KB -> 25 KB     IGN         188 KB -> 24 KB
 *   9to5Mac      118 KB -> 12 KB     France 24    75 KB -> 21 KB
 *
 * The hosts that ignore a rewrite were measured too. Engadget, It's FOSS,
 * Future's CDN (PC Gamer, Space.com) and phys.org get no rule at all, and CBC
 * gets none because its resized address answers 412. Ars Technica, NME and
 * Quanta are the one compromise: they are WordPress sites that ignore `?w=`,
 * and the rule below is worth keeping for the ones that do not (Variety alone
 * is 99x), so on those three the grid loads what it always did and only pays
 * for a second address when a card is opened.
 *
 * Anything unrecognised comes back exactly as it went in, and an address a CDN
 * does refuse falls back to the publisher's own in `news-card.tsx`. The worst
 * case is the picture that would have loaded anyway.
 */

/**
 * What the grid asks for. A column is between 17.5rem and about 23rem wide, so
 * 400 covers it at 1x and the `2x` entry below covers a dense screen. The
 * dialog does not use any of this: clicking a card is a request for the
 * picture itself, at whatever size the publisher filed it.
 */
export const THUMBNAIL_WIDTH = 400

/**
 * Query keys that mean the address was signed. Changing anything else in the
 * URL stops the signature matching, and the CDN answers with an error rather
 * than a picture: the Guardian's `s=` is why this list exists, and NPR's
 * unrelated `s=` (a width) is the price of keeping it simple.
 */
const SIGNED = new Set(["s", "sig", "signature", "hash", "token", "hmac"])

/**
 * How much larger than the frame a picture has to be before asking for a
 * smaller copy is worth a second address. Re-encoding a 406px file into a
 * 400px one made it half again as heavy on OMG Ubuntu: past a certain point
 * the CDN's own compression is the whole file, and shaving pixels off it only
 * costs another round trip.
 */
const WORTH_RESIZING = 1.25

/** Query keys a resizing CDN reads as the width it should serve. */
const WIDTH_KEYS = ["w", "width"]

/** Keys carrying "<width>,<height>", which have to be scaled as a pair. */
const PAIR_KEYS = ["resize", "fit"]

/**
 * Whether the address already names the width it wants. Such an address
 * belongs to `byWidthParam` and nothing else: the rules that add a width would
 * otherwise *raise* one that is already below what the grid asks for, which is
 * how a thumbnail ends up heavier than the picture it replaced.
 */
function namesItsOwnWidth(url: URL): boolean {
  return WIDTH_KEYS.some((key) => numberOf(url.searchParams.get(key)) !== null)
}

/**
 * The width WordPress writes into the file name itself, as in
 * `photo-406x232.webp`. There is no parameter to read on those, and asking for
 * 400 from a file that is already 406 across only makes the CDN re-encode it
 * into something larger.
 */
function widthInFileName(pathname: string): number | null {
  const match = /-(\d+)x\d+\.[a-z]+$/i.exec(pathname)
  return match ? Number(match[1]) : null
}

function numberOf(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Whether a picture that wide is worth asking for again at `width`. */
function worthResizing(current: number, width: number): boolean {
  return current >= width * WORTH_RESIZING
}

/**
 * Lowers a width the address already carries, and any height beside it, so the
 * crop stays what the publisher chose. Only ever downwards: an address already
 * smaller than the grid needs is one to leave alone.
 */
function byWidthParam(url: URL, width: number): boolean {
  for (const key of WIDTH_KEYS) {
    const current = numberOf(url.searchParams.get(key))
    if (current === null || !worthResizing(current, width)) continue

    const height = numberOf(url.searchParams.get("h"))
    if (height !== null) {
      url.searchParams.set("h", String(Math.round((height * width) / current)))
    }
    url.searchParams.set(key, String(width))
    return true
  }
  return false
}

/** The same, for the CDNs that take both numbers in one key. */
function byPairParam(url: URL, width: number): boolean {
  for (const key of PAIR_KEYS) {
    const [rawWidth, rawHeight] = (url.searchParams.get(key) ?? "").split(",")
    const current = numberOf(rawWidth)
    const height = numberOf(rawHeight)
    if (current === null || height === null || !worthResizing(current, width)) continue

    url.searchParams.set(key, `${width},${Math.round((height * width) / current)}`)
    return true
  }
  return false
}

/**
 * WordPress, which is most of the catalogue, resizes on `?w=` when the site
 * runs Jetpack's image CDN and ignores it when it does not. Only reached when
 * the address names no width of its own.
 */
function byWordPress(url: URL, width: number): boolean {
  if (!url.pathname.includes("/wp-content/uploads/")) return false
  if (namesItsOwnWidth(url)) return false

  const filed = widthInFileName(url.pathname)
  if (filed !== null && !worthResizing(filed, width)) return false

  url.searchParams.set("w", String(width))
  return true
}

/**
 * Condé Nast's image service (Wired, Pitchfork, and the rest of the group),
 * where `master/pass` means "the original, untouched". The biggest single win
 * in the catalogue: those addresses are the photographer's own file.
 */
function byConde(url: URL, width: number): boolean {
  if (!url.pathname.includes("/master/pass/")) return false

  url.pathname = url.pathname.replace("/master/pass/", `/master/w_${width},c_limit/`)
  return true
}

/** IGN's CDN resizes on `?width=`, and its feed never asks it to. */
function byIgn(url: URL, width: number): boolean {
  if (!url.hostname.endsWith("ignimgs.com")) return false
  if (namesItsOwnWidth(url)) return false

  url.searchParams.set("width", String(width))
  return true
}

/** Sky News files each rendition under a `<width>x<height>` folder. */
function bySky(url: URL, width: number): boolean {
  if (!url.hostname.endsWith("365dm.com")) return false

  const path = url.pathname.replace(/\/(\d+)x(\d+)\//, (match, rawWidth: string, rawHeight: string) => {
    const current = Number(rawWidth)
    if (!worthResizing(current, width)) return match
    return `/${width}x${Math.round((Number(rawHeight) * width) / current)}/`
  })
  if (path === url.pathname) return false

  url.pathname = path
  return true
}

/** France 24 puts the width in the path, as `w:1024`. */
function byFrance24(url: URL, width: number): boolean {
  if (!url.hostname.endsWith("france24.com")) return false

  const path = url.pathname.replace(/\/w:(\d+)\//, (match, raw: string) =>
    worthResizing(Number(raw), width) ? `/w:${width}/` : match
  )
  if (path === url.pathname) return false

  url.pathname = path
  return true
}

/**
 * The publisher's picture at roughly `width` pixels across, or the address
 * unchanged where nothing here recognises it.
 */
function resized(source: string, width: number): string {
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return source
  }

  for (const key of url.searchParams.keys()) {
    if (SIGNED.has(key)) return source
  }

  // The address's own numbers first: a CDN that was already asked for a width
  // has proved it honours one, whatever host it happens to be.
  const rewritten =
    byWidthParam(url, width) ||
    byPairParam(url, width) ||
    byConde(url, width) ||
    byIgn(url, width) ||
    bySky(url, width) ||
    byFrance24(url, width) ||
    byWordPress(url, width)

  return rewritten ? url.toString() : source
}

/**
 * What to hand an `<img>`: the resized address, and a `2x` entry so a dense
 * screen fetches a sharp copy and an ordinary one does not. No `srcSet` at all
 * where the address could not be rewritten - two identical entries would only
 * be a bigger attribute saying the same thing.
 */
export function thumbnail(
  source: string,
  width: number = THUMBNAIL_WIDTH
): { src: string; srcSet?: string } {
  const src = resized(source, width)
  const dense = resized(source, width * 2)

  return { src, srcSet: dense === src ? undefined : `${src} 1x, ${dense} 2x` }
}
