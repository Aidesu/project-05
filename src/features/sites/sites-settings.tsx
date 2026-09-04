import { useState, type ChangeEvent } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Section } from "@/features/settings/section"

import { buildSitesExport, parseSitesExport, sitesExportFilename } from "./import-export"
import { useSitesStore } from "./sites-store"

export function SitesSettings() {
  const sites = useSitesStore((state) => state.sites)
  const importSites = useSitesStore((state) => state.importSites)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const data = await buildSitesExport(sites)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = sitesExportFilename()
      link.click()

      URL.revokeObjectURL(url)
    } catch {
      toast.error("Could not export sites.")
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // so re-picking the same file still fires onChange
    if (!file) return

    setBusy(true)
    try {
      const result = await parseSitesExport(await file.text())
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const { added, skipped } = importSites(result.sites)
      if (added === 0) {
        // parseSitesExport already rejects an empty file, so getting here
        // means every site it found is already on the board.
        toast.error("Nothing to import: every site in that file is already on the board.")
      } else {
        toast.success(
          `${added} site${added === 1 ? "" : "s"} imported.` +
            (skipped > 0 ? ` ${skipped} already on the board, skipped.` : "")
        )
      }
    } catch {
      toast.error("Could not import sites.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Sites" hint="Export goes to a JSON file; import merges into what's on the board.">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleExport()}
          disabled={busy || sites.length === 0}
        >
          <Download />
          Export
        </Button>

        <Button asChild variant="secondary" size="sm" disabled={busy}>
          <label className="cursor-pointer">
            <Upload />
            Import
            <input
              type="file"
              accept="application/json"
              onChange={(event) => void handleImport(event)}
              className="sr-only"
            />
          </label>
        </Button>
      </div>
    </Section>
  )
}
