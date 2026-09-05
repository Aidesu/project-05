import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Every host the news feed reads, as match patterns, taken from the same
 * catalogue the app fetches from. Derived rather than written out again: a
 * feed added to `feeds.json` would otherwise be fetched from a host the
 * manifest never asked for, and fail in production for want of one line.
 */
function feedOrigins(): string[] {
  const catalog = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, "src/features/news/feeds.json"), "utf8")
  ) as Record<string, { url: string }[]>

  const origins = Object.values(catalog)
    .flat()
    .map((feed) => `https://${new URL(feed.url).hostname}/*`)

  return [...new Set(origins)].sort()
}

/**
 * Reads the publishers' feeds on behalf of `npm run dev`.
 *
 * A built extension fetches them directly, which is what host access is for.
 * The dev server is a plain `http://localhost` page with no extension around
 * it and so no permission to fall back on, and every one of these feeds
 * answers without CORS headers, so the news feed would be untestable locally.
 * `apply: "serve"` keeps the whole thing out of any build.
 *
 * Restricted to the catalogue's own hosts: a dev server that would fetch any
 * address a page names is an open proxy on the developer's machine.
 */
function feedProxy(): Plugin {
  const allowed = new Set(feedOrigins().map((origin) => new URL(origin).hostname))

  return {
    name: "feed-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__feed", (request, response) => {
        const target = new URL(request.url ?? "", "http://localhost").searchParams.get("url")
        const hostname = target && URL.canParse(target) ? new URL(target).hostname : null

        // The catalogue is always readable. Anything else (a feed someone
        // added by hand) only for the dev page itself: the browser sets
        // `Sec-Fetch-Site` and a page on another origin cannot forge it, so
        // this never becomes an open proxy on the developer's machine.
        const fromDevPage = request.headers["sec-fetch-site"] === "same-origin"
        const readable = hostname !== null && (allowed.has(hostname) || fromDevPage)

        if (!target || !readable || !target.startsWith("https://")) {
          response.statusCode = 403
          return response.end("Not a feed this dev server will fetch.")
        }

        fetch(target)
          .then(async (upstream) => {
            response.statusCode = upstream.status
            response.setHeader("content-type", "application/xml; charset=utf-8")
            response.end(await upstream.text())
          })
          .catch((error: unknown) => {
            response.statusCode = 502
            response.end(String(error))
          })
      })
    },
  }
}

/**
 * Emits `manifest.json` from `manifest.config.json`, minus the keys the target
 * browser rejects. The "favicon" permission does not exist in Firefox, where AMO
 * flags it as invalid, `faviconUrl()` already falls back to a plain favicon
 * service there, so dropping it costs nothing. `startup_pages` is the mirror
 * case: Chrome-only, and Firefox covers startup through `homepage` instead.
 */
function manifest(target: "chrome" | "firefox"): Plugin {
  return {
    name: "manifest",
    generateBundle() {
      const source = readFileSync(
        path.resolve(import.meta.dirname, "manifest.config.json"),
        "utf8"
      )
      const parsed = JSON.parse(source) as Record<string, unknown> & {
        permissions?: string[]
        chrome_settings_overrides?: Record<string, unknown>
      }

      // Optional, not required: the feed is off until someone turns it on, so
      // asking for forty newsrooms at install time would be asking for access
      // the extension may never use. It is requested from the feed's own
      // "Allow these sources" button instead, for the desks actually open.
      // The catalogue's hosts, plus the ceiling that user-added feeds are
      // requested against: their hosts cannot be known at build time, and a
      // browser only grants an origin that some declared pattern covers. It is
      // a ceiling and not a grant, optional permissions are never handed over
      // at install, and the app always asks for the single host it is about to
      // read, never this.
      parsed.optional_host_permissions = [...feedOrigins(), "https://*/*"]

      if (target === "firefox") {
        const permissions = parsed.permissions?.filter((p) => p !== "favicon")
        if (permissions?.length) parsed.permissions = permissions
        else delete parsed.permissions

        delete parsed.chrome_settings_overrides?.startup_pages
      }

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: `${JSON.stringify(parsed, null, 2)}\n`,
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths: inside an extension "/" is the extension root, not
  // the page's folder, and absolute URLs would 404 on the new-tab page.
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    manifest(mode === "firefox" ? "firefox" : "chrome"),
    feedProxy(),
  ],
  resolve: {
    // Keep in sync with the "paths" entry in tsconfig.json.
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // The only browsers that will ever run this are the ones that can install
    // an MV3 extension, all of which are years past ES2022, so nothing here
    // is downlevelled into the larger, slower equivalents.
    target: "es2022",
  },
}))
