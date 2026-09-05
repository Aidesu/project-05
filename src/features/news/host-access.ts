import { useEffect } from "react"
import { create } from "zustand"

import { ALL_FEED_ORIGINS } from "./feed-catalog"

/**
 * Firefox's namespace first, then Chrome's: `browser` is promise-based on both
 * engines that expose it, where `chrome` is only promise-based under MV3.
 * Neither exists in a plain tab (`npm run dev`, or the page opened outside
 * the extension), and there the permission model simply doesn't apply.
 */
function permissionsApi() {
  const api = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : undefined
  return api?.permissions
}

/**
 * Whether the extension may read these hosts. `true` outside an extension:
 * there is no permission to hold there, and the fetch should be allowed to
 * fail on its own terms rather than be pre-empted by a prompt that cannot be
 * answered.
 */
export async function hasHostAccess(origins: string[]): Promise<boolean> {
  const permissions = permissionsApi()
  if (!permissions || origins.length === 0) return true

  try {
    return await permissions.contains({ origins })
  } catch {
    // A malformed pattern would reject here; letting the fetch try anyway
    // reports the real problem instead of a permission one.
    return true
  }
}

type HostAccessState = {
  /** `null` until the first check answers, or where there is no API to ask. */
  granted: boolean | null
  check: () => Promise<void>
  /** Must be called straight from a click: Firefox drops the user gesture
   * across an `await`, and refuses the prompt without one. */
  request: (origins: string[]) => Promise<boolean>
}

export const useHostAccessStore = create<HostAccessState>()((set) => ({
  granted: null,

  check: async () => {
    const permissions = permissionsApi()
    if (!permissions) return set({ granted: null })

    try {
      set({ granted: await permissions.contains({ origins: ALL_FEED_ORIGINS }) })
    } catch {
      set({ granted: null })
    }
  },

  request: async (origins) => {
    const permissions = permissionsApi()
    // Outside an extension there is nothing to grant and nothing blocking the
    // fetch either, so the caller should carry on. That is the same answer
    // `hasHostAccess` gives, for the same reason.
    if (!permissions) return true

    try {
      const granted = await permissions.request({ origins })
      // Asked for one desk's hosts, so the answer says nothing about the rest:
      // re-check the whole set rather than assume.
      if (granted) void useHostAccessStore.getState().check()
      return granted
    } catch {
      return false
    }
  },
}))

// Permissions are revocable from the browser's own UI at any time, so the
// store follows the browser rather than only its own prompts.
const permissions = permissionsApi()
const recheck = () => void useHostAccessStore.getState().check()
permissions?.onAdded?.addListener(recheck)
permissions?.onRemoved?.addListener(recheck)

/** `true`, `false`, or `null` while unknown. See `HostAccessState.granted`. */
export function useHostAccess(): boolean | null {
  const granted = useHostAccessStore((state) => state.granted)
  const check = useHostAccessStore((state) => state.check)

  useEffect(() => {
    void check()
  }, [check])

  return granted
}
