import type { KonvaEventObject } from 'konva/lib/Node'

export function setKonvaStageCursor(event: KonvaEventObject<Event>, cursor: string) {
  const container = event.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}

export function clearKonvaStageCursor(event: KonvaEventObject<Event>) {
  const container = event.target.getStage()?.container()
  if (container) container.style.cursor = ''
}
