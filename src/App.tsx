import { Header } from "@/components/layout/header"
import { Toaster } from "@/components/ui/sonner"
import { SiteBoard } from "@/features/sites/site-board"

export default function App() {
  return (
    <div className="min-h-svh">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <SiteBoard />
      </main>
      <Toaster />
    </div>
  )
}
