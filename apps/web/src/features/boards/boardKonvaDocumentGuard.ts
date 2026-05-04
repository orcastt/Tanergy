import type { BoardDocumentGuardIssue } from './boardDocumentGuard'

const konvaIssueCode = 'konva-v2-invalid'
const allowedShapeTypes = new Set([
  'arrow',
  'cloud',
  'diamond',
  'ellipse',
  'frame',
  'image',
  'line',
  'node_card',
  'rect',
  'sticky',
  'stroke',
  'text',
  'triangle',
])
const boxShapeTypes = new Set(['cloud', 'diamond', 'ellipse', 'frame', 'image', 'node_card', 'rect', 'sticky', 'text', 'triangle'])
const nodeTypes = new Set(['analysis', 'image', 'image_gen', 'image_gen_4', 'prompt'])
const runtimeDataTypes = new Set(['image', 'text'])

export function auditKonvaBoardDocumentSchema(document: unknown): BoardDocumentGuardIssue[] {
  if (!looksLikeKonvaDocument(document)) return []
  const issues: BoardDocumentGuardIssue[] = []
  const root = requireRecord(document, 'document', issues)
  if (!root) return issues

  if (root.version !== 2) addIssue(issues, 'document.version', 'Konva board document must use version 2.')
  if (root.renderer !== 'konva') addIssue(issues, 'document.renderer', 'Konva board document renderer must be "konva".')
  requireString(root.serializedAt, 'document.serializedAt', issues)
  const assets = requireArray(root.assets, 'document.assets', issues)
  const canvasDocument = requireRecord(root.canvasDocument, 'document.canvasDocument', issues)

  assets?.forEach((asset, index) => validateAsset(asset, `document.assets.${index}`, issues))
  if (canvasDocument) validateCanvasDocument(canvasDocument, issues)
  return issues
}

function looksLikeKonvaDocument(value: unknown) {
  return isRecord(value) && (value.renderer === 'konva' || value.version === 2 || 'canvasDocument' in value)
}

function validateCanvasDocument(document: Record<string, unknown>, issues: BoardDocumentGuardIssue[]) {
  requireString(document.id, 'document.canvasDocument.id', issues)
  if (document.schemaVersion !== 1) addIssue(issues, 'document.canvasDocument.schemaVersion', 'Canvas document schemaVersion must be 1.')
  validateCamera(document.camera, 'document.canvasDocument.camera', issues)
  validateMetadata(document.metadata, 'document.canvasDocument.metadata', issues)
  const shapes = requireArray(document.shapes, 'document.canvasDocument.shapes', issues)
  const edges = requireArray(document.runtimeEdges, 'document.canvasDocument.runtimeEdges', issues)
  const shapeIds = new Set<string>()

  shapes?.forEach((shape, index) => {
    const id = validateShape(shape, `document.canvasDocument.shapes.${index}`, issues)
    if (!id) return
    if (shapeIds.has(id)) addIssue(issues, `document.canvasDocument.shapes.${index}.id`, `Duplicate shape id "${id}".`)
    shapeIds.add(id)
  })
  edges?.forEach((edge, index) => validateRuntimeEdge(edge, `document.canvasDocument.runtimeEdges.${index}`, shapeIds, issues))
}

function validateAsset(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  const asset = requireRecord(value, path, issues)
  if (!asset) return
  requireString(asset.id, `${path}.id`, issues)
  if (asset.type !== 'image') addIssue(issues, `${path}.type`, 'Konva board asset type must be "image".')
  validateOptionalNumber(asset.width, `${path}.width`, issues)
  validateOptionalNumber(asset.height, `${path}.height`, issues)
}

function validateCamera(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  const camera = requireRecord(value, path, issues)
  if (!camera) return
  requireFiniteNumber(camera.x, `${path}.x`, issues)
  requireFiniteNumber(camera.y, `${path}.y`, issues)
  requireFiniteNumber(camera.zoom, `${path}.zoom`, issues)
  if (typeof camera.zoom === 'number' && camera.zoom <= 0) addIssue(issues, `${path}.zoom`, 'Camera zoom must be greater than 0.')
}

function validateMetadata(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  const metadata = requireRecord(value, path, issues)
  if (!metadata) return
  requireString(metadata.createdAt, `${path}.createdAt`, issues)
  requireString(metadata.updatedAt, `${path}.updatedAt`, issues)
}

function validateShape(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  const shape = requireRecord(value, path, issues)
  if (!shape) return null
  const id = requireString(shape.id, `${path}.id`, issues)
  requireFiniteNumber(shape.x, `${path}.x`, issues)
  requireFiniteNumber(shape.y, `${path}.y`, issues)
  validateOptionalNumber(shape.rotation, `${path}.rotation`, issues)
  const type = requireString(shape.type, `${path}.type`, issues)
  if (type && !allowedShapeTypes.has(type)) addIssue(issues, `${path}.type`, `Unsupported Konva shape type "${type}".`)
  const props = requireRecord(shape.props, `${path}.props`, issues)
  if (!type || !props) return id

  if (boxShapeTypes.has(type)) validateSizeProps(props, `${path}.props`, issues)
  if (type === 'image') requireString(props.assetId, `${path}.props.assetId`, issues)
  if (type === 'node_card') validateNodeCardProps(props, `${path}.props`, issues)
  if (type === 'line' || type === 'arrow') validateLineProps(props, `${path}.props`, issues)
  if (type === 'stroke') validateStrokeProps(props, `${path}.props`, issues)
  return id
}

