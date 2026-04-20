import { useRef, useEffect } from "react"

interface Props {
  name: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({ name, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
      <div className="card p-7 w-full max-w-[400px] shadow-soft-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "#FEF2F2" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h3 className="font-display" style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1a1a2e" }}>Delete Workflow</h3>
        </div>

        <p className="text-sm" style={{ color: "#3f3f46" }}>
          Are you sure you want to delete <strong style={{ color: "#1a1a2e" }}>{name}</strong>?
        </p>
        <p className="text-xs mt-1" style={{ color: "#a1a1aa" }}>This action cannot be undone.</p>

        <div className="flex justify-end gap-3 mt-6">
          <button ref={cancelRef} onClick={onCancel} className="btn-ghost px-5 py-2.5 text-sm">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ background: "#DC2626", border: "none" }}>Delete</button>
        </div>
      </div>
    </div>
  )
}
