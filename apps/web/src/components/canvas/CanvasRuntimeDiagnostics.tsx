'use client'

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'

// Temporary cross-platform test aid. Enabled only with
// NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1.

type CanvasRuntimeDiagnosticsProps = {
  editorReady: boolean
}

type RuntimeIssue = {
  detail?: string
  message: string
  source: string
}

type CanvasRuntimeErrorBoundaryProps = {
  children: ReactNode
}

type CanvasRuntimeErrorBoundaryState = {
  issue: RuntimeIssue | null
}

export class CanvasRuntimeErrorBoundary extends Component<
  CanvasRuntimeErrorBoundaryProps,
  CanvasRuntimeErrorBoundaryState
> {
  state: CanvasRuntimeErrorBoundaryState = { issue: null }

  static getDerivedStateFromError(error: unknown): CanvasRuntimeErrorBoundaryState {
    return { issue: normalizeIssue('React render error', error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[canvas-runtime] render error', error, info.componentStack)
  }

  render() {
    if (this.state.issue) {
      return <CanvasRuntimeIssuePanel issue={this.state.issue} />
    }
    return this.props.children
  }
}

export function CanvasRuntimeDiagnostics({ editorReady }: CanvasRuntimeDiagnosticsProps) {
  const [issue, setIssue] = useState<RuntimeIssue | null>(null)

  useEffect(() => {
    if (editorReady) return
    const timeout = window.setTimeout(() => {
      setIssue({
        detail: 'Tldraw onMount did not fire. Check browser console for blocked scripts or runtime errors.',
        message: 'Canvas editor did not initialize.',
        source: 'Editor mount timeout',
      })
    }, 3500)
    return () => window.clearTimeout(timeout)
  }, [editorReady])

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setIssue(normalizeIssue('Window error', event.error ?? event.message))
    }
    const handleRejection = (event: PromiseRejectionEvent) => {
      setIssue(normalizeIssue('Unhandled promise rejection', event.reason))
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (!issue) return null
  return <CanvasRuntimeIssuePanel issue={issue} />
}

function CanvasRuntimeIssuePanel({ issue }: { issue: RuntimeIssue }) {
  return (
    <div className="canvas-runtime-diagnostics" role="alert">
      <strong>{issue.message}</strong>
      <span>{issue.source}</span>
      {issue.detail ? <code>{issue.detail}</code> : null}
    </div>
  )
}

function normalizeIssue(source: string, error: unknown): RuntimeIssue {
  if (error instanceof Error) {
    return {
      detail: error.stack ?? error.message,
      message: error.message || 'Canvas runtime error',
      source,
    }
  }
  return {
    detail: typeof error === 'string' ? error : safeStringify(error),
    message: typeof error === 'string' ? error : 'Canvas runtime error',
    source,
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
