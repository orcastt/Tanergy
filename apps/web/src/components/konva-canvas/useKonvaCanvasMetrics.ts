import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  appendFrameSample,
  createFrameSample,
  getCanvasDiagnosticsSnapshot,
  type CanvasDiagnosticsSnapshot,
  type CanvasDocument,
} from '@/features/canvas-engine'

type UseKonvaCanvasMetricsOptions = {
  document: CanvasDocument
  shellRef: RefObject<HTMLDivElement | null>
}

export function useKonvaCanvasMetrics({
  document,
  shellRef,
}: UseKonvaCanvasMetricsOptions) {
  const [size, setSize] = useState({ height: 720, width: 1280 })
  const [shellRect, setShellRect] = useState<DOMRect | null>(null)
  const [diagnostics, setDiagnostics] = useState<CanvasDiagnosticsSnapshot>(() => getCanvasDiagnosticsSnapshot(document))
  const frameSamplesRef = useRef<ReturnType<typeof appendFrameSample>>([])
  const lastFrameRef = useRef(0)

  useEffect(() => {
    const element = shellRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setShellRect(element.getBoundingClientRect())
      setSize({
        height: Math.max(480, entry.contentRect.height),
        width: Math.max(720, entry.contentRect.width),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [shellRef])

  useEffect(() => {
    let frame = 0
    const tick = (time: number) => {
      if (lastFrameRef.current > 0) {
        frameSamplesRef.current = appendFrameSample(frameSamplesRef.current, createFrameSample(lastFrameRef.current, time), 120)
      }
      lastFrameRef.current = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDiagnostics(getCanvasDiagnosticsSnapshot(document, frameSamplesRef.current))
    }, 500)
    return () => window.clearInterval(timer)
  }, [document])

  return { diagnostics, setShellRect, shellRect, size }
}
