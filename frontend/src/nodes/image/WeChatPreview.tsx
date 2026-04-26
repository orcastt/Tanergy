import { toStandardPurpleHtml } from "./standardPurpleHtml"
import { hydrateLocalImageHtml } from "./localImageHtml"

interface WeChatPreviewProps {
  html: string
}

export default function WeChatPreview({ html }: WeChatPreviewProps) {
  const previewHtml = hydrateLocalImageHtml(toStandardPurpleHtml(html))

  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: "#fff", overflow: "auto" }}>
      <div
        dangerouslySetInnerHTML={{ __html: previewHtml }}
        style={{
          width: "100%",
          minHeight: "100%",
          boxSizing: "border-box",
          padding: "2rem 3rem",
          background: "#fff",
          color: "#252525",
          fontSize: "15px",
          lineHeight: 1.8,
        }}
      />
      <div style={{ position: "sticky", bottom: 0, padding: "0.5rem 1rem", background: "rgba(255,255,255,0.92)", borderTop: "1px solid #f0f0f0", fontSize: "0.6875rem", color: "#878b8e" }}>
        标准紫预览 · 复制时会输出微信兼容内联样式 HTML
      </div>
    </div>
  )
}
