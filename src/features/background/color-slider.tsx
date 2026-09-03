import { hexToRgb, rgbToHex, type Rgb } from "@/lib/color"

const TRACK_CLASSES =
  "h-2 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
  "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow " +
  "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-foreground"

type TrackSliderProps = {
  value: number
  onChange: (value: number) => void
  label: string
  ariaLabel: string
  /** Painted into the track so the control previews its own effect. */
  trackImage: string
  min?: number
  max?: number
  suffix?: string
}

export function TrackSlider({
  value,
  onChange,
  label,
  ariaLabel,
  trackImage,
  min = 0,
  max = 255,
  suffix = "",
}: TrackSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ backgroundImage: trackImage }}
        className={TRACK_CLASSES}
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {value}
        {suffix}
      </span>
    </div>
  )
}

/** Three channel sliders, each track showing what moving it would produce. */
export function RgbSliders({
  color,
  onChange,
}: {
  color: string
  onChange: (hex: string) => void
}) {
  const rgb = hexToRgb(color)

  const channels: { key: keyof Rgb; label: string }[] = [
    { key: "r", label: "R" },
    { key: "g", label: "G" },
    { key: "b", label: "B" },
  ]

  return (
    <div className="grid gap-2">
      {channels.map(({ key, label }) => {
        const from = rgbToHex({ ...rgb, [key]: 0 })
        const to = rgbToHex({ ...rgb, [key]: 255 })

        return (
          <TrackSlider
            key={key}
            label={label}
            ariaLabel={`Channel ${label}`}
            value={rgb[key]}
            onChange={(value) => onChange(rgbToHex({ ...rgb, [key]: value }))}
            trackImage={`linear-gradient(to right, ${from}, ${to})`}
          />
        )
      })}
    </div>
  )
}
