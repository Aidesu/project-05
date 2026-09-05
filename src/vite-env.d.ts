/// <reference types="vite/client" />

/**
 * Extension globals, declared rather than pulled from `@types/chrome`: the app
 * only touches the two namespaces below, and it must keep running in a plain
 * tab where neither exists. `browser` is Firefox's namespace and doubles as
 * the marker that tells the two engines apart.
 */
type ExtensionEvent = {
  addListener: (listener: () => void) => void
  removeListener: (listener: () => void) => void
}

type ExtensionApi = {
  runtime?: { id?: string; getURL?: (path: string) => string }
  /**
   * Optional host access, asked for at the moment a desk needs it. Promise-
   * based on `browser` everywhere, and on `chrome` under MV3: the only two
   * shapes this page ever runs against.
   */
  permissions?: {
    contains: (permissions: { origins: string[] }) => Promise<boolean>
    request: (permissions: { origins: string[] }) => Promise<boolean>
    onAdded?: ExtensionEvent
    onRemoved?: ExtensionEvent
  }
}

declare const chrome: ExtensionApi | undefined
declare const browser: ExtensionApi | undefined
