import { getAsset, putAsset } from "@/lib/asset-store"
import { httpsUpgrade } from "@/lib/url"

/**
 * How bytes are referenced inside the app: either a URL, which means the same
 * thing everywhere, or an IndexedDB asset id, which only means something in
 * the browser holding the blob. A site icon and a background media source are
 * the same shape, so both travel through here.
 */
export type StoredAsset = { type: "url"; url: string } | { type: "upload"; assetId: string }

/** The same reference written so it survives a file: an upload carries its bytes. */
export type PortableAsset = { type: "url"; url: string } | { type: "data"; dataUrl: string }

/**
 * How much of a single upload is worth inlining. Base64 adds a third on top,
 * and all of it ends up in one JSON string the other device has to parse, so
 * a wallpaper video (up to 50 MB on upload) is past what a config file should
 * carry: it is left behind, and the export says so, rather than producing a
 * file too big to be useful.
 */
export const MAX_INLINED_ASSET_BYTES = 25 * 1024 * 1024

/** What an export had to leave behind, so the UI can mention it. */
export type AssetReport = { skipped: number }

/** What an import had to change on the way in, so the UI can mention it too. */
export type ImportReport = { upgraded: number }

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Resolves an upload to its bytes; a URL travels as-is. */
export async function exportAsset(
  asset: StoredAsset | undefined,
  report: AssetReport
): Promise<PortableAsset | undefined> {
  if (!asset) return undefined
  if (asset.type === "url") return asset

  const blob = await getAsset(asset.assetId)
  if (!blob) return undefined // the asset is gone: nothing to embed, nothing lost

  if (blob.size > MAX_INLINED_ASSET_BYTES) {
    report.skipped += 1
    return undefined
  }

  return { type: "data", dataUrl: await blobToDataUrl(blob) }
}

/** The only two kinds of inlined bytes an export ever holds: an icon or a wallpaper. */
const MEDIA_DATA_URL = /^data:(?:image|video)\/[a-z0-9.+-]+(?:;[^,]*)?,/i

function isMediaDataUrl(value: string): boolean {
  return MEDIA_DATA_URL.test(value)
}

/**
 * Decodes a `data:` URL to a blob by hand, rather than handing it to `fetch`.
 *
 * `fetch` would be shorter and it works in a plain tab, which is what hid this
 * for as long as it did: inside the packaged extension the page's own CSP
 * names `connect-src 'self' https:`, and a `data:` URL is neither, so the
 * request never leaves. Every inlined upload in an imported file came back
 * empty there — the wallpaper as "no background", a custom site icon as none —
 * which reads as a file that quietly forgot half of what it carried.
 *
 * `null` for anything malformed, which the caller treats the way it treats
 * bytes that never arrived: drop the asset, keep the rest of the file.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(",")
  if (comma === -1) return null

  // Past "data:" and up to the comma: the media type, then any parameters,
  // with ";base64" last when it is there at all.
  const header = dataUrl.slice(5, comma)
  const body = dataUrl.slice(comma + 1)
  const type = header.split(";")[0] || "application/octet-stream"

  try {
    if (!/;base64\s*$/i.test(header)) {
      return new Blob([new TextEncoder().encode(decodeURIComponent(body))], { type })
    }

    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type })
  } catch {
    return null
  }
}

/**
 * Turns an exported reference back into one this browser can use, noting in
 * `report` anything it had to correct rather than take as written.
 */
export async function importAsset(
  raw: unknown,
  report: ImportReport
): Promise<StoredAsset | undefined> {
  if (typeof raw !== "object" || raw === null) return undefined
  const value = raw as Record<string, unknown>

  // The file names an address rather than carrying bytes. It ends up in an
  // `<img src>`, a `<video src>` or a CSS `url()`, so anything that is not
  // http(s) is dropped outright: a `javascript:` or `data:` string here came
  // from somewhere else's file.
  //
  // Plain http is the one case worth repairing instead of refusing, since the
  // page's CSP would never load it as written; `httpsUpgrade` explains why
  // rewriting beats both alternatives, and the count is what the import warns
  // with afterwards.
  if (value.type === "url" && typeof value.url === "string") {
    const upgrade = httpsUpgrade(value.url)
    if (!upgrade) return undefined

    if (upgrade.upgraded) report.upgraded += 1
    return { type: "url", url: upgrade.url }
  }

  // Only a `data:` picture or video: the media types keep an imported blob to
  // what the app actually shows, whatever else a hand-edited file names.
  if (value.type === "data" && typeof value.dataUrl === "string" && isMediaDataUrl(value.dataUrl)) {
    const blob = dataUrlToBlob(value.dataUrl)
    if (!blob) return undefined // malformed data URL: drop the asset, keep the rest

    try {
      return { type: "upload", assetId: await putAsset(blob) }
    } catch {
      return undefined // IndexedDB refused it (quota, private mode): same deal
    }
  }

  return undefined
}
