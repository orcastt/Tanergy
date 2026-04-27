import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { editorShadows } from "../../styles/editorDesign"

interface Props {
  filePath: string
  description: string
  selected?: boolean
  onClick?: () => void
}

export default function ImageThumb({ filePath, description, selected, onClick }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    invoke<number[]>("read_asset_file", { filePath })
      .then((bytes) => {
        if (cancelled) return
        const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(""))
        setSrc(`data:image/png;base64,${base64}`)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [filePath])

  if (!src) {
    return (
      <div style={{
        width: "100%", aspectRatio: "4/3", background: "var(--bg-hover)",
        borderRadius: "0.25rem", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "0.625rem", color: "var(--text-secondary)",
      }}>...</div>
    )
  }

  return (
    <img
      src={src}
      alt={description}
      onClick={onClick}
      style={{
        width: "100%", borderRadius: "0.25rem", objectFit: "cover",
        cursor: onClick ? "pointer" : "default",
        boxShadow: selected ? editorShadows.focus : "none",
        transition: "box-shadow 150ms ease",
      }}
    />
  )
}
