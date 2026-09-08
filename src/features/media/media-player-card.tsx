import { useState } from "react"
import { Music, Pause, Play, ShieldCheck, SkipBack, SkipForward } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useFloatingCard } from "@/features/floating/use-floating-card"
import { cn } from "@/lib/utils"

import { useMediaSession } from "./use-media-session"
import { useMediaStore } from "./media-store"
import type { MediaSnapshot } from "./types"

/** One of the three transport buttons. Disabled rather than hidden: a player
 * that offers no skips should still look like a player. */
function Control({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center rounded-full text-foreground transition-opacity hover:opacity-70",
        "disabled:pointer-events-none disabled:opacity-30",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        primary ? "size-8" : "size-7"
      )}
    >
      <Icon className={primary ? "size-5" : "size-4"} />
    </button>
  )
}

function NowPlaying({
  data,
  onAction,
}: {
  data: MediaSnapshot
  onAction: (action: "previoustrack" | "nexttrack" | "play" | "pause") => void
}) {
  // The cover that would not load, held by URL rather than as a flag: the next
  // track brings a new one, and that one deserves its own attempt.
  const [failed, setFailed] = useState<string | null>(null)
  const artwork = data.artwork && data.artwork !== failed ? data.artwork : null

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {artwork ? (
          <img
            src={artwork}
            alt=""
            className="size-9 shrink-0 rounded-md object-cover"
            // A cover that 404s or is blocked leaves a broken frame behind;
            // forgetting it falls back to the plain layout beside it.
            onError={() => setFailed(artwork)}
          />
        ) : (
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground/10">
            <Music className="size-4 text-muted-foreground" />
          </div>
        )}

        {/* `min-w-0` on both: without it the title's longest word sets the
            width and takes the card, fixed to a corner, off the screen. */}
        <div className="grid min-w-0 gap-0.5">
          <p className="truncate text-sm leading-none font-medium text-foreground" title={data.title}>
            {data.title}
          </p>
          {data.artist && (
            <p className="truncate text-xs text-muted-foreground" title={data.artist}>
              {data.artist}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1">
        <Control
          icon={SkipBack}
          label="Previous track"
          onClick={() => onAction("previoustrack")}
          disabled={!data.canPrevious}
        />
        <Control
          icon={data.playing ? Pause : Play}
          label={data.playing ? "Pause" : "Play"}
          onClick={() => onAction(data.playing ? "pause" : "play")}
          primary
        />
        <Control
          icon={SkipForward}
          label="Next track"
          onClick={() => onAction("nexttrack")}
          disabled={!data.canNext}
        />
      </div>
    </div>
  )
}

/**
 * Floating overlay, corner set in settings, same treatment as the weather and
 * checklist cards.
 *
 * It plays nothing itself: it shows whatever tab in this browser is already
 * making a sound, and hands the skips back to that page's own player
 * (`media-bridge.ts`). So there is no library here, nothing to add and nothing
 * stored - close the tab that was playing and the card goes quiet with it.
 */
export function MediaPlayerCard() {
  const enabled = useMediaStore((state) => state.enabled)
  const position = useMediaStore((state) => state.position)
  const media = useMediaSession(enabled)

  // Outside the extension there is no other tab to read and no permission that
  // could be granted, so the card stands down rather than showing a control
  // nobody can answer. The first permission check answers a moment after the
  // first paint, so this is what the corner is told about too: passing
  // `enabled` alone would leave the card unmeasured from the render where it
  // showed nothing, and it would then sit on top of whatever shares its corner.
  const visible = enabled && media.status !== "unavailable" && media.status !== "checking"
  const { ref, style, floating, placement } = useFloatingCard("media", position, visible)

  if (!visible) return null

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "glass-panel glass:p-3",
        // In a corner it has to be narrow enough to leave the page usable
        // behind it; in the dock it is one row of that page, so it takes the
        // column's width up to a comfortable reading measure.
        floating ? "w-[min(15rem,calc(100vw-3rem))]" : "w-full max-w-sm",
        placement
      )}
    >
      {media.status === "blocked" && (
        <button
          type="button"
          onClick={media.grant}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-opacity hover:opacity-80"
        >
          <ShieldCheck className="size-3.5" />
          Allow media access
        </button>
      )}

      {media.status === "idle" && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Music className="size-3.5" />
          Nothing playing
        </p>
      )}

      {media.status === "ready" && <NowPlaying data={media.data} onAction={media.send} />}
    </div>
  )
}
