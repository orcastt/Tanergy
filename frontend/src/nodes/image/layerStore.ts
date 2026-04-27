import { create } from "zustand"
import i18n from "../../i18n"
import { getLayerCounter, makeLayer, resetLayerCounter, snapToGrid, type Layer, type Stroke, type Tool } from "./layerTypes"

export { GRID_SIZE, snapToGrid, type Layer, type Stroke, type Tool } from "./layerTypes"

interface LayerState {
  layers: Layer[]
  activeLayerId: string | null
  // Tool
  tool: Tool
  color: string
  brushWidth: number
  eraser: boolean
  currentStroke: Stroke | null
  // Dragging/resizing state
  dragState: { type: "move" | "resize"; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null
  // Grid
  showGrid: boolean
  snapEnabled: boolean

  // Tool
  setTool: (t: Tool) => void

  // Layer CRUD
  addLayer: (partial?: Partial<Layer>) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  setActive: (id: string) => void
  toggleVisible: (id: string) => void
  toggleLocked: (id: string) => void
  setOpacity: (id: string, opacity: number) => void
  moveLayer: (id: string, direction: "up" | "down") => void
  moveTo: (id: string, toIndex: number) => void
  updateLayerImage: (id: string, updates: { imgX?: number; imgY?: number; imgW?: number; imgH?: number; naturalW?: number; naturalH?: number }) => void

  // Drawing
  setColor: (color: string) => void
  setBrushWidth: (w: number) => void
  setEraser: (e: boolean) => void
  startStroke: (x: number, y: number) => void
  addPoint: (x: number, y: number) => void
  endStroke: () => void
  undoStroke: () => void
  clearLayerStrokes: () => void

  // Image
  addImageLayer: (src: string, name?: string, canvasW?: number, canvasH?: number) => void

  // Select drag/resize
  startDrag: (state: { type: "move" | "resize"; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number }) => void
  updateDrag: (currentX: number, currentY: number) => void
  endDrag: () => void

  // Grid
  toggleGrid: () => void
  toggleSnap: () => void

  // Rasterize
  rasterize: (dataUrl: string) => void

  // Reset
  reset: () => void

  // Serialize/restore for persistence per node
  getState: () => { layers: Layer[]; activeLayerId: string | null; showGrid: boolean; snapEnabled: boolean }
  restoreState: (data: { layers: Layer[]; activeLayerId: string | null; showGrid: boolean; snapEnabled: boolean }) => void
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [makeLayer({ name: i18n.t("image_editor.layers.defaultName", { count: 1 }) })],
  activeLayerId: null,
  tool: "select",
  color: "#ff0000",
  brushWidth: 3,
  eraser: false,
  currentStroke: null,
  dragState: null,
  showGrid: false,
  snapEnabled: true,

  setTool: (tool) => set({ tool }),

  addLayer: (partial) => {
    const layer = makeLayer(partial)
    set((s) => {
      const idx = s.layers.findIndex((l) => l.id === s.activeLayerId)
      const insertAt = idx >= 0 ? idx + 1 : s.layers.length
      const newLayers = [...s.layers]
      newLayers.splice(insertAt, 0, layer)
      return { layers: newLayers, activeLayerId: layer.id }
    })
  },

  removeLayer: (id) => {
    set((s) => {
      if (s.layers.length <= 1) return s
      const newLayers = s.layers.filter((l) => l.id !== id)
      const newActive = s.activeLayerId === id ? newLayers[0]?.id ?? null : s.activeLayerId
      return { layers: newLayers, activeLayerId: newActive }
    })
  },

  duplicateLayer: (id) => {
    set((s) => {
      const src = s.layers.find((l) => l.id === id)
      if (!src) return s
      const copy = makeLayer({
        name: i18n.t("image_editor.layers.copyName", { name: src.name, defaultValue: `${src.name} copy` }),
        opacity: src.opacity,
        imageSrc: src.imageSrc,
        strokes: [...src.strokes],
        imgX: src.imgX + 20, imgY: src.imgY + 20,
        imgW: src.imgW, imgH: src.imgH,
        naturalW: src.naturalW, naturalH: src.naturalH,
      })
      const idx = s.layers.indexOf(src)
      const newLayers = [...s.layers]
      newLayers.splice(idx + 1, 0, copy)
      return { layers: newLayers, activeLayerId: copy.id }
    })
  },

  setActive: (id) => set({ activeLayerId: id }),
  toggleVisible: (id) => set((s) => ({
    layers: s.layers.map((l) => l.id === id ? { ...l, visible: !l.visible } : l),
  })),
  toggleLocked: (id) => set((s) => ({
    layers: s.layers.map((l) => l.id === id ? { ...l, locked: !l.locked } : l),
  })),
  setOpacity: (id, opacity) => set((s) => ({
    layers: s.layers.map((l) => l.id === id ? { ...l, opacity } : l),
  })),
  moveLayer: (id, direction) => set((s) => {
    const idx = s.layers.findIndex((l) => l.id === id)
    if (idx < 0) return s
    const swapWith = direction === "up" ? idx + 1 : idx - 1
    if (swapWith < 0 || swapWith >= s.layers.length) return s
    const newLayers = [...s.layers]
    const tmp = newLayers[idx]
    newLayers[idx] = newLayers[swapWith]
    newLayers[swapWith] = tmp
    return { layers: newLayers }
  }),

  moveTo: (id, toIndex) => set((s) => {
    const fromIndex = s.layers.findIndex((l) => l.id === id)
    if (fromIndex < 0 || toIndex < 0 || toIndex >= s.layers.length || fromIndex === toIndex) return s
    const newLayers = [...s.layers]
    const [moved] = newLayers.splice(fromIndex, 1)
    newLayers.splice(toIndex, 0, moved)
    return { layers: newLayers }
  }),
  updateLayerImage: (id, updates) => set((s) => ({
    layers: s.layers.map((l) => l.id === id ? { ...l, ...updates } : l),
  })),

  // Drawing
  setColor: (color) => set({ color, eraser: false }),
  setBrushWidth: (w) => set({ brushWidth: w }),
  setEraser: (e) => set({ eraser: e }),

  startStroke: (x, y) => {
    const { color, brushWidth, eraser, activeLayerId, layers } = get()
    const active = layers.find((l) => l.id === activeLayerId)
    if (!active || active.locked) return
    set({ currentStroke: { points: [{ x, y }], color: eraser ? "#ffffff" : color, width: eraser ? brushWidth * 4 : brushWidth, eraser } })
  },
  addPoint: (x, y) => {
    const { currentStroke } = get()
    if (!currentStroke) return
    set({ currentStroke: { ...currentStroke, points: [...currentStroke.points, { x, y }] } })
  },
  endStroke: () => {
    const { currentStroke, activeLayerId } = get()
    if (!currentStroke || !activeLayerId) return
    set((s) => ({
      layers: s.layers.map((l) => l.id === activeLayerId ? { ...l, strokes: [...l.strokes, currentStroke] } : l),
      currentStroke: null,
    }))
  },
  undoStroke: () => {
    const { activeLayerId } = get()
    if (!activeLayerId) return
    set((s) => ({
      layers: s.layers.map((l) => l.id === activeLayerId ? { ...l, strokes: l.strokes.slice(0, -1) } : l),
    }))
  },
  clearLayerStrokes: () => {
    const { activeLayerId } = get()
    if (!activeLayerId) return
    set((s) => ({
      layers: s.layers.map((l) => l.id === activeLayerId ? { ...l, strokes: [] } : l),
    }))
  },

  // Image — with initial position centered
  addImageLayer: (src, name, canvasW, canvasH) => {
    const cw = canvasW ?? 800
    const ch = canvasH ?? 600
    const layer = makeLayer({
      imageSrc: src,
      name: name ?? i18n.t("image_editor.source.fallback", { index: getLayerCounter() }),
      imgX: snapToGrid(cw * 0.1), imgY: snapToGrid(ch * 0.1),
      imgW: snapToGrid(cw * 0.8), imgH: snapToGrid(ch * 0.8),
    })
    set((s) => ({ layers: [...s.layers, layer], activeLayerId: layer.id }))
  },

  // Select drag/resize
  startDrag: (state) => set({ dragState: state }),
  updateDrag: (currentX, currentY) => {
    const { dragState, activeLayerId, snapEnabled } = get()
    if (!dragState || !activeLayerId) return
    const dx = currentX - dragState.startX
    const dy = currentY - dragState.startY
    if (dragState.type === "move") {
      const newX = snapEnabled ? snapToGrid(dragState.origX + dx) : dragState.origX + dx
      const newY = snapEnabled ? snapToGrid(dragState.origY + dy) : dragState.origY + dy
      set((s) => ({
        layers: s.layers.map((l) => l.id === activeLayerId ? {
          ...l, imgX: newX, imgY: newY,
        } : l),
      }))
    } else {
      const scale = Math.max(dx / dragState.origW, dy / dragState.origH)
      let newW = Math.max(40, dragState.origW + dragState.origW * scale)
      let newH = Math.max(30, dragState.origH + dragState.origH * scale)
      if (snapEnabled) { newW = snapToGrid(newW); newH = snapToGrid(newH) }
      set((s) => ({
        layers: s.layers.map((l) => l.id === activeLayerId ? {
          ...l, imgW: newW, imgH: newH,
        } : l),
      }))
    }
  },
  endDrag: () => set({ dragState: null }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  // Rasterize
  rasterize: (dataUrl) => {
    const layer = makeLayer({ imageSrc: dataUrl, name: i18n.t("image_editor.rasterize"), strokes: [] })
    set((s) => ({ layers: [...s.layers, layer], activeLayerId: layer.id }))
  },

  reset: () => {
    resetLayerCounter()
    set({
      layers: [makeLayer({ name: i18n.t("image_editor.layers.defaultName", { count: 1 }) })],
      activeLayerId: null,
      currentStroke: null,
      tool: "select",
      color: "#ff0000",
      brushWidth: 3,
      eraser: false,
      dragState: null,
      showGrid: false,
      snapEnabled: true,
    })
  },

  getState: () => {
    const s = get()
    return { layers: s.layers, activeLayerId: s.activeLayerId, showGrid: s.showGrid, snapEnabled: s.snapEnabled }
  },

  restoreState: (data) => {
    resetLayerCounter(data.layers.length)
    set({
      layers: data.layers,
      activeLayerId: data.activeLayerId,
      showGrid: data.showGrid,
      snapEnabled: data.snapEnabled,
      currentStroke: null,
      dragState: null,
    })
  },
}))
