import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Emits `manifest.json` from `manifest.config.json`, minus the keys the target
 * browser rejects. The "favicon" permission does not exist in Firefox, where AMO
 * flags it as invalid — `faviconUrl()` already falls back to a plain favicon
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
  ],
  resolve: {
    // Keep in sync with the "paths" entry in tsconfig.json.
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // The only browsers that will ever run this are the ones that can install
    // an MV3 extension, all of which are years past ES2022 — so nothing here
    // is downlevelled into the larger, slower equivalents.
    target: "es2022",
  },
}))
