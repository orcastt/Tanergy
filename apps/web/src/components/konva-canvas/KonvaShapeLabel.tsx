import { Text } from 'react-konva'

type KonvaShapeLabelProps = {
  fill: string
  fontSize?: number
  height: number
  opacity: number
  text?: string
  textAlign?: 'center' | 'left' | 'right'
  width: number
}

export function KonvaShapeLabel({ fill, fontSize = 18, height, opacity, text, textAlign = 'center', width }: KonvaShapeLabelProps) {
  if (!text?.trim()) return null
  return (
    <Text
      align={textAlign}
      fill={fill}
      fontFamily="Inter, system-ui, sans-serif"
      fontSize={fontSize}
      height={height}
      listening={false}
      opacity={opacity}
      padding={10}
      text={text}
      verticalAlign="middle"
      width={width}
    />
  )
}
