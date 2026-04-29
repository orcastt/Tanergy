'use client'

import { useEffect, useReducer } from 'react'
import type { Editor } from 'tldraw'

export function useEditorRevision(editor: Editor | null) {
  const [, bumpRevision] = useReducer((revision: number) => revision + 1, 0)

  useEffect(() => {
    if (!editor) return
    return editor.store.listen(() => bumpRevision(), { scope: 'all', source: 'all' })
  }, [editor])
}
