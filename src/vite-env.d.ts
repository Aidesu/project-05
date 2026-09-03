/// <reference types="vite/client" />

/**
 * Extension globals, declared rather than pulled from `@types/chrome`: the app
 * only touches `runtime`, and it must keep running in a plain tab where neither
 * global exists. `browser` is Firefox's namespace and doubles as the marker
 * that tells the two engines apart.
 */
declare const chrome: { runtime?: { id?: string; getURL?: (path: string) => string } } | undefined
declare const browser: unknown
