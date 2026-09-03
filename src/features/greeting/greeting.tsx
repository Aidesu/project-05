import { useState } from "react"

import { randomGreeting } from "./greetings"

/** Standalone titlealways shown, independent of the weather card below it. */
export function Greeting() {
  const [greeting] = useState(randomGreeting)

  return (
    <p className="text-center text-4xl leading-tight font-medium tracking-tight text-foreground sm:text-5xl">
      {greeting}
    </p>
  )
}
