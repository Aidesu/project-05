import type { Corner } from "@/lib/corner"

export type MediaPosition = Corner

/** The four things the card can ask a page to do, named as the Media Session
 * API names them so the recorded handlers can be looked up by action. */
export type MediaAction = "previoustrack" | "nexttrack" | "play" | "pause"

/** What is playing, as read from the tab making the sound. */
export type MediaSnapshot = {
  title: string
  /** The artist, or the album where the page names no artist. Often empty. */
  artist: string
  /** An `https:` cover, or `null` where the page publishes none. */
  artwork: string | null
  playing: boolean
  /** Whether the page registered a handler for that skip. Plenty of players
   * (a lone video, most embeds) register neither, and the card says so by
   * greying the button rather than by pressing a button that does nothing. */
  canPrevious: boolean
  canNext: boolean
}
