import { useState, type ChangeEvent } from "react"
import { Pencil, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Section } from "@/features/settings/section"
import { putAsset } from "@/lib/asset-store"
import { normalizeUrl } from "@/lib/url"

import { useBackgroundStore } from "./background-store"
import { RgbSliders, TrackSlider } from "./color-slider"
import { GradientEditor } from "./gradient-editor"
import { GradientSurface } from "./gradient-surface"
import { MediaFitPicker } from "./media-fit-picker"
import { COLOR_SWATCHES } from "./presets"
import { DEFAULT_MEDIA_EFFECTS, type BackgroundKind, type GradientSpec, type MediaEffects } from "./types"
import { useMediaAccentColor } from "./use-media-accent-color"

const NEUTRAL_TRACK = "linear-gradient(to right, var(--muted), var(--foreground))"

const EFFECT_SLIDERS: {
  key: keyof MediaEffects
  label: string
  ariaLabel: string
  max: number
  suffix: string
}[] = [
  { key: "blur", label: "Blur", ariaLabel: "Blur", max: 20, suffix: "px" },
  { key: "dim", label: "Dark", ariaLabel: "Darken", max: 100, suffix: "%" },
  { key: "grayscale", label: "Gray", ariaLabel: "Grayscale", max: 100, suffix: "%" },
  { key: "saturate", label: "Sat", ariaLabel: "Saturation", max: 200, suffix: "%" },
]

