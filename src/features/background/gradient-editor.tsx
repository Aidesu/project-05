import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { TrackSlider } from "./color-slider"
import { GradientSurface } from "./gradient-surface"
import type { GradientBloom, GradientSpec } from "./types"

const MAX_BLOOMS = 5

type GradientEditorProps = {
  spec: GradientSpec
  onSave: (spec: GradientSpec) => void
  onCancel: () => void
}

export function GradientEditor({ spec, onSave, onCancel }: GradientEditorProps) {
  const [draft, setDraft] = useState(spec)

  function patchBloom(index: number, patch: Partial<GradientBloom>) {
    setDraft((current) => ({
      ...current,
      blooms: current.blooms.map((bloom, i) => (i === index ? { ...bloom, ...patch } : bloom)),
    }))
  }

  function addBloom() {
    setDraft((current) => ({
      ...current,
      blooms: [...current.blooms, { color: "#38bdf8", x: 50, y: 50 }],
    }))
  }

  function removeBloom(index: number) {
    setDraft((current) => ({
      ...current,
      blooms: current.blooms.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <GradientSurface spec={draft} className="aspect-video rounded-md border" />

      <Input
        value={draft.label}
        onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
        aria-label="Gradient name"
        placeholder="Gradient name"
      />

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="color"
          value={draft.base}
          onChange={(event) => setDraft((current) => ({ ...current, base: event.target.value }))}
          aria-label="Base color"
          className="h-8 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent"
        />
        Base color
      </label>

      <div className="grid gap-3">
        {draft.blooms.map((bloom, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bloom.color}
                onChange={(event) => patchBloom(index, { color: event.target.value })}
                aria-label={`Color of point ${index + 1}`}
                className="h-7 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent"
              />
              <span className="flex-1 text-xs text-muted-foreground">Point {index + 1}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeBloom(index)}
                disabled={draft.blooms.length <= 1}
                aria-label={`Remove point ${index + 1}`}
              >
                <Trash2 />
              </Button>
            </div>

            <TrackSlider
              label="X"
              ariaLabel={`Horizontal position of point ${index + 1}`}
              value={bloom.x}
              min={0}
              max={100}
              suffix="%"
              onChange={(value) => patchBloom(index, { x: value })}
              trackImage={`linear-gradient(to right, transparent, ${bloom.color})`}
            />
            <TrackSlider
              label="Y"
              ariaLabel={`Vertical position of point ${index + 1}`}
              value={bloom.y}
              min={0}
              max={100}
              suffix="%"
              onChange={(value) => patchBloom(index, { y: value })}
              trackImage={`linear-gradient(to right, transparent, ${bloom.color})`}
            />
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={addBloom}
        disabled={draft.blooms.length >= MAX_BLOOMS}
      >
        <Plus />
        Add a point
      </Button>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSave(draft)}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
