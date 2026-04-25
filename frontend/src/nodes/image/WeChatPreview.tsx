interface WeChatPreviewProps {
  html: string
  maxHeight?: number
}

export default function WeChatPreview({ html, maxHeight = 500 }: WeChatPreviewProps) {
  return (
    <div style={{ padding: "1rem", height: "100%", boxSizing: "border-box", background: "#f5f5f5" }}>
      {/* Phone mockup */}
      <div style={{
        width: "280px",
        margin: "0 auto",
        background: "#fff",
        borderRadius: "1.5rem",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}>
        {/* Status bar */}
        <div style={{
          background: "#f5f3f3",
          padding: "0.5rem 0.75rem",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "#333",
        }}>
          <span>9:41</span>
          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
            <span>📶</span><span>🔋</span>
          </div>
        </div>
        {/* Content */}
        <div style={{
          padding: "0.75rem",
          maxHeight: `${maxHeight}px`,
          overflowY: "auto",
          background: "#fff",
        }}>
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ fontSize: "14px", lineHeight: "1.75", color: "#333" }}
          />
        </div>
      </div>
    </div>
  )
}
