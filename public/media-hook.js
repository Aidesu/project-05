/**
 * Records what a page means by "previous track" and "next track".
 *
 * The Media Session API only goes one way: a site calls `setActionHandler` to
 * tell the browser what its media keys should do, and nothing can read those
 * handlers back afterwards - not another tab, not an extension. So this runs
 * in the page's own world at document_start, ahead of any player script, and
 * keeps a reference to each handler as it is registered. The new-tab page then
 * calls the recorded handler directly, which is the same function the site
 * would run for a media key.
 *
 * Deliberately tiny and deliberately passive: it wraps one method, keeps no
 * history, sends nothing anywhere, and is only ever registered while the media
 * card is switched on (`@/features/media/media-bridge`).
 */
;(() => {
  const session = navigator.mediaSession
  if (!session || window.__hiMediaHandlers) return

  const handlers = new Map()
  window.__hiMediaHandlers = handlers

  const original = session.setActionHandler.bind(session)

  session.setActionHandler = (action, handler) => {
    if (handler) handlers.set(action, handler)
    else handlers.delete(action)
    // The browser still has to get it: this observes the registration, it
    // does not stand in for it.
    return original(action, handler)
  }
})()
