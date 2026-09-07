/// <reference types="vite/client" />

/**
 * Extension globals, declared rather than pulled from `@types/chrome`: the app
 * only touches the namespaces below, and it must keep running in a plain tab
 * where neither exists. `browser` is Firefox's namespace and doubles as the
 * marker that tells the two engines apart.
 */
type ExtensionEvent = {
  addListener: (listener: () => void) => void
  removeListener: (listener: () => void) => void
}

/** Either half may be omitted: the news feed asks about hosts, the media
 * player about hosts and APIs together. */
type ExtensionPermissions = { permissions?: string[]; origins?: string[] }

type ExtensionTab = { id?: number; audible?: boolean }

type ExtensionApi = {
  runtime?: { id?: string; getURL?: (path: string) => string }
  /**
   * Optional access, asked for at the moment a feature needs it. Promise-
   * based on `browser` everywhere, and on `chrome` under MV3: the only two
   * shapes this page ever runs against.
   */
  permissions?: {
    contains: (permissions: ExtensionPermissions) => Promise<boolean>
    request: (permissions: ExtensionPermissions) => Promise<boolean>
    onAdded?: ExtensionEvent
    onRemoved?: ExtensionEvent
  }
  /** How the media player finds the tab that is making the sound. */
  tabs?: {
    query: (query: { audible?: boolean }) => Promise<ExtensionTab[]>
    get: (tabId: number) => Promise<ExtensionTab>
  }
  /**
   * How it reads and drives that tab. Everything the player injects runs in
   * the page's own world: a media session belongs to its document, and the
   * isolated world a content script normally gets cannot reach into it.
   */
  scripting?: {
    executeScript: <Result>(injection: {
      target: { tabId: number }
      world?: "MAIN" | "ISOLATED"
      func: (...args: never[]) => Result
      args?: unknown[]
    }) => Promise<{ result?: Result }[]>
    registerContentScripts: (
      scripts: {
        id: string
        matches: string[]
        js: string[]
        runAt?: "document_start" | "document_end" | "document_idle"
        world?: "MAIN" | "ISOLATED"
        allFrames?: boolean
        persistAcrossSessions?: boolean
      }[]
    ) => Promise<void>
    unregisterContentScripts: (filter: { ids: string[] }) => Promise<void>
    getRegisteredContentScripts: (filter?: { ids: string[] }) => Promise<{ id: string }[]>
  }
}

declare const chrome: ExtensionApi | undefined
declare const browser: ExtensionApi | undefined

interface Window {
  /**
   * The playing page's own media-session handlers, recorded by
   * `public/media-hook.js`. The Media Session API is write-only from the
   * outside: a site registers what "next track" means and the browser keeps
   * it, so the only way to press that button from here is to have taken a
   * reference as the site registered it.
   */
  __hiMediaHandlers?: Map<string, (details: { action: string }) => void>
}