const KINDS: { value: BackgroundKind; label: string }[] = [
  { value: "gradient", label: "Gradient" },
  { value: "color", label: "Color" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
]

/** Kept well under the practical IndexedDB comfort zone for a single blob. */
const MAX_UPLOAD_MB: Record<"image" | "video", number> = { image: 10, video: 50 }

export function BackgroundSettings() {
  const background = useBackgroundStore((state) => state.background)
  const gradients = useBackgroundStore((state) => state.gradients)
  const gradientAnimated = useBackgroundStore((state) => state.gradientAnimated)
  const mediaEffects = useBackgroundStore((state) => state.mediaEffects)
  const mediaFit = useBackgroundStore((state) => state.mediaFit)
  const mediaPosition = useBackgroundStore((state) => state.mediaPosition)
  const setBackground = useBackgroundStore((state) => state.setBackground)
  const setGradientAnimated = useBackgroundStore((state) => state.setGradientAnimated)
  const setMediaFit = useBackgroundStore((state) => state.setMediaFit)
  const setMediaPosition = useBackgroundStore((state) => state.setMediaPosition)
  const setMediaEffects = useBackgroundStore((state) => state.setMediaEffects)
  const saveGradient = useBackgroundStore((state) => state.saveGradient)
  const resetGradients = useBackgroundStore((state) => state.resetGradients)
  const mediaAccentColor = useMediaAccentColor()

  const [kind, setKind] = useState<BackgroundKind>(background.kind)
  const [mediaUrl, setMediaUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<GradientSpec | null>(null)

  const currentColor = background.kind === "color" ? background.color : COLOR_SWATCHES[0]

  function selectKind(next: BackgroundKind) {
    setKind(next)
    setEditing(null)

    // Colour and gradient can show a result immediately; image and video wait
    // for a file or an address before anything changes on screen.
    if (next === "color" && background.kind !== "color") {
      setBackground({ kind: "color", color: COLOR_SWATCHES[0] })
    }
    if (next === "gradient" && background.kind !== "gradient" && gradients.length > 0) {
      setBackground({ kind: "gradient", preset: gradients[0].id })
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>, media: "image" | "video") {
    const file = event.target.files?.[0]
    event.target.value = "" // so re-picking the same file still fires onChange
    if (!file) return

    if (file.size > MAX_UPLOAD_MB[media] * 1024 * 1024) {
      toast.error(`File too large (max ${MAX_UPLOAD_MB[media]} MB).`)
      return
    }

    setBusy(true)
    try {
      const assetId = await putAsset(file)
      setBackground({ kind: media, source: { type: "upload", assetId } })
      toast.success("Background updated.")
    } catch {
      toast.error("Could not save this file.")
    } finally {
      setBusy(false)
    }
  }

  function applyUrl(media: "image" | "video") {
    const url = normalizeUrl(mediaUrl)
    if (!url) {
      toast.error("Invalid address.")
      return
    }
    setBackground({ kind: media, source: { type: "url", url } })
    setMediaUrl("")
    toast.success("Background updated.")
  }

  function handleSaveGradient(spec: GradientSpec) {
    saveGradient(spec)
    setBackground({ kind: "gradient", preset: spec.id })
    setEditing(null)
    toast.success("Gradient saved.")
  }

  return (
    <Section title="Background">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(({ value, label }) => (
          <Button
            key={value}
            size="xs"
            variant={kind === value ? "default" : "secondary"}
            onClick={() => selectKind(value)}
            aria-pressed={kind === value}
          >
            {label}
          </Button>
        ))}
      </div>

      {kind === "color" && (
        <div className="grid gap-3 pt-1">
          <div className="grid grid-cols-8 gap-1.5">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBackground({ kind: "color", color })}
                aria-label={`Color ${color}`}
                style={{ backgroundColor: color }}
                className={`aspect-square rounded-md border transition-transform hover:scale-110 ${
                  currentColor === color ? "ring-[3px] ring-ring/50" : ""
                }`}
              />
            ))}
          </div>

          <RgbSliders
            color={currentColor}
            onChange={(color) => setBackground({ kind: "color", color })}
          />

          <div className="flex items-center gap-2">
            <div
              className="size-8 shrink-0 rounded-md border"
              style={{ backgroundColor: currentColor }}
            />
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {currentColor}
            </span>
          </div>
        </div>
      )}

      {kind === "gradient" && (
        <div className="grid gap-3 pt-1">
          <div className="grid grid-cols-3 gap-2">
            {gradients.map((gradient) => (
              <div key={gradient.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setBackground({ kind: "gradient", preset: gradient.id })}
                  title={gradient.label}
                  aria-label={gradient.label}
                  className={`block w-full rounded-md transition-transform hover:scale-105 ${
                    background.kind === "gradient" && background.preset === gradient.id
                      ? "ring-[3px] ring-ring/50"
                      : ""
                  }`}
                >
                  <GradientSurface
                    spec={gradient}
                    className="aspect-video w-full rounded-md border"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(gradient)}
                  aria-label={`Edit ${gradient.label}`}
                  className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover:opacity-100"
                >
                  <Pencil className="size-2.5" />
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={gradientAnimated}
              onCheckedChange={(checked) => setGradientAnimated(checked === true)}
            />
            Animate blooms
          </label>

          {editing ? (
            <GradientEditor
              key={editing.id}
              spec={editing}
              onSave={handleSaveGradient}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={() => {
                resetGradients()
                toast.success("Gradients reset.")
              }}
            >
              <RotateCcw />
              Reset
            </Button>
          )}
        </div>
      )}

      {(kind === "image" || kind === "video") && (
        <div className="grid gap-3 pt-1">
          <Button asChild variant="secondary" size="sm" disabled={busy}>
            <label className="cursor-pointer">
              {busy ? "Saving…" : `Choose a file (max ${MAX_UPLOAD_MB[kind]} MB)`}
              <input
                type="file"
                accept={kind === "image" ? "image/*" : "video/*"}
                onChange={(event) => void handleUpload(event, kind)}
                className="sr-only"
              />
            </label>
          </Button>

          <div className="flex gap-2">
            <Input
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
              placeholder="…or paste an address"
              aria-label={kind === "image" ? "Image address" : "Video address"}
              autoComplete="off"
              spellCheck={false}
            />
            <Button size="sm" onClick={() => applyUrl(kind)}>
              Apply
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm">Fit</span>
            <MediaFitPicker
              value={mediaFit}
              onChange={setMediaFit}
              position={mediaPosition}
              onPositionChange={setMediaPosition}
              accentColor={mediaAccentColor}
            />
          </div>

          <div className="grid gap-2">
            {EFFECT_SLIDERS.map(({ key, label, ariaLabel, max, suffix }) => (
              <TrackSlider
                key={key}
                label={label}
                ariaLabel={ariaLabel}
                value={mediaEffects[key]}
                max={max}
                suffix={suffix}
                trackImage={NEUTRAL_TRACK}
                onChange={(value) => setMediaEffects({ [key]: value })}
              />
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={() => {
                setMediaEffects(DEFAULT_MEDIA_EFFECTS)
                toast.success("Effects reset.")
              }}
            >
              <RotateCcw />
              Reset effects
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}
