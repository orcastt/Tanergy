import {
  ArrowShapeArrowheadEndStyle,
  ArrowShapeArrowheadStartStyle,
  ArrowShapeKindStyle,
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  DefaultFontStyle,
  DefaultSizeStyle,
  LineShapeSplineStyle,
  type Editor,
  type StyleProp,
  type StylePropValue,
  type TLArrowShapeArrowheadStyle,
  type TLArrowShapeKind,
  type TLDefaultColorStyle,
  type TLDefaultDashStyle,
  type TLDefaultFillStyle,
  type TLDefaultFontStyle,
  type TLDefaultSizeStyle,
  type TLLineShapeSplineStyle,
} from 'tldraw'

type StyleOption<T extends string> = {
  label: string
  value: T
}

export const styleProps = {
  arrowheadEnd: ArrowShapeArrowheadEndStyle,
  arrowheadStart: ArrowShapeArrowheadStartStyle,
  arrowKind: ArrowShapeKindStyle,
  color: DefaultColorStyle,
  dash: DefaultDashStyle,
  fill: DefaultFillStyle,
  font: DefaultFontStyle,
  size: DefaultSizeStyle,
  spline: LineShapeSplineStyle,
}

export const strokeColors: Array<StyleOption<TLDefaultColorStyle> & { swatch: string }> = [
  { label: 'Black', swatch: '#1f1f1f', value: 'black' },
  { label: 'Red', swatch: '#ef4444', value: 'red' },
  { label: 'Green', swatch: '#22c55e', value: 'green' },
  { label: 'Blue', swatch: '#2563eb', value: 'blue' },
  { label: 'Orange', swatch: '#f59e0b', value: 'orange' },
  { label: 'Violet', swatch: '#8b5cf6', value: 'violet' },
  { label: 'Grey', swatch: '#6b7280', value: 'grey' },
]

export const fillStyles: Array<StyleOption<TLDefaultFillStyle>> = [
  { label: 'None', value: 'none' },
  { label: 'Semi', value: 'semi' },
  { label: 'Solid', value: 'solid' },
  { label: 'Pattern', value: 'pattern' },
]

export const sizeStyles: Array<StyleOption<TLDefaultSizeStyle>> = [
  { label: 'S', value: 's' },
  { label: 'M', value: 'm' },
  { label: 'L', value: 'l' },
  { label: 'XL', value: 'xl' },
]

export const dashStyles: Array<StyleOption<TLDefaultDashStyle>> = [
  { label: 'Draw', value: 'draw' },
  { label: 'Solid', value: 'solid' },
  { label: 'Dash', value: 'dashed' },
  { label: 'Dot', value: 'dotted' },
]

export const fontStyles: Array<StyleOption<TLDefaultFontStyle>> = [
  { label: 'Draw', value: 'draw' },
  { label: 'Sans', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Mono', value: 'mono' },
]

export const splineStyles: Array<StyleOption<TLLineShapeSplineStyle>> = [
  { label: 'Straight', value: 'line' },
  { label: 'Curve', value: 'cubic' },
]

export const arrowKindStyles: Array<StyleOption<TLArrowShapeKind>> = [
  { label: 'Arc', value: 'arc' },
  { label: 'Elbow', value: 'elbow' },
]

export const arrowheadEndStyles: Array<StyleOption<TLArrowShapeArrowheadStyle>> = [
  { label: 'Arrow', value: 'arrow' },
  { label: 'Triangle', value: 'triangle' },
  { label: 'None', value: 'none' },
]

export const arrowheadStartStyles: Array<StyleOption<TLArrowShapeArrowheadStyle>> = [
  { label: 'None', value: 'none' },
  { label: 'Arrow', value: 'arrow' },
]

export function getPanelStyleValue<S extends StyleProp<unknown>>(
  editor: Editor,
  style: S
): StylePropValue<S> | 'mixed' {
  const shared = editor.getSharedStyles().get(style)
  if (shared?.type === 'shared') return shared.value as StylePropValue<S>
  if (shared?.type === 'mixed') return 'mixed'
  return editor.getStyleForNextShape(style) as StylePropValue<S>
}

export function setPanelStyle<S extends StyleProp<unknown>>(
  editor: Editor | null,
  style: S,
  value: StylePropValue<S>
) {
  if (!editor) return
  editor.run(() => {
    editor.setStyleForSelectedShapes(style, value)
    editor.setStyleForNextShapes(style, value)
    editor.updateInstanceState({ isChangingStyle: true })
  })
}
