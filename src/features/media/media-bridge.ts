import type { MediaAction, MediaSnapshot } from "./types"

const HOOK_ID = "hi-media-session-hook"
/** Emitted from `public/`, so the path is the extension root's own. */
const HOOK_FILE = "media-hook.js"

/**
 * What reading and driving another tab's player takes: the tab list, the
 * ability to run a function in the tab that is playing, and access to the page
 * it is playing on. Optional, never asked for at install: the card is off
 * until someone turns it on, and it asks then.
 *
 * `https:` only, matching the ceiling the manifest declares.
 */
export const MEDIA_ACCESS = {
  permissions: ["tabs", "scripting"],
  origins: ["https://*/*"],
}

/** Firefox's namespace first, then Chrome's - the same rule as `host-access.ts`. */
function extensionApi(): ExtensionApi | undefined {
  return typeof browser !== "undefined"
    ? browser
    : typeof chrome !== "undefined"
      ? chrome
      : undefined
}

/**
 * Whether this build can do any of it. False in a plain tab (`npm run dev`, or
 * the page opened outside the extension), where there is no other tab to read
 * and no permission that could be granted: the card renders nothing there
 * rather than a prompt nobody can answer.
 *
 * The test is the permissions API and nothing else, deliberately. `scripting`
 * is one of the optional permissions being asked for, and a browser does not
 * hand over its namespace until it has been granted, so asking whether
 * `scripting` exists here would hide the very button that asks for it.
 */
export function mediaBridgeAvailable(): boolean {
  return Boolean(extensionApi()?.permissions)
}

export async function hasMediaAccess(): Promise<boolean> {
  const permissions = extensionApi()?.permissions
  if (!permissions) return false

  try {
    return await permissions.contains(MEDIA_ACCESS)
  } catch {
    return false
  }
}

/** Must be called straight from a click: Firefox drops the user gesture across
 * an `await` and refuses the prompt without one. */
export async function requestMediaAccess(): Promise<boolean> {
  const permissions = extensionApi()?.permissions
  if (!permissions) return false

  try {
    return await permissions.request(MEDIA_ACCESS)
  } catch {
    return false
  }
}

/** Access is revocable from the browser's own UI, so the card follows the
 * permission rather than only its own prompt. */
export function watchMediaAccess(listener: () => void): () => void {
  const permissions = extensionApi()?.permissions
  permissions?.onAdded?.addListener(listener)
  permissions?.onRemoved?.addListener(listener)

  return () => {
    permissions?.onAdded?.removeListener(listener)
    permissions?.onRemoved?.removeListener(listener)
  }
}

/**
 * Registers the recorder on every page, and takes it off again when the card
 * is switched off. It has to be there from document_start to be there before
 * the site's own player, which is why this cannot be done at the moment the
 * card wants to read something.
 */
export async function installMediaHook(): Promise<void> {
  const scripting = extensionApi()?.scripting
  if (!scripting) return

  try {
    const registered = await scripting.getRegisteredContentScripts({ ids: [HOOK_ID] })
    if (registered.length > 0) return

    await scripting.registerContentScripts([
      {
        id: HOOK_ID,
        matches: MEDIA_ACCESS.origins,
        js: [HOOK_FILE],
        runAt: "document_start",
        world: "MAIN",
        allFrames: false,
        persistAcrossSessions: true,
      },
    ])
  } catch {
    // No page-world content scripts on this engine (Firefox before 128), or
    // the access was revoked between the check and the call. The card still
    // reads what is playing and still starts and stops it through the media
    // element itself; only the track skips are lost, and it greys those.
  }
}

export async function removeMediaHook(): Promise<void> {
  const scripting = extensionApi()?.scripting
  if (!scripting) return

  try {
    await scripting.unregisterContentScripts({ ids: [HOOK_ID] })
  } catch {
    // Nothing registered, which is the state this was asking for anyway.
  }
}

