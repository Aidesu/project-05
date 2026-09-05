import type { ReactNode } from "react"

/**
 * One labelled block of settings. Every section in the panel uses this.
 *
 * The rule that separates them lives here rather than between them, so the
 * panel's rhythm is set in one place: a section owns the space and the line
 * above itself, and the first one drops both. That is what keeps the gap even
 * no matter which features are on screen, and it means a new settings block
 * inherits the spacing simply by being a `Section`.
 */
export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-3 border-t-2 border-border pt-7 first:border-t-0 first:pt-0">
      <h2 className="text-base leading-none font-semibold tracking-tight">{title}</h2>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </section>
  )
}
