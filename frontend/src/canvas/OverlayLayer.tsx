import { type ReactNode } from "react"
import { createPortal } from "react-dom"

export const Z = {
  CONTROLS: 20,
  TOOLBAR: 100,
  PICKER: 110,
  AGENT_PANEL: 150,
  AGENT_TOGGLE: 200,
  CTX_OVERLAY: 300,
  CTX_MENU: 310,
  FULLSCREEN: 400,
} as const

export default function OverlayLayer({ children }: { children: ReactNode }) {
  return createPortal(
    <div
      data-overlay-layer
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
