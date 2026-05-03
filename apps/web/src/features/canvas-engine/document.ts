import { defaultCanvasCamera } from './geometry'
import type { CanvasCamera, CanvasDocument, CanvasShape } from './types'

export type CreateCanvasDocumentOptions = {
  camera?: Partial<CanvasCamera>
  id?: string
  name?: string
  now?: Date | string
  shapes?: CanvasShape[]
}

export function createEmptyCanvasDocument(options: CreateCanvasDocumentOptions = {}): CanvasDocument {
  const timestamp = toIsoTimestamp(options.now)
  return {
    camera: {
      ...defaultCanvasCamera,
      ...options.camera,
    },
    id: options.id ?? `canvas-document-${timestamp}`,
    metadata: {
      createdAt: timestamp,
      name: options.name,
      updatedAt: timestamp,
    },
    schemaVersion: 1,
    shapes: options.shapes ? [...options.shapes] : [],
  }
}

export function withCanvasCamera(document: CanvasDocument, camera: CanvasCamera): CanvasDocument {
  return {
    ...document,
    camera: { ...camera },
    metadata: touchMetadata(document.metadata),
  }
}

export function withCanvasShapes(document: CanvasDocument, shapes: CanvasShape[]): CanvasDocument {
  return {
    ...document,
    metadata: touchMetadata(document.metadata),
    shapes: [...shapes],
  }
}

export function appendCanvasShape(document: CanvasDocument, shape: CanvasShape): CanvasDocument {
  return withCanvasShapes(document, [...document.shapes, shape])
}

export function removeCanvasShape(document: CanvasDocument, shapeId: string): CanvasDocument {
  return withCanvasShapes(document, document.shapes.filter((shape) => shape.id !== shapeId))
}

function touchMetadata(metadata: CanvasDocument['metadata']): CanvasDocument['metadata'] {
  return {
    ...metadata,
    updatedAt: new Date().toISOString(),
  }
}

function toIsoTimestamp(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}
