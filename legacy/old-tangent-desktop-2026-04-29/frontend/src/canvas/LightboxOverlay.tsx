import { useState, useEffect } from "react"
import { useOverlayStore } from "../store/overlayStore"
import { Z } from "./OverlayLayer"
import { invoke } from "@tauri-apps/api/core"

export default function LightboxOverlay() {
  const { lightboxImage, closeLightbox } = useOverlayStore()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!lightboxImage) return
    let cancelled = false
    invoke<number[]>("read_asset_file", { filePath: lightboxImage.filePath })
      .then((bytes) => {
        if (cancelled) return
        const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
        setSrc(`data:image/png;base64,${base64}`)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [lightboxImage])

  if (!lightboxImage) return null

  return (
    <div
      onClick={closeLightbox}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: Z.FULLSCREEN, padding: "2rem", pointerEvents: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "0.75rem", padding: "1rem",
        maxWidth: "90vw", maxHeight: "90vh", display: "flex",
        flexDirection: "column", gap: "0.75rem",
      }}>
        {src ? (
          <img src={src} alt={lightboxImage.description} style={{
            maxWidth: "100%", maxHeight: "60vh", objectFit: "contain",
            borderRadius: "0.375rem",
          }} />
        ) : (
          <div style={{ padding: "2rem", color: "var(--text-secondary)", textAlign: "center" }}>加载中...</div>
        )}
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {lightboxImage.description}{lightboxImage.position ? ` — ${lightboxImage.position}` : ""}
        </div>
        {lightboxImage.prompt && (
          <div style={{ fontSize: "0.6875rem", color: "var(--text-placeholder)", maxHeight: "40px", overflow: "auto" }}>
            {lightboxImage.prompt}
          </div>
        )}
      </div>
    </div>
  )
}