function validateNodeCardProps(props: Record<string, unknown>, path: string, issues: BoardDocumentGuardIssue[]) {
  requireString(props.nodeId, `${path}.nodeId`, issues)
  const nodeType = requireString(props.nodeType, `${path}.nodeType`, issues)
  if (nodeType && !nodeTypes.has(nodeType)) addIssue(issues, `${path}.nodeType`, `Unsupported node type "${nodeType}".`)
  requireRecord(props.data, `${path}.data`, issues)
  requireRecord(props.runtimeSummary, `${path}.runtimeSummary`, issues)
  requireFiniteNumber(props.version, `${path}.version`, issues)
}

function validateLineProps(props: Record<string, unknown>, path: string, issues: BoardDocumentGuardIssue[]) {
  validatePoint(props.end, `${path}.end`, issues)
  if (props.control !== undefined && props.control !== null) validatePoint(props.control, `${path}.control`, issues)
  if (props.bends !== undefined) {
    const bends = requireArray(props.bends, `${path}.bends`, issues)
    bends?.forEach((point, index) => validatePoint(point, `${path}.bends.${index}`, issues))
  }
}

function validateStrokeProps(props: Record<string, unknown>, path: string, issues: BoardDocumentGuardIssue[]) {
  const points = requireArray(props.points, `${path}.points`, issues)
  points?.forEach((point, index) => validatePoint(point, `${path}.points.${index}`, issues))
}

function validateRuntimeEdge(value: unknown, path: string, shapeIds: Set<string>, issues: BoardDocumentGuardIssue[]) {
  const edge = requireRecord(value, path, issues)
  if (!edge) return
  requireString(edge.id, `${path}.id`, issues)
  const sourceShapeId = requireString(edge.sourceShapeId, `${path}.sourceShapeId`, issues)
  const targetShapeId = requireString(edge.targetShapeId, `${path}.targetShapeId`, issues)
  requireString(edge.sourcePortId, `${path}.sourcePortId`, issues)
  requireString(edge.targetPortId, `${path}.targetPortId`, issues)
  const dataType = requireString(edge.dataType, `${path}.dataType`, issues)
  if (dataType && !runtimeDataTypes.has(dataType)) addIssue(issues, `${path}.dataType`, `Unsupported runtime edge data type "${dataType}".`)
  if (sourceShapeId && !shapeIds.has(sourceShapeId)) addIssue(issues, `${path}.sourceShapeId`, `Runtime edge source shape "${sourceShapeId}" is missing.`)
  if (targetShapeId && !shapeIds.has(targetShapeId)) addIssue(issues, `${path}.targetShapeId`, `Runtime edge target shape "${targetShapeId}" is missing.`)
}

function validateSizeProps(props: Record<string, unknown>, path: string, issues: BoardDocumentGuardIssue[]) {
  requireFiniteNumber(props.width, `${path}.width`, issues)
  requireFiniteNumber(props.height, `${path}.height`, issues)
  if (typeof props.width === 'number' && props.width <= 0) addIssue(issues, `${path}.width`, 'Shape width must be greater than 0.')
  if (typeof props.height === 'number' && props.height <= 0) addIssue(issues, `${path}.height`, 'Shape height must be greater than 0.')
}

function validatePoint(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  const point = requireRecord(value, path, issues)
  if (!point) return
  requireFiniteNumber(point.x, `${path}.x`, issues)
  requireFiniteNumber(point.y, `${path}.y`, issues)
}

function requireRecord(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  if (isRecord(value)) return value
  addIssue(issues, path, `${path} must be an object.`)
  return null
}

function requireArray(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  if (Array.isArray(value)) return value
  addIssue(issues, path, `${path} must be an array.`)
  return null
}

function requireString(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  if (typeof value === 'string' && value.trim()) return value
  addIssue(issues, path, `${path} must be a non-empty string.`)
  return null
}

function requireFiniteNumber(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  if (typeof value === 'number' && Number.isFinite(value)) return
  addIssue(issues, path, `${path} must be a finite number.`)
}

function validateOptionalNumber(value: unknown, path: string, issues: BoardDocumentGuardIssue[]) {
  if (value === undefined || value === null) return
  requireFiniteNumber(value, path, issues)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function addIssue(issues: BoardDocumentGuardIssue[], path: string, message: string) {
  issues.push({ blocking: true, code: konvaIssueCode, message, path })
}
