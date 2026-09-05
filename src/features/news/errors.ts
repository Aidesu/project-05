/** Thrown for failures worth showing verbatim in the feed (vs. a generic fallback). */
export class NewsApiError extends Error {}

/**
 * The sources for this desk are read straight from the publishers, which the
 * browser only allows once the extension holds host access for them. Its own
 * class because it is the one failure the feed can *offer to fix*: it puts a
 * button under the message rather than a plain retry.
 */
export class NewsAccessError extends NewsApiError {
  constructor() {
    super("These sources need your permission to load.")
  }
}
