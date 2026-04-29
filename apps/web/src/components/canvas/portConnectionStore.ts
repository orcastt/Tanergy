import { create } from 'zustand'

type ConnectionFrom = {
  pagePoint: { x: number; y: number }
  portDataType: 'image' | 'text'
  portDirection: 'in' | 'out'
  portId: string
  shapeId: string
}

type PortConnectionState = {
  cancel: () => void
  connectingFrom: ConnectionFrom | null
  mouseScreenPoint: { x: number; y: number } | null
  setMouseScreenPoint: (point: { x: number; y: number } | null) => void
  start: (from: ConnectionFrom) => void
}

export const usePortConnectionStore = create<PortConnectionState>((set) => ({
  cancel: () => set({ connectingFrom: null, mouseScreenPoint: null }),
  connectingFrom: null,
  mouseScreenPoint: null,
  setMouseScreenPoint: (point) => set({ mouseScreenPoint: point }),
  start: (from) => set({ connectingFrom: from, mouseScreenPoint: null }),
}))

export type { ConnectionFrom }
