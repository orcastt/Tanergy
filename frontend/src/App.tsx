import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./i18n"
import { useEffect } from "react"
import { useCreditsStore } from "./store/creditsStore"

import WelcomePage from "./pages/WelcomePage"
import DashboardPage from "./pages/DashboardPage"
import CanvasPage from "./pages/CanvasPage"
import SettingsPage from "./pages/SettingsPage"
import CreditsPage from "./pages/CreditsPage"
import NotFoundPage from "./pages/NotFoundPage"
import AuthGuard from "./components/AuthGuard"

export default function App() {
  const refresh = useCreditsStore((s) => s.refresh)

  useEffect(() => {
    refresh() // Check login status on startup
  }, [refresh])

  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/canvas/:id" element={<CanvasPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  )
}
