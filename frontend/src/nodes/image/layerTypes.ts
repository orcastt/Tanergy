export interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
  eraser: boolean
}

export type Tool = "select" | "draw"

export const GRID_SIZE = 20

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  imageSrc: string | null
  strokes: Stroke[]
  imgX: number
  imgY: number
  imgW: number
  imgH: number
  naturalW: number
  naturalH: number
}

let layerCounter = 0

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function makeLayer(partial?: Partial<Layer>): Layer {
  layerCounter++
  return {
    id: `layer_${Date.now()}_${layerCounter}`,
    name: i18n.t("image_editor.layers.defaultName", { count: layerCounter, defaultValue: `Layer ${layerCounter}` }),
    visible: true,
    locked: false,
    opacity: 1,
    imageSrc: null,
    strokes: [],
    imgX: 50, imgY: 50, imgW: 200, imgH: 150,
    naturalW: 0, naturalH: 0,
    ...partial,
  }
}

export function resetLayerCounter(value = 0) {
  layerCounter = value
}

export function getLayerCounter() {
  return layerCounter
}
import i18n from "../../i18n"