/**
 * The tab the card is holding. `audible` goes false the instant something is
 * paused, so the last tab found is remembered and kept until it closes:
 * pausing from this card must not make the card forget what it was showing.
 */
let remembered: number | null = null

async function mediaTabId(): Promise<number | null> {
  const tabs = extensionApi()?.tabs
  if (!tabs) return null

  try {
    const audible = await tabs.query({ audible: true })
    const playing = audible.find((tab) => typeof tab.id === "number")
    if (playing?.id != null) {
      remembered = playing.id
      return remembered
    }

    if (remembered == null) return null
    // Still open? `get` rejects on a tab that has gone, and then there is
    // genuinely nothing to show.
    await tabs.get(remembered)
    return remembered
  } catch {
    remembered = null
    return null
  }
}

/**
 * Runs inside the playing tab, in the page's own world. Self-contained on
 * purpose: it is serialised, sent across and re-parsed over there, so it can
 * close over nothing and import nothing.
 */
function readMediaState(): MediaSnapshot | null {
  const session = navigator.mediaSession as MediaSession | undefined
  const metadata = session?.metadata ?? null
  const handlers = window.__hiMediaHandlers

  const elements = Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio"))
  const element = elements.find((media) => !media.paused) ?? elements[0] ?? null

  // A page with neither is not playing anything this card can speak for.
  if (!metadata && !element) return null

  // Many sites leave `playbackState` at "none" and only ever touch the
  // element, so it answers only when it has actually been set.
  const state = session?.playbackState
  const playing =
    state === "playing" ? true : state === "paused" ? false : Boolean(element && !element.paused)

  const artwork = metadata?.artwork?.[0]?.src ?? null

  return {
    // The tab's title where the page publishes no metadata: on a lone video
    // that is usually the closest thing to a track name there is.
    title: metadata?.title || document.title || "",
    artist: metadata?.artist || metadata?.album || "",
    // The card's own page may only load `https:` images.
    artwork: artwork?.startsWith("https://") ? artwork : null,
    playing,
    canPrevious: Boolean(handlers?.has("previoustrack")),
    canNext: Boolean(handlers?.has("nexttrack")),
  }
}

/** Also runs in the playing tab. See `readMediaState`. */
function runMediaAction(action: string): void {
  const handler = window.__hiMediaHandlers?.get(action)
  if (handler) {
    try {
      handler({ action })
      return
    } catch {
      // The site's own handler threw. Fall through: for play and pause there
      // is a second way in.
    }
  }

  // No handler recorded - the site registers none, or the page was already
  // open before the recorder was. Starting and stopping still work on the
  // element itself, which is most of what the card is for; a track skip has
  // no equivalent, and the card has already greyed those buttons out.
  if (action !== "play" && action !== "pause") return

  const elements = Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio"))
  const element = elements.find((media) => !media.paused) ?? elements[0]
  if (!element) return

  if (action === "pause") element.pause()
  else void element.play().catch(() => {})
}

/** What is playing right now, or `null` when nothing is. */
export async function readMedia(): Promise<MediaSnapshot | null> {
  const scripting = extensionApi()?.scripting
  const tabId = await mediaTabId()
  if (!scripting || tabId == null) return null

  try {
    const [injection] = await scripting.executeScript<MediaSnapshot | null>({
      target: { tabId },
      world: "MAIN",
      func: readMediaState,
    })
    return injection?.result ?? null
  } catch {
    // A tab this extension may not touch (the browser's own pages, an add-on
    // store), or one that closed mid-read.
    return null
  }
}

export async function sendMedia(action: MediaAction): Promise<void> {
  const scripting = extensionApi()?.scripting
  const tabId = await mediaTabId()
  if (!scripting || tabId == null) return

  try {
    await scripting.executeScript<void>({
      target: { tabId },
      world: "MAIN",
      func: runMediaAction,
      args: [action],
    })
  } catch {
    // Same as above: the next poll will find out what really happened.
  }
}
