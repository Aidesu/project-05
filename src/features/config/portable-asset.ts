import { getAsset, putAsset } from "@/lib/asset-store"
import { isSafeHttpUrl } from "@/lib/url"

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

/** Turns an exported reference back into one this browser can use. */
export async function importAsset(raw: unknown): Promise<StoredAsset | undefined> {
  if (typeof raw !== "object" || raw === null) return undefined
  const value = raw as Record<string, unknown>

  // The file names an address rather than carrying bytes. It ends up in an
  // `<img src>`, a `<video src>` or a CSS `url()`, so only http(s) survives —
  // a `javascript:` or `data:` string here came from somewhere else's file.
  if (value.type === "url" && typeof value.url === "string" && isSafeHttpUrl(value.url)) {
    return { type: "url", url: value.url }
  }

  // Only a `data:` picture or video — `fetch` would happily go to the network
  // for anything else, and a config file is not a thing to make requests on
  // behalf of; the media types keep the blob to what the app actually shows.
  if (value.type === "data" && typeof value.dataUrl === "string" && isMediaDataUrl(value.dataUrl)) {
    try {
      const blob = await (await fetch(value.dataUrl)).blob()
      return { type: "upload", assetId: await putAsset(blob) }
    } catch {
      return undefined // malformed data URL: drop the asset, keep the rest
    }
  }

  return undefined
}
