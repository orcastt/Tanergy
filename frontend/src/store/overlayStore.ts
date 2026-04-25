import { create } from "zustand"

interface LightboxImage {
  filePath: string
  description: string
  prompt?: string
  position?: string
}

interface OverlayState {
  pickerOpen: boolean
  pickerScreenPos: { x: number; y: number } | null

  ctxMenu: { x: number; y: number; nodeId?: string } | null

  editorNodeId: string | null

  htmlEditorNodeId: string | null

  lightboxImage: LightboxImage | null

  openPicker: (screenPos?: { x: number; y: number } | null) => void
  closePicker: () => void

  openCtxMenu: (x: number, y: number, nodeId?: string) => void
  closeCtxMenu: () => void

  openEditor: (nodeId: string) => void
  closeEditor: () => void

  openHtmlEditor: (nodeId: string) => void
  closeHtmlEditor: () => void

  openLightbox: (img: LightboxImage) => void
  closeLightbox: () => void
}

export const useOverlayStore = create<OverlayState>((set) => ({
  pickerOpen: false,
  pickerScreenPos: null,
  ctxMenu: null,
  editorNodeId: null,
  htmlEditorNodeId: null,
  lightboxImage: null,

  openPicker: (screenPos) => set({ pickerOpen: true, pickerScreenPos: screenPos ?? null }),
  closePicker: () => set({ pickerOpen: false, pickerScreenPos: null }),

  openCtxMenu: (x, y, nodeId) => set({ ctxMenu: { x, y, nodeId } }),
  closeCtxMenu: () => set({ ctxMenu: null }),

  openEditor: (nodeId) => set({ editorNodeId: nodeId }),
  closeEditor: () => set({ editorNodeId: null }),

  openHtmlEditor: (nodeId) => set({ htmlEditorNodeId: nodeId }),
  closeHtmlEditor: () => set({ htmlEditorNodeId: null }),

  openLightbox: (img) => set({ lightboxImage: img }),
  closeLightbox: () => set({ lightboxImage: null }),
}))
