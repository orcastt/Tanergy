import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./i18n"

import WelcomePage from "./pages/WelcomePage"
import DashboardPage from "./pages/DashboardPage"
import CanvasPage from "./pages/CanvasPage"
import SettingsPage from "./pages/SettingsPage"
import NotFoundPage from "./pages/NotFoundPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/canvas/:id" element={<CanvasPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
