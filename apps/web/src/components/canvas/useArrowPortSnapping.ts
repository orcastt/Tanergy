'use client'

import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import { snapArrowBindings, updateActiveArrowPortSnap } from './arrowSnapLogic'

export { getArrowTerminalPagePoint } from './arrowAnchorUtils'
export { getArrowPortOverlayState } from './arrowPortOverlayState'

export function useArrowPortSnapping(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return

    let frame: number | null = null
    const scheduleSnap = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        editor.run(() => {
          updateActiveArrowPortSnap(editor)
          snapArrowBindings(editor)
        })
      })
    }

    scheduleSnap()
    const unsubscribe = editor.store.listen(scheduleSnap, { scope: 'document', source: 'user' })

    return () => {
      unsubscribe()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [editor])
}
