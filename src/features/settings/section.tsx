import type { ReactNode } from "react"

/** One labelled block of settingsevery section in the panel uses this. */
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
    <section className="grid gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  )
}
