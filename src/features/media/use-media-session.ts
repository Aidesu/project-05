import { useCallback, useEffect, useRef, useState } from "react"

import {
  hasMediaAccess,
  installMediaHook,
  mediaBridgeAvailable,
  readMedia,
  removeMediaHook,
  requestMediaAccess,
  sendMedia,
  watchMediaAccess,
} from "./media-bridge"
import type { MediaAction, MediaSnapshot } from "./types"

/**
 * How often the playing tab is asked what it is showing. There is no event to
 * subscribe to across tabs, so this is a poll, and it is a cheap one: a
 * function call in one tab, only while this page is the one being looked at.
 */
const POLL_INTERVAL = 2000

/**
 * How long a page is given to act on a command before it is asked again.
 * A skip that changes track takes a moment to settle, and reading straight
 * back would report the track that just ended.
 */
const SETTLE_DELAY = 350

export type MediaState =
  /** Not an extension, or an engine without the APIs: nothing to show. */
  | { status: "unavailable" }
  /** The first permission check has not answered yet. A frame or two, and
   * showing nothing beats showing a prompt that is about to be wrong. */
  | { status: "checking" }
  /** The access has not been granted yet, or was taken back. */
  | { status: "blocked"; grant: () => void }
  /** Access granted, nothing playing anywhere. */
  | { status: "idle" }
  | { status: "ready"; data: MediaSnapshot; send: (action: MediaAction) => void }

function sameSnapshot(a: MediaSnapshot | null, b: MediaSnapshot | null): boolean {
  if (a === b) return true
  if (!a || !b) return false

  return (
    a.title === b.title &&
    a.artist === b.artist &&
    a.artwork === b.artwork &&
    a.playing === b.playing &&
    a.canPrevious === b.canPrevious &&
    a.canNext === b.canNext
  )
}

/**
 * What the card shows, and the one call it makes back. Reads the tab that is
 * making the sound, on a poll, and stops entirely when the card is off: this
 * hook owns the recorder's registration too, so switching the card off takes
 * the page-world script off every site with it.
 */
export function useMediaSession(enabled: boolean): MediaState {
  const available = mediaBridgeAvailable()
  /** `null` until the first check answers. */
  const [access, setAccess] = useState<boolean | null>(null)
  const [snapshot, setSnapshot] = useState<MediaSnapshot | null>(null)

  useEffect(() => {
    if (!enabled || !available) return

    let cancelled = false
    const check = () => {
      void hasMediaAccess().then((granted) => {
        if (!cancelled) setAccess(granted)
      })
    }

    check()
    const unwatch = watchMediaAccess(check)

    return () => {
      cancelled = true
      unwatch()
    }
  }, [enabled, available])

  // The recorder follows the card: registered while it is on and permitted,
  // gone the moment either stops being true. Nothing is left behind on every
  // site the user visits once the card is switched off.
  //
  // A card that is on but has not heard back yet leaves the registration
  // exactly as it is. Tearing it down on every new tab and putting it back a
  // moment later would cost every page that happened to load in the gap the
  // handlers it was opened to record.
  useEffect(() => {
    if (!available) return
    if (!enabled) {
      void removeMediaHook()
      return
    }
    if (access === null) return
    if (access) void installMediaHook()
    else void removeMediaHook()
  }, [enabled, available, access])

  const refresh = useCallback(async () => {
    const next = await readMedia()
    setSnapshot((current) => (sameSnapshot(current, next) ? current : next))
  }, [])

  useEffect(() => {
    // Nothing to poll, and nothing to clear either: a reading left over from
    // before the card was switched off is unreachable, since the status below
    // answers "blocked" or the card renders nothing at all until the next tick
    // has replaced it.
    if (!enabled || access !== true) return

    let cancelled = false
    let timer = 0

    const tick = async () => {
      // A background tab is not being read by anyone: on a new-tab page that
      // has been left open for a day, this is the difference between a poll
      // and a poll that ran forty thousand times.
      if (document.visibilityState === "visible") await refresh()
      if (cancelled) return
      timer = window.setTimeout(() => void tick(), POLL_INTERVAL)
    }

    void tick()

    // A tab switched back to should be right immediately, not up to two
    // seconds later.
    const wake = () => void refresh()
    document.addEventListener("visibilitychange", wake)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", wake)
    }
  }, [enabled, access, refresh])

  // The settle timer outlives the call that set it, so it is held here rather
  // than left running: a card switched off (or a page navigated away from) a
  // moment after a skip should not still be reading another tab afterwards.
  const settle = useRef(0)
  useEffect(() => () => window.clearTimeout(settle.current), [])

  const send = useCallback(
    (action: MediaAction) => {
      void sendMedia(action).then(() => {
        window.clearTimeout(settle.current)
        settle.current = window.setTimeout(() => void refresh(), SETTLE_DELAY)
      })
    },
    [refresh]
  )

  const grant = useCallback(() => {
    // Straight from the click, no `await` in front of it: see
    // `requestMediaAccess`.
    void requestMediaAccess().then((granted) => setAccess(granted))
  }, [])

  if (!available) return { status: "unavailable" }
  if (access === null) return { status: "checking" }
  if (!access) return { status: "blocked", grant }
  if (!snapshot) return { status: "idle" }

  return { status: "ready", data: snapshot, send }
}
