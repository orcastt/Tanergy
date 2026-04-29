'use client'

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  resizeBox,
  type Geometry2d,
  type RecordProps,
  type TLBaseShape,
  type TLResizeInfo,
} from 'tldraw'

export type AiCardTone = 'prompt' | 'generate' | 'edit' | 'link'

export type AiCardShape = TLBaseShape<
  'ai_card',
  {
    h: number
    w: number
    tone: AiCardTone
    title: string
    subtitle: string
    detail: string
  }
>

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    ai_card: AiCardShape['props']
  }
}

const toneLabels: Record<AiCardTone, string> = {
  prompt: 'Prompt',
  generate: 'Generate',
  edit: 'Edit',
  link: 'Link',
}

export class AiCardShapeUtil extends BaseBoxShapeUtil<AiCardShape> {
  static override type = 'ai_card' as const

  static override props: RecordProps<AiCardShape> = {
    h: T.number,
    w: T.number,
    tone: T.literalEnum('prompt', 'generate', 'edit', 'link'),
    title: T.string,
    subtitle: T.string,
    detail: T.string,
  }

  override canBind() {
    return true
  }

  override getDefaultProps(): AiCardShape['props'] {
    return {
      h: 156,
      w: 260,
      tone: 'prompt',
      title: 'Prompt Card',
      subtitle: 'Write a short image idea',
      detail: 'Connect this to Generate.',
    }
  }

  override getGeometry(shape: AiCardShape): Geometry2d {
    return new Rectangle2d({
      height: shape.props.h,
      isFilled: true,
      width: shape.props.w,
    })
  }

  override onResize(shape: AiCardShape, info: TLResizeInfo<AiCardShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: AiCardShape) {
    return (
      <HTMLContainer className={`ai-card-shape ai-card-shape--${shape.props.tone}`}>
        <div className="ai-card-shape__port ai-card-shape__port--input" />
        <div className="ai-card-shape__port ai-card-shape__port--output" />
        <div className="ai-card-shape__content">
          <div className="ai-card-shape__label">{toneLabels[shape.props.tone]}</div>
          <div className="ai-card-shape__title">{shape.props.title}</div>
          <div className="ai-card-shape__subtitle">{shape.props.subtitle}</div>
          <div className="ai-card-shape__detail">{shape.props.detail}</div>
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: AiCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />
  }
}
