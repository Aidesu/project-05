import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Relative asset paths: inside an extension "/" is the extension root, not
  // the page's folder, and absolute URLs would 404 on the new-tab page.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // Keep in sync with the "paths" entry in tsconfig.json.
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
})
