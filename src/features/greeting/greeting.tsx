import { useState } from "react"

import { randomGreeting } from "./greetings"

/** Standalone titlealways shown, independent of the weather card below it. */
export function Greeting() {
  const [greeting] = useState(randomGreeting)

  return (
    <p // Sized off the viewport rather than a breakpoint: it sits directly
    // above the feed, so on a short window the pixels it gives up are the
    // ones the news gets. `min()` keeps it from outgrowing a narrow window
    // as well as a short one.
    className="text-center text-[clamp(1.75rem,min(5svh,9vw),3rem)] leading-tight font-medium tracking-tight text-foreground">
      {greeting}
    </p>
  )
}
