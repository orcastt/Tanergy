import { Group, Line, Rect, Text } from 'react-konva'
import { getCanvasThemePalette, useResolvedCanvasThemeMode } from '@/features/canvas-settings/canvasTheme'
import type { RuntimeGraphImageValue } from '@/features/node-runtime/runtimeGraphResolution'
import { getGeneratedOutputSource, NodeImagePreview } from './KonvaNodeImagePreview'
import type { ChatReferenceFile } from './konvaNodeChatBodyLayout'

type ConnectedContextStripProps = {
  files: ChatReferenceFile[]
  images: RuntimeGraphImageValue[]
  prompts: string[]
  width: number
  x: number
  y: number
  zoom: number
}

export function ConnectedContextStrip({
  files,
  images,
  prompts,
  width,
  x,
  y,
  zoom,
}: ConnectedContextStripProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const maxItems = Math.max(1, Math.min(4, Math.floor((width - 52) / 90)))
  const allItems: Array<
    | { index: number; kind: 'file'; value: ChatReferenceFile }
    | { index: number; kind: 'image'; value: RuntimeGraphImageValue }
    | { index: number; kind: 'prompt'; value: string }
  > = [
    ...prompts.map((value, index) => ({ index, kind: 'prompt' as const, value })),
    ...images.map((value, index) => ({ index, kind: 'image' as const, value })),
    ...files.map((value, index) => ({ index, kind: 'file' as const, value })),
  ]
  const items = allItems.slice(0, maxItems)
  const overflow = allItems.length - items.length
  let cursorX = x + 10

  return (
    <Group>
      <Rect
        cornerRadius={10}
        fill={palette.fieldBg}
        height={50}
        stroke={palette.fieldStroke}
        strokeWidth={1}
        width={width}
        x={x}
        y={y}
      />
      <Text
        fill={palette.softText}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={9}
        fontStyle="bold"
        text="Connected"
        width={74}
        x={x + 10}
        y={y + 7}
      />
      {items.map((item) => {
        const chip =
          item.kind === 'image' ? (
            <ConnectedImageChip
              image={item.value}
              index={item.index}
              key={`image-${item.index}`}
              width={76}
              x={cursorX}
              y={y + 20}
              zoom={zoom}
            />
          ) : item.kind === 'file' ? (
            <ConnectedFileChip
              file={item.value}
              index={item.index}
              key={`file-${item.index}`}
              width={82}
              x={cursorX}
              y={y + 20}
            />
          ) : (
            <ConnectedPromptChip
              index={item.index}
              key={`prompt-${item.index}`}
              text={item.value}
              width={92}
              x={cursorX}
              y={y + 20}
            />
          )
        cursorX += item.kind === 'prompt' ? 98 : item.kind === 'file' ? 88 : 82
        return chip
      })}
      {overflow > 0 ? (
        <Text
          align="center"
          fill={palette.softText}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={10}
          fontStyle="bold"
          height={24}
          text={`+${overflow}`}
          verticalAlign="middle"
          width={30}
          x={Math.min(cursorX, x + width - 40)}
          y={y + 20}
        />
      ) : null}
    </Group>
  )
}

type ReferenceStripProps = {
  fileCount: number
  imageCount: number
  promptCount: number
  width: number
  x: number
  y: number
}

export function ReferenceStrip({ fileCount, imageCount, promptCount, width, x, y }: ReferenceStripProps) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const promptText = promptCount > 0 ? ` · ${promptCount} prompts` : ''
  return (
    <Group>
      <Text
        fill={palette.softText}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={10}
        fontStyle="bold"
        text={`Refs ${imageCount} images · ${fileCount} PDFs${promptText}`}
        width={width}
        x={x}
        y={y}
      />
      <Line points={[x, y + 15, x + width, y + 15]} stroke={palette.fieldStroke} strokeWidth={1} />
    </Group>
  )
}

function ConnectedFileChip({
  file,
  index,
  width,
  x,
  y,
}: {
  file: ChatReferenceFile
  index: number
  width: number
  x: number
  y: number
}) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group>
      <Rect cornerRadius={8} fill={palette.secondaryBg} height={24} stroke="#ddd6fe" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#6d28d9" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`file ${index + 1}`} width={40} x={x + 7} y={y + 4} />
      <Text ellipsis fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={8} height={9} text={file.name} width={width - 14} wrap="none" x={x + 7} y={y + 14} />
    </Group>
  )
}

function ConnectedPromptChip({ index, text, width, x, y }: { index: number; text: string; width: number; x: number; y: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  return (
    <Group>
      <Rect cornerRadius={8} fill={palette.secondaryBg} height={24} stroke="#fde68a" strokeWidth={1} width={width} x={x} y={y} />
      <Text fill="#b45309" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`prompt ${index + 1}`} width={52} x={x + 7} y={y + 4} />
      <Text ellipsis fill={palette.mutedText} fontFamily="Inter, system-ui, sans-serif" fontSize={9} height={10} text={text} width={width - 14} wrap="none" x={x + 7} y={y + 13} />
    </Group>
  )
}

function ConnectedImageChip({ image, index, width, x, y, zoom }: { image: RuntimeGraphImageValue; index: number; width: number; x: number; y: number; zoom: number }) {
  const palette = getCanvasThemePalette(useResolvedCanvasThemeMode())
  const source = getGeneratedOutputSource(image, zoom)
  return (
    <Group>
      <Rect cornerRadius={8} fill={palette.secondaryBg} height={24} stroke="#bbf7d0" strokeWidth={1} width={width} x={x} y={y} />
      <Rect cornerRadius={5} fill={palette.imageSlotBg} height={18} width={24} x={x + 4} y={y + 3} />
      <NodeImagePreview bounds={{ height: 18, width: 24, x: x + 4, y: y + 3 }} crop={image.crop} source={source} />
      <Text fill="#047857" fontFamily="Inter, system-ui, sans-serif" fontSize={9} fontStyle="bold" text={`image ${index + 1}`} width={width - 34} x={x + 34} y={y + 5} />
      <Text ellipsis fill={palette.softText} fontFamily="Inter, system-ui, sans-serif" fontSize={8} height={9} text={image.title} width={width - 34} wrap="none" x={x + 34} y={y + 14} />
    </Group>
  )
}
