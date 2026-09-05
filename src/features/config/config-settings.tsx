import { useState, type ChangeEvent } from "react"
import { Download, Upload } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Section } from "@/features/settings/section"

import { applyConfig, discardConfig } from "./apply-config"
import {
  buildConfigExport,
  configExportFilename,
  describeConfig,
  parseConfigFile,
  type ConfigImport,
  type Theme,
} from "./config-file"

/**
 * The one place a whole board leaves and enters the browser: theme,
 * background, sites, and every card's switch, corner and contents in a single
 * file, so the same setup can be put back on another device.
 */
export function ConfigSettings() {
  const { theme, setTheme } = useTheme()
  const [busy, setBusy] = useState(false)
  /** A parsed file waiting on the confirmation dialog — importing replaces. */
  const [pending, setPending] = useState<ConfigImport | null>(null)

  const activeTheme: Theme = theme === "light" || theme === "dark" ? theme : "system"

  async function handleExport() {
    setBusy(true)
    try {
      const { file, skippedAssets } = await buildConfigExport(activeTheme)
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = configExportFilename()
      link.rel = "noopener"
      link.click()

      // Revoked on the next task, not here: Firefox reads the blob after the
      // click returns, and pulling the URL out from under it saves an empty
      // file.
      setTimeout(() => URL.revokeObjectURL(url), 0)

      if (skippedAssets > 0) {
        toast.warning(
          `Exported, but ${skippedAssets} upload${skippedAssets === 1 ? " was" : "s were"} too large to include.`
        )
      }
    } catch {
      toast.error("Could not export your configuration.")
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // so re-picking the same file still fires onChange
    if (!file) return

    setBusy(true)
    try {
      const result = await parseConfigFile(await file.text())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setPending(result.config)
    } catch {
      toast.error("Could not read that file.")
    } finally {
      setBusy(false)
    }
  }

  function handleConfirm() {
    if (!pending) return

    applyConfig(pending, setTheme)
    setPending(null)
    toast.success("Configuration imported.")
  }

  function handleCancel() {
    if (pending) discardConfig(pending)
    setPending(null)
  }

  return (
    <>
      <Section
        title="Configuration"
        hint="One file with everything on this page — theme, background, sites, cards and where they sit. Importing replaces this device's setup with the file's."
      >
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void handleExport()} disabled={busy}>
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
                onChange={(event) => void handleFile(event)}
                className="sr-only"
              />
            </label>
          </Button>
        </div>
      </Section>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this setup?</AlertDialogTitle>
            <AlertDialogDescription>
              What this file carries takes the place of what's on this device. Anything it
              doesn't carry is left alone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="grid gap-1 text-sm text-muted-foreground">
            {(pending ? describeConfig(pending) : []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirm}>
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
