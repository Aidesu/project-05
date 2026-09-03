import { cn } from "@/lib/utils"

import type { GradientSpec } from "./types"

/**
 * Each bloom is its own layer rather than one stacked `background-image`, so a
 * single bloom can drift on its own. The base colour stays on `background-color`
 *a bare colour in `background-image` invalidates the whole declaration.
 */
export function GradientSurface({
  spec,
  animated = false,
  className,
}: {
  spec: GradientSpec
  animated?: boolean
  className?: string
}) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundColor: spec.base }}
    >
      {spec.blooms.map((bloom, index) => (
        <div
          key={index}
          // Oversized so a drifting bloom never drags its own edge into view.
          className={cn("absolute -inset-[20%]", animated && "bloom-drift")}
          style={{
            backgroundImage: `radial-gradient(at ${bloom.x}% ${bloom.y}%, ${bloom.color} 0px, transparent 55%)`,
            // Prime numbers keep the layers from resynchronising into a pulse.
            animationDuration: `${37 + index * 13}s`,
            animationDelay: `-${index * 11}s`,
            animationDirection: index % 2 === 0 ? "normal" : "reverse",
          }}
        />
      ))}
    </div>
  )
}
