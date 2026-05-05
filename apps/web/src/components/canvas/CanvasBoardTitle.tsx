'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

type CanvasBoardTitleProps = {
  onRename?: (title: string) => Promise<string | void> | string | void
  title: string
}

export function CanvasBoardTitle({ onRename, title }: CanvasBoardTitleProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [draft, setDraft] = useState(title)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isCommitting = useRef(false)

  const commit = useCallback(async () => {
    if (isCommitting.current) return
    const nextTitle = draft.trim()
    if (!onRename || !nextTitle || nextTitle === title) {
      setDraft(title)
      setEditing(false)
      return
    }
    isCommitting.current = true
    setIsSaving(true)
    setError(null)
    try {
      const renamedTitle = await onRename(nextTitle)
      setDraft((renamedTitle || nextTitle).trim())
      setEditing(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Board rename failed.')
    } finally {
      isCommitting.current = false
      setIsSaving(false)
    }
  }, [draft, onRename, title])

  useEffect(() => {
    if (!editing) return
    const commitOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && formRef.current?.contains(target)) return
      void commit()
    }
    document.addEventListener('pointerdown', commitOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', commitOnOutsidePointer, true)
  }, [commit, editing])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void commit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    setDraft(title)
    setError(null)
    setEditing(false)
  }

  if (!onRename || !editing) {
    return (
      <button
        className="canvas-board-title-button"
        onDoubleClick={() => {
          if (!onRename) return
          setDraft(title)
          setEditing(true)
        }}
        title={onRename ? 'Double-click to rename' : undefined}
        type="button"
      >
        {title}
      </button>
    )
  }

  return (
    <form className="canvas-board-title-form" onSubmit={submit} ref={formRef}>
      <input
        aria-label="Board title"
        autoFocus
        disabled={isSaving}
        maxLength={80}
        onBlur={() => void commit()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        value={draft}
      />
      {error ? <small>{error}</small> : null}
    </form>
  )
}
