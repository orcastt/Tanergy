import type { CanvasPoint, CanvasShape, CanvasShapeStyle, StrokePoint } from '@/features/canvas-engine'

const maxDraftStrokePoints = 96
const maxDraftTextLength = 80

export function createCollaborationDraftPreview(shape: CanvasShape): CanvasShape {
  if (shape.type === 'stroke') {
    const baseShape = withDraftBase(shape)
    return {
      ...baseShape,
      props: {
        points: sampleStrokePoints(shape.props.points, maxDraftStrokePoints).map(normalizeDraftStrokePoint),
      },
      type: 'stroke',
    }
  }

  if (shape.type === 'line' || shape.type === 'arrow') {
    const baseShape = withDraftBase(shape)
    return {
      ...baseShape,
      props: {
        ...shape.props,
        bends: shape.props.bends?.map(normalizeDraftPoint),
        control: shape.props.control ? normalizeDraftPoint(shape.props.control) : shape.props.control,
        end: normalizeDraftPoint(shape.props.end),
      },
      type: shape.type,
    }
  }

  if (shape.type === 'frame') {
    const baseShape = withDraftBase(shape)
    return {
      ...baseShape,
      props: {
        ...shape.props,
        height: roundDraftNumber(shape.props.height),
        title: normalizeDraftText(shape.props.title),
        width: roundDraftNumber(shape.props.width),
      },
      type: 'frame',
    }
  }

  if (shape.type === 'sticky') {
    const baseShape = withDraftBase(shape)
    return {
      ...baseShape,
      props: {
        ...shape.props,
        authorName: normalizeDraftText(shape.props.authorName),
        height: roundDraftNumber(shape.props.height),
        text: normalizeDraftText(shape.props.text) ?? '',
        width: roundDraftNumber(shape.props.width),
      },
      type: 'sticky',
    }
  }

  if (shape.type === 'text') {
    const baseShape = withDraftBase(shape)
    return {
      ...baseShape,
      props: {
        ...shape.props,
        height: roundDraftNumber(shape.props.height),
        text: normalizeDraftText(shape.props.text) ?? '',
        width: roundDraftNumber(shape.props.width),
      },
      type: 'text',
    }
  }

  if (shape.type === 'cloud') {
    return {
      ...withDraftBase(shape),
      props: normalizeTextContainerProps(shape),
      type: 'cloud',
    }
  }
  if (shape.type === 'diamond') {
    return {
      ...withDraftBase(shape),
      props: normalizeTextContainerProps(shape),
      type: 'diamond',
    }
  }
  if (shape.type === 'ellipse') {
    return {
      ...withDraftBase(shape),
      props: normalizeTextContainerProps(shape),
      type: 'ellipse',
    }
  }
  if (shape.type === 'rect') {
    return {
      ...withDraftBase(shape),
      props: normalizeTextContainerProps(shape),
      type: 'rect',
    }
  }
  if (shape.type === 'triangle') {
    return {
      ...withDraftBase(shape),
      props: normalizeTextContainerProps(shape),
      type: 'triangle',
    }
  }

  return withDraftBase(shape)
}

function withDraftBase<T extends CanvasShape>(shape: T): T {
  return {
    ...shape,
    style: normalizeDraftStyle(shape.style),
    x: roundDraftNumber(shape.x),
    y: roundDraftNumber(shape.y),
  }
}

function normalizeTextContainerProps(
  shape: Extract<CanvasShape, { type: 'cloud' | 'diamond' | 'ellipse' | 'rect' | 'triangle' }>,
) {
  return {
    ...shape.props,
    height: roundDraftNumber(shape.props.height),
    text: normalizeDraftText(shape.props.text),
    width: roundDraftNumber(shape.props.width),
  }
}

function sampleStrokePoints(points: StrokePoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points
  const sampled: StrokePoint[] = []
  const lastIndex = points.length - 1
  const step = lastIndex / (maxPoints - 1)
  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * step)])
  }
  return sampled
}

function normalizeDraftPoint(point: CanvasPoint): CanvasPoint {
  return {
    x: roundDraftNumber(point.x),
    y: roundDraftNumber(point.y),
  }
}

function normalizeDraftStrokePoint(point: StrokePoint): StrokePoint {
  return {
    pressure: typeof point.pressure === 'number' && Number.isFinite(point.pressure)
      ? roundDraftNumber(point.pressure, 100)
      : undefined,
    x: roundDraftNumber(point.x),
    y: roundDraftNumber(point.y),
  }
}

function normalizeDraftStyle(style?: CanvasShapeStyle): CanvasShapeStyle | undefined {
  if (!style) return undefined
  return {
    ...style,
    fontSize: normalizeOptionalNumber(style.fontSize),
    opacity: normalizeOptionalNumber(style.opacity, 100),
    strokeWidth: normalizeOptionalNumber(style.strokeWidth, 100),
  }
}

function normalizeOptionalNumber(value: number | undefined, multiplier = 10) {
  return typeof value === 'number' && Number.isFinite(value)
    ? roundDraftNumber(value, multiplier)
    : undefined
}

function normalizeDraftText(value: string | undefined) {
  return typeof value === 'string' ? value.slice(0, maxDraftTextLength) : undefined
}

function roundDraftNumber(value: number, multiplier = 10) {
  return Math.round(value * multiplier) / multiplier
}
