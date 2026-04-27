import { useTranslation } from "react-i18next"
import { toStandardPurpleHtml } from "./standardPurpleHtml"
import { hydrateLocalImageHtml } from "./localImageHtml"
import { editorColors, editorShadows } from "../../styles/editorDesign"

interface WeChatPreviewProps {
  html: string
}

export default function WeChatPreview({ html }: WeChatPreviewProps) {
  const { t } = useTranslation()
  const previewHtml = hydrateLocalImageHtml(toStandardPurpleHtml(html))

  return (
    <div style={{ height: "100%", boxSizing: "border-box", background: editorColors.surface, overflow: "auto" }}>
      <div
        dangerouslySetInnerHTML={{ __html: previewHtml }}
        style={{
          width: "100%",
          minHeight: "100%",
          boxSizing: "border-box",
          padding: "2rem 3rem",
          background: editorColors.surface,
          color: "#252525",
          fontSize: "15px",
          lineHeight: 1.8,
        }}
      />
      <div style={{ position: "sticky", bottom: 0, padding: "0.5rem 1rem", background: "rgba(255,255,255,0.92)", boxShadow: editorShadows.insetBottom, fontSize: "0.6875rem", color: editorColors.secondary }}>
        {t("html_editor.previewHint")}
      </div>
    </div>
  )
}
