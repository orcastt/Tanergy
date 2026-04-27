import type { CSSProperties } from "react"

export const editorColors = {
  canvas: "var(--bg-canvas, #f5f3f3)",
  surface: "var(--bg-surface, #ffffff)",
  hover: "var(--bg-hover, #f5f3f3)",
  text: "var(--text-primary, #0E0F0F)",
  secondary: "var(--text-secondary, #5E5E5E)",
  placeholder: "var(--text-placeholder, #C4C7C7)",
  primary: "#242424",
  danger: "#EF4444",
  success: "#22C55E",
  running: "#3B82F6",
}

export const editorShadows = {
  ring: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
  focus: "0 0 0 2px #242424, 0 4px 6px -1px rgba(0,0,0,0.1)",
  modal: "rgba(19,19,22,0.7) 0 1px 5px -4px, rgba(34,42,53,0.10) 0 0 0 1px, rgba(34,42,53,0.12) 0 16px 48px",
  panel: "0 0 0 1px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.08)",
  insetBottom: "inset 0 -1px 0 rgba(0,0,0,0.05)",
  insetRight: "inset -1px 0 0 rgba(0,0,0,0.05)",
  insetLeft: "inset 1px 0 0 rgba(0,0,0,0.05)",
}

export const editorTypography = {
  title: { fontFamily: '"Space Grotesk", sans-serif', letterSpacing: "-0.02em", fontWeight: 700 },
  label: { fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
} satisfies Record<string, CSSProperties>

export const iconButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "none",
  background: editorColors.surface,
  color: editorColors.secondary,
  boxShadow: editorShadows.ring,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

export const secondaryButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 6,
  background: editorColors.surface,
  color: editorColors.text,
  boxShadow: editorShadows.ring,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.45rem 0.75rem",
}

export const primaryButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  background: editorColors.primary,
  color: "#ffffff",
  boxShadow: "rgba(255,255,255,0.15) 0 2px 0 inset, 0 1px 2px rgba(0,0,0,0.05)",
}

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  borderRadius: 0,
  background: "transparent",
  color: editorColors.text,
  fontFamily: '"Inter", sans-serif',
  fontSize: "0.8125rem",
  outline: "none",
  boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)",
  padding: "0.55rem 0.125rem",
}
