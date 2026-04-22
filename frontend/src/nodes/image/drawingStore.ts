import { create } from "zustand"

export interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
  eraser: boolean
}

interface DrawingState {
  color: string
  width: number
  eraser: boolean
  strokes: Stroke[]
  currentStroke: Stroke | null
  setColor: (color: string) => void
  setWidth: (width: number) => void
  setEraser: (eraser: boolean) => void
  startStroke: (x: number, y: number) => void
  addPoint: (x: number, y: number) => void
  endStroke: () => void
  undo: () => void
  clear: () => void
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  color: "#ff0000",
  width: 3,
  eraser: false,
  strokes: [],
  currentStroke: null,

  setColor: (color) => set({ color, eraser: false }),
  setWidth: (width) => set({ width }),
  setEraser: (eraser) => set({ eraser }),

  startStroke: (x, y) => {
    const { color, width, eraser } = get()
    set({ currentStroke: { points: [{ x, y }], color: eraser ? "#ffffff" : color, width: eraser ? width * 4 : width, eraser } })
  },
  addPoint: (x, y) => {
    const { currentStroke } = get()
    if (!currentStroke) return
    set({ currentStroke: { ...currentStroke, points: [...currentStroke.points, { x, y }] } })
  },
  endStroke: () => {
    const { currentStroke, strokes } = get()
    if (!currentStroke) return
    set({ strokes: [...strokes, currentStroke], currentStroke: null })
  },
  undo: () => set((s) => ({ strokes: s.strokes.slice(0, -1) })),
  clear: () => set({ strokes: [], currentStroke: null }),
}))
