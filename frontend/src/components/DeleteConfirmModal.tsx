import { useRef, useEffect } from "react"

interface Props {
  name: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({ name, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="bg-white p-6 w-full max-w-[400px]"
        style={{
          borderRadius: "16px",
          boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.10) 0px 0px 0px 1px, rgba(34,42,53,0.12) 0px 16px 48px",
        }}
      >
        <h3 style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: "1.25rem", fontWeight: 600, color: "#242424" }}>
          Confirm Delete
        </h3>

        <p className="mt-3 text-sm" style={{ color: "#242424" }}>
          Are you sure you want to delete <strong>「{name}」</strong>?
        </p>
        <p className="mt-1 text-sm" style={{ color: "#898989" }}>
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium"
            style={{
              background: "#ffffff",
              color: "#242424",
              borderRadius: "6px",
              boxShadow: "rgba(34,42,53,0.08) 0px 0px 0px 1px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white"
            style={{ background: "#EF4444", borderRadius: "6px" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
