const THEME = "#5965AF"
const THEME_LIGHT = "#EDE4F1"

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
    case "img":
      return el.outerHTML
    default:
      return content
  }
}

function renderBlock(el: HTMLElement, index: number): string {
  const tag = el.tagName.toLowerCase()
  const content = Array.from(el.childNodes).map(inlineHtml).join("").trim()
  if (!content && tag !== "img") return ""

  if (tag === "h1") {
    return `<section style="margin:10px 0 28px;font-size:26px;font-weight:800;line-height:1.45;color:#252525;letter-spacing:0.2px;">${content}</section>`
  }

  if (tag === "h2") {
    const n = String(index).padStart(2, "0")
    return `<section style="margin-top:42px;margin-bottom:18px;display:flex;flex-direction:column;"><svg width="100" height="70" style="margin-bottom:-45px;display:block;" xmlns="http://www.w3.org/2000/svg"><text x="0" y="55" font-size="65" font-weight="900" fill="${THEME}" fill-opacity="0.15" font-family="Arial,sans-serif">${n}</text></svg><span style="font-size:22px;font-weight:700;line-height:1.6;color:#252525;display:block;position:relative;z-index:10;">${content}</span></section>`
  }

  if (tag === "h3") {
    return `<section style="display:inline-block;background-color:#1a1a1a;color:#ffffff;font-size:15px;font-weight:bold;padding:4px 12px;margin-top:30px;margin-bottom:10px;border-radius:2px;">${content}</section>`
  }

  if (tag === "blockquote") {
    return `<section style="padding:14px 18px;border-left:3px solid ${THEME};background:#fdfdfd;border-radius:5px;box-shadow:0px 2px 6px rgba(0,0,0,0.08);color:#878b8e;font-size:14px;line-height:1.6;font-style:italic;margin:28px 4px;"><span style="color:${THEME};font-weight:bold;font-style:normal;display:block;margin-bottom:8px;">💡 核心洞察</span>${content}</section>`
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

  if (tag === "img") return el.outerHTML

  return `<section style="margin-top:20px;font-family:'Noto Sans SC',sans-serif;font-weight:normal;font-size:15px;line-height:1.8;color:#333333;letter-spacing:0.5px;text-align:justify;">${content}</section>`
}

export function toStandardPurpleHtml(html: string): string {
  if (!html.trim()) return ""
  if (html.includes("fill=\"#5965AF\"") || html.includes("color:#5965AF") || html.includes("Tanvas 视觉规范")) {
    return html
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<main>${html}</main>`, "text/html")
  let headingIndex = 1
  return Array.from(doc.body.firstElementChild?.children ?? [])
    .map((node) => {
      const el = node as HTMLElement
      const rendered = renderBlock(el, headingIndex)
      if (el.tagName.toLowerCase() === "h2") headingIndex += 1
      return rendered
    })
    .filter(Boolean)
    .join("\n")
}
