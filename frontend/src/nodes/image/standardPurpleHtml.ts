const THEME = "#5965AF"
const THEME_LIGHT = "#EDE4F1"
const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "ul", "ol", "hr", "img", "pre", "table"])
const WRAPPER_TAGS = new Set(["body", "main", "article", "section", "div"])

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function inlineHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "")
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const el = node as HTMLElement
  const content = Array.from(el.childNodes).map(inlineHtml).join("")

  switch (el.tagName.toLowerCase()) {
    case "strong":
    case "b":
      return `<span style="font-weight:bold;color:${THEME};">${content}</span>`
    case "em":
    case "i":
      return `<span style="font-style:italic;">${content}</span>`
    case "u":
      return `<span style="text-decoration:underline;">${content}</span>`
    case "s":
    case "strike":
      return `<span style="text-decoration:line-through;">${content}</span>`
    case "a": {
      const href = el.getAttribute("href") ?? "#"
      return `<a href="${escapeHtml(href)}" style="color:${THEME};text-decoration:underline;">${content}</a>`
    }
    case "br":
      return "<br />"
    case "code":
      return `<code style="font-family:'Roboto Mono','Courier New',monospace;background:${THEME_LIGHT};color:${THEME};padding:2px 4px;border-radius:3px;">${content}</code>`
    case "mark":
      return `<span style="background:${THEME_LIGHT};color:${THEME};padding:2px 4px;border-radius:2px;">${content}</span>`
    case "span": {
      const style = el.getAttribute("style")
      return style ? `<span style="${escapeHtml(style)}">${content}</span>` : content
    }
    case "img":
      return el.outerHTML
    default:
      return content
  }
}

function renderBlock(el: HTMLElement, index: number): string {
  const tag = el.tagName.toLowerCase()
  const content = Array.from(el.childNodes).map(inlineHtml).join("").trim()
  if (!content && tag !== "img" && tag !== "hr") return ""

  if (tag === "h1") {
    return `<section style="margin:10px 0 30px;text-align:left;"><section style="display:inline-block;background:${THEME_LIGHT};color:${THEME};font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px;">${i18n.t("standard_purple.badge")}</section><section style="font-size:26px;font-weight:800;line-height:1.45;color:#252525;letter-spacing:0.2px;">${content}</section></section>`
  }

  if (tag === "h2") {
    const n = String(index).padStart(2, "0")
    return `<section style="margin-top:42px;margin-bottom:18px;display:flex;flex-direction:column;"><svg width="100" height="70" style="margin-bottom:-45px;display:block;" xmlns="http://www.w3.org/2000/svg"><text x="0" y="55" font-size="65" font-weight="900" fill="${THEME}" fill-opacity="0.15" font-family="Arial,sans-serif">${n}</text></svg><span style="font-size:22px;font-weight:700;line-height:1.6;color:#252525;display:block;position:relative;z-index:10;">${content}</span></section>`
  }

  if (tag === "h3") {
    return `<section style="display:inline-block;background-color:#1a1a1a;color:#ffffff;font-size:15px;font-weight:bold;padding:4px 12px;margin-top:30px;margin-bottom:10px;border-radius:2px;">${content}</section>`
  }

  if (tag === "h4" || tag === "h5" || tag === "h6") {
    return `<section style="font-size:16px;font-weight:bold;color:${THEME};margin-top:24px;margin-bottom:12px;display:flex;align-items:center;"><span style="display:inline-block;width:4px;height:16px;background-color:${THEME};margin-right:8px;border-radius:2px;"></span><span>${content}</span></section>`
  }

  if (tag === "blockquote") {
    return `<section style="padding:14px 18px;border-left:3px solid ${THEME};background:#fdfdfd;border-radius:5px;box-shadow:0px 2px 6px rgba(0,0,0,0.08);color:#878b8e;font-size:14px;line-height:1.6;font-style:italic;margin:28px 4px;"><span style="color:${THEME};font-weight:bold;font-style:normal;display:block;margin-bottom:8px;">💡 ${i18n.t("standard_purple.insight")}</span>${content}</section>`
  }

  if (tag === "ul" || tag === "ol") {
    const items = Array.from(el.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => `<li style="margin:8px 0;">${Array.from(child.childNodes).map(inlineHtml).join("")}</li>`)
      .join("")
    return `<section style="margin-top:18px;margin-bottom:18px;font-family:'Noto Sans SC',sans-serif;font-size:15px;line-height:1.8;color:#333333;"><${tag} style="padding-left:22px;margin:0;">${items}</${tag}></section>`
  }

  if (tag === "hr") {
    return `<section style="height:1px;background:${THEME_LIGHT};margin:28px 0;"></section>`
  }

  if (tag === "pre") {
    return `<section style="background-color:#1e1e2e;border-radius:10px;margin-top:24px;margin-bottom:24px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><section style="background-color:#252540;padding:12px 16px;border-bottom:1px solid #33334a;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ff5f56;margin-right:6px;"></span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ffbd2e;margin-right:6px;"></span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#27c93f;"></span></section><section style="padding:18px 20px;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:2;color:#e0e0e0;word-break:break-all;">${content}</section></section>`
  }

  if (tag === "table") {
    const rows = Array.from(el.querySelectorAll("tr"))
      .map((row, rowIndex) => {
        const cells = Array.from(row.children)
          .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
          .map((cell) => {
            const cellContent = Array.from(cell.childNodes).map(inlineHtml).join("")
            const isHeader = rowIndex === 0 || cell.tagName.toLowerCase() === "th"
            return `<td style="border:1px solid ${THEME_LIGHT};padding:8px 10px;font-size:14px;line-height:1.6;color:${isHeader ? THEME : "#333333"};font-weight:${isHeader ? "700" : "400"};background:${isHeader ? "#f5f3ff" : "#ffffff"};">${cellContent}</td>`
          })
          .join("")
        return `<tr>${cells}</tr>`
      })
      .join("")
    return `<section style="margin:24px 0;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid ${THEME_LIGHT};border-radius:8px;overflow:hidden;">${rows}</table></section>`
  }

  if (tag === "img") {
    const src = el.getAttribute("src") ?? ""
    const alt = el.getAttribute("alt") ?? el.getAttribute("data-tanvas-description") ?? ""
    const filePath = el.getAttribute("data-tanvas-file-path") ?? ""
    const remoteUrl = el.getAttribute("data-tanvas-remote-url") ?? ""
    const description = el.getAttribute("data-tanvas-description") ?? alt
    const position = el.getAttribute("data-tanvas-position") ?? ""
    const planId = el.getAttribute("data-tanvas-plan-id") ?? ""
    const metadata = [
      filePath ? ` data-tanvas-file-path="${escapeHtml(filePath)}"` : "",
      remoteUrl ? ` data-tanvas-remote-url="${escapeHtml(remoteUrl)}"` : "",
      description ? ` data-tanvas-description="${escapeHtml(description)}"` : "",
      position ? ` data-tanvas-position="${escapeHtml(position)}"` : "",
      planId ? ` data-tanvas-plan-id="${escapeHtml(planId)}"` : "",
    ].join("")

    return `<section data-tanvas-image="true" style="text-align:center;margin:24px 0;"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${metadata} style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;" />${description ? `<span style="display:block;margin-top:8px;color:#878b8e;font-size:12px;line-height:1.5;">${escapeHtml(description)}</span>` : ""}</section>`
  }

  if (content.includes("[配图") || content.includes("🖼️")) {
    return `<section style="text-align:center;margin:22px 0;padding:18px 20px;background:#f5f3ff;border:1px solid ${THEME_LIGHT};border-radius:10px;color:${THEME};font-size:14px;line-height:1.7;">${content}</section>`
  }

  return `<section style="margin-top:20px;font-family:'Noto Sans SC',sans-serif;font-weight:normal;font-size:15px;line-height:1.8;color:#333333;letter-spacing:0.5px;text-align:justify;">${content}</section>`
}

