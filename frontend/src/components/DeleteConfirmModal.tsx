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
      <div className="bg-white rounded-xl ring-shadow p-7 w-full max-w-[400px]">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "#ffdad6" }}>
            <span className="material-symbols-outlined" style={{ color: "#ba1a1a", fontSize: "20px" }}>delete</span>
          </div>
          <h3 className="font-headline" style={{ fontSize: "1.125rem", fontWeight: 600, color: "#0e0f0f" }}>Delete Workflow</h3>
        </div>

        <p className="text-sm" style={{ color: "#444748" }}>
          Are you sure you want to delete <strong style={{ color: "#0e0f0f" }}>{name}</strong>?
        </p>
        <p className="text-xs mt-1" style={{ color: "#747878" }}>This action cannot be undone.</p>

        <div className="flex justify-end gap-3 mt-6">
          <button ref={cancelRef} onClick={onCancel} className="btn-secondary px-5 py-2.5">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "#ba1a1a", border: "none", borderRadius: "0.25rem" }}>Delete</button>
        </div>
      </div>
    </div>
  )
}
