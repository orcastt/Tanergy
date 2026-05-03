export type KonvaPatternTile = {
  image: HTMLCanvasElement
  scale: number
}

const patternTileCache = new Map<string, KonvaPatternTile>()

export function getPatternTile(stroke: string): KonvaPatternTile | undefined {
  if (typeof document === 'undefined') return undefined
  const pixelRatio = getPatternPixelRatio()
  const key = `${normalizeColor(stroke)}:${pixelRatio}`
  const cached = patternTileCache.get(key)
  if (cached) return cached

  const tileSize = 18
  const canvas = document.createElement('canvas')
  canvas.width = tileSize * pixelRatio
  canvas.height = tileSize * pixelRatio
  const context = canvas.getContext('2d')
  if (!context) return undefined

  context.scale(pixelRatio, pixelRatio)
  context.imageSmoothingEnabled = false
  context.fillStyle = colorWithOpacity(stroke, 0.08)
  context.fillRect(0, 0, tileSize, tileSize)
  context.strokeStyle = colorWithOpacity(stroke, 0.38)
  context.lineCap = 'butt'
  context.lineWidth = 0.7

  for (let offset = -tileSize; offset <= tileSize * 2; offset += 6) {
    context.beginPath()
    context.moveTo(offset - 1, tileSize + 1)
    context.lineTo(offset + tileSize + 1, -1)
    context.stroke()
  }

  const tile = { image: canvas, scale: 1 / pixelRatio }
  patternTileCache.set(key, tile)
  return tile
}

export function colorWithOpacity(color: string, opacity: number) {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
}

function getPatternPixelRatio() {
  if (typeof window === 'undefined') return 3
  return Math.max(2, Math.min(4, Math.ceil(window.devicePixelRatio || 2)))
}

function hexToRgb(color: string) {
  const normalized = normalizeColor(color)
  const match = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!match) return null
  return {
    b: Number.parseInt(match[3], 16),
    g: Number.parseInt(match[2], 16),
    r: Number.parseInt(match[1], 16),
  }
}

function normalizeColor(color: string) {
  if (/^#[a-f\d]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase()
  }
  return color.toLowerCase()
}
