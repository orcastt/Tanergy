import { convertFileSrc } from "@tauri-apps/api/core"

const LOCAL_IMAGE_ATTRS = [
  "data-tanvas-file-path",
  "data-file-path",
  "data-local-file-path",
]

function isRemoteOrVirtualSrc(src: string) {
  return /^(https?:|data:|blob:|asset:|http:\/\/asset\.localhost)/i.test(src)
}

function looksLikeLocalFilePath(src: string) {
  return src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src) || src.startsWith("file:")
}

function stripFileProtocol(src: string) {
  return src.startsWith("file://") ? src.slice("file://".length) : src
}

export function resolveLocalImageSrc(filePath?: string | null, remoteUrl?: string | null) {
  const remote = remoteUrl?.trim()
  if (remote) return remote

  const rawPath = filePath?.trim()
  if (!rawPath) return ""
  if (isRemoteOrVirtualSrc(rawPath)) return rawPath

  try {
    return convertFileSrc(stripFileProtocol(rawPath))
  } catch {
    return rawPath
  }
}

export function hydrateLocalImageHtml(html: string) {
  if (!html.trim() || typeof DOMParser === "undefined") return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<main>${html}</main>`, "text/html")

  doc.querySelectorAll("img").forEach((img) => {
    const remoteUrl = img.getAttribute("data-tanvas-remote-url") ?? img.getAttribute("data-remote-url")
    const filePath = LOCAL_IMAGE_ATTRS
      .map((attr) => img.getAttribute(attr))
      .find((value): value is string => Boolean(value?.trim()))
      ?? (() => {
        const src = img.getAttribute("src") ?? ""
        return looksLikeLocalFilePath(src) && !isRemoteOrVirtualSrc(src) ? src : ""
      })()

    const previewSrc = resolveLocalImageSrc(filePath, remoteUrl)
    if (previewSrc) img.setAttribute("src", previewSrc)
    if (filePath) img.setAttribute("data-tanvas-file-path", stripFileProtocol(filePath))

    const description = img.getAttribute("data-tanvas-description")
    if (description && !img.getAttribute("alt")) {
      img.setAttribute("alt", description)
    }
  })

  return doc.body.firstElementChild?.innerHTML ?? html
}

export function hasLocalAssetImage(html: string) {
  if (!html.trim() || typeof DOMParser === "undefined") {
    return /data-tanvas-file-path=|data-file-path=|src=["'](?:file:|\/|[A-Za-z]:[\\/])/i.test(html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<main>${html}</main>`, "text/html")
  return Array.from(doc.querySelectorAll("img")).some((img) => {
    const remoteUrl = img.getAttribute("data-tanvas-remote-url") ?? img.getAttribute("data-remote-url")
    if (remoteUrl?.trim()) return false

    const filePath = LOCAL_IMAGE_ATTRS
      .map((attr) => img.getAttribute(attr))
      .find((value): value is string => Boolean(value?.trim()))
    const src = img.getAttribute("src") ?? ""
    return Boolean(filePath) || looksLikeLocalFilePath(src) || src.startsWith("asset:") || src.startsWith("http://asset.localhost")
  })
}