function isAlreadyStandardPurple(html: string) {
  return (
    html.includes("Tanvas 视觉规范") ||
    html.includes("Tanvas Visual System") ||
    (
      html.includes("fill=\"#5965AF\"") &&
      html.includes("margin-bottom:-45px") &&
      html.includes("font-size:22px")
    )
  )
}

function hasRenderableDescendant(el: HTMLElement): boolean {
  return Array.from(el.children).some((child) => {
    const childEl = child as HTMLElement
    const tag = childEl.tagName.toLowerCase()
    return BLOCK_TAGS.has(tag) || hasRenderableDescendant(childEl)
  })
}

function collectBlocks(el: HTMLElement, blocks: HTMLElement[] = []) {
  const tag = el.tagName.toLowerCase()

  if (BLOCK_TAGS.has(tag)) {
    blocks.push(el)
    return blocks
  }

  if (WRAPPER_TAGS.has(tag)) {
    if (hasRenderableDescendant(el)) {
      Array.from(el.children).forEach((child) => collectBlocks(child as HTMLElement, blocks))
    } else if ((el.textContent ?? "").trim()) {
      blocks.push(el)
    }
  }

  return blocks
}

export function toStandardPurpleHtml(html: string): string {
  if (!html.trim()) return ""
  if (isAlreadyStandardPurple(html)) {
    return html
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<main>${html}</main>`, "text/html")
  const blocks = collectBlocks(doc.body.firstElementChild as HTMLElement)
  let headingIndex = 1
  return blocks
    .map((node) => {
      const el = node as HTMLElement
      const rendered = renderBlock(el, headingIndex)
      if (el.tagName.toLowerCase() === "h2") headingIndex += 1
      return rendered
    })
    .filter(Boolean)
    .join("\n")
}
import i18n from "../../i18n"
