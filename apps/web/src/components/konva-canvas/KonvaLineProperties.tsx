import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { CanvasDocument, CanvasShape } from '@/features/canvas-engine'
import {
  applyKonvaLineHead,
  applyKonvaLineRoute,
  getKonvaLineHeadSnapshot,
  getKonvaLineRouteSnapshot,
  isKonvaLineShape,
  konvaLineHeads,
  konvaLineRoutes,
  type KonvaLineHead,
  type KonvaLineHeadPosition,
  type KonvaLineRoute,
} from './konvaLineRouteUtils'

type KonvaLinePropertiesProps = {
  document: CanvasDocument
  selectedIds: string[]
  selectedShapes: CanvasShape[]
  onDocumentChange: Dispatch<SetStateAction<CanvasDocument>>
  onHistoryCheckpoint: (document: CanvasDocument) => void
}

export function KonvaLineProperties({
  document,
  onDocumentChange,
  onHistoryCheckpoint,
  selectedIds,
  selectedShapes,
}: KonvaLinePropertiesProps) {
  if (!selectedShapes.some(isKonvaLineShape)) return null
  const routeSnapshot = getKonvaLineRouteSnapshot(selectedShapes)
  const startHead = getKonvaLineHeadSnapshot(selectedShapes, 'start')
  const endHead = getKonvaLineHeadSnapshot(selectedShapes, 'end')

  const applyRoute = (route: KonvaLineRoute) => {
    onHistoryCheckpoint(document)
    onDocumentChange((current) => applyKonvaLineRoute(current, selectedIds, route))
  }

  const applyHead = (position: KonvaLineHeadPosition, head: KonvaLineHead) => {
    onHistoryCheckpoint(document)
    onDocumentChange((current) => applyKonvaLineHead(current, selectedIds, position, head))
  }

  return (
    <>
      <PropertyBlock label="Route">
        <SegmentedButtons>
          {konvaLineRoutes.map((item) => (
            <IconButton active={routeSnapshot === item.value} icon={`style-icon ${item.icon}`} key={item.value} label={item.label} onClick={() => applyRoute(item.value)} />
          ))}
        </SegmentedButtons>
      </PropertyBlock>
      <LineHeadBlock label="Start Head" onChange={(head) => applyHead('start', head)} position="start" snapshot={startHead} />
      <LineHeadBlock label="End Head" onChange={(head) => applyHead('end', head)} position="end" snapshot={endHead} />
    </>
  )
}

function LineHeadBlock({
  label,
  onChange,
  position,
  snapshot,
}: {
  label: string
  onChange: (head: KonvaLineHead) => void
  position: KonvaLineHeadPosition
  snapshot: KonvaLineHead | 'mixed' | null
}) {
  return (
    <PropertyBlock label={label}>
      <SegmentedButtons>
        {konvaLineHeads.map((item) => (
          <IconButton active={snapshot === item.value} icon={`style-icon style-icon--arrow-${position}-${item.icon}`} key={item.value} label={item.label} onClick={() => onChange(item.value)} />
        ))}
      </SegmentedButtons>
    </PropertyBlock>
  )
}

function PropertyBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="konva-canvas-properties__block">
      <p>{label}</p>
      {children}
    </section>
  )
}

function SegmentedButtons({ children }: { children: ReactNode }) {
  return <div className="konva-canvas-properties__segmented">{children}</div>
}

function IconButton({ active, icon, label, onClick }: { active?: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className={active ? 'is-active' : undefined} data-tooltip={label} onClick={onClick} type="button">
      <span aria-hidden className={icon} />
    </button>
  )
}
