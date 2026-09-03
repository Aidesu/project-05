import { Header } from "@/components/layout/header"
import { Toaster } from "@/components/ui/sonner"
import { BackgroundLayer } from "@/features/background/background-layer"
import { useBackgroundContrast } from "@/features/background/use-background-contrast"
import { Greeting } from "@/features/greeting/greeting"
import { SiteBoard } from "@/features/sites/site-board"
import { WeatherCard } from "@/features/weather/weather-card"

export default function App() {
  const contrast = useBackgroundContrast()

  return (
    <div className="min-h-svh">
      <BackgroundLayer />
      {/* Only this partnot the background layer or the Toasterneeds to
          flip with the background's lightness: everything here sits
          directly on it with no opaque surface behind. */}
      <div data-on-bg={contrast ?? undefined}>
        <Header />
        <WeatherCard />
        <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-16 pb-10">
          <Greeting />
          <SiteBoard />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
