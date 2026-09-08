import { useMediaQuery } from "./use-media-query"

/**
 * The line between the page's two shapes.
 *
 * Above it is the page this was designed around: exactly one viewport tall,
 * nothing scrolls but the news, and the weather, the player and the checklist
 * float in whichever corners settings put them in.
 *
 * None of that survives a narrow window. A corner card is 15 to 17.5rem wide
 * and it is positioned against the viewport, not against the centred column,
 * so the narrower the page the further it reaches into the middle of it: by
 * 48rem a checklist in a top corner is over the greeting and the board rather
 * than out in the margin beside them, and two cards facing each other across
 * the page have nothing left between them. So below this width the cards leave
 * the corners and stack into the page itself (`card-dock.tsx`), and the page
 * scrolls the way a page does: the feed keeps its own height instead of
 * dividing one screen between four things that all wanted it.
 *
 * The height clause is the same page in landscape. A viewport shorter than
 * 480px has nothing left to give the feed once a header, a greeting and a
 * board have taken theirs, however wide it is.
 *
 * Kept as a string rather than a Tailwind breakpoint because it is read from
 * JavaScript: what changes here is which elements exist and where they sit,
 * not only how they are painted.
 */
export const COMPACT_LAYOUT = "(max-width: 48rem), (max-height: 30rem)"

export function useCompactLayout(): boolean {
  return useMediaQuery(COMPACT_LAYOUT)
}

/**
 * The narrower line, and a different question: not whether the page has room
 * to lay cards around its edges, but whether the header has room to hold a
 * wordmark, a centred clock and the controls on one row. It is about width
 * alone, so a short landscape window - compact by the query above - still
 * gets the full header it has the width for.
 *
 * Anything laid out purely in CSS uses `max-[40rem]:` for the same line.
 */
export const NARROW_LAYOUT = "(max-width: 40rem)"

export function useNarrowLayout(): boolean {
  return useMediaQuery(NARROW_LAYOUT)
}
