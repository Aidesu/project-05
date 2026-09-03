import { Header } from "@/components/layout/header"
import { Toaster } from "@/components/ui/sonner"
import { BackgroundLayer } from "@/features/background/background-layer"
import { SiteBoard } from "@/features/sites/site-board"

export default function App() {
  return (
    <div className="min-h-svh">
      <BackgroundLayer />
      <Header />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <SiteBoard />
      </main>
      <Toaster />
    </div>
  )
}
