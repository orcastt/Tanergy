import { useEffect, type RefObject } from 'react'

export function useKonvaBrowserSelectionGuard(shellRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const handleSelectionChange = () => {
      const shell = shellRef.current
      const selection = window.getSelection()
      if (!shell || !selection || selection.isCollapsed || isEditableElement(window.document.activeElement)) return
      if (nodeIsInside(selection.anchorNode, shell) || nodeIsInside(selection.focusNode, shell)) selection.removeAllRanges()
    }
    window.document.addEventListener('selectionchange', handleSelectionChange)
    return () => window.document.removeEventListener('selectionchange', handleSelectionChange)
  }, [shellRef])
}

function isEditableElement(element: Element | null) {
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'))
}

function nodeIsInside(node: Node | null, element: HTMLElement) {
  return Boolean(node && (node === element || element.contains(node)))
}
