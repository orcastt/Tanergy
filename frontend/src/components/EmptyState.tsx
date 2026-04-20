export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      {/* Canvas illustration */}
      <div className="relative" style={{ width: 160, height: 120 }}>
        <div className="absolute rounded-md" style={{ left: 10, top: 20, width: 52, height: 40, background: "#f5f5f5", boxShadow: "rgba(34,42,53,0.08) 0px 0px 0px 1px" }} />
        <div className="absolute rounded-md" style={{ left: 90, top: 55, width: 52, height: 40, background: "#f5f5f5", boxShadow: "rgba(34,42,53,0.08) 0px 0px 0px 1px" }} />
        {/* Connection line */}
        <svg className="absolute" style={{ left: 0, top: 0, width: 160, height: 120 }}>
          <line x1="62" y1="40" x2="90" y2="75" stroke="#d4d4d4" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="62" cy="40" r="4" fill="#8B5CF6" />
          <circle cx="90" cy="75" r="4" fill="#3B82F6" />
        </svg>
      </div>

      <h2 className="font-display mt-8" style={{ fontSize: "1.5rem", fontWeight: 600, color: "#242424", letterSpacing: "0px" }}>
        No workflows yet
      </h2>

      <p className="mt-3 text-sm text-center" style={{ color: "#898989", maxWidth: "340px", lineHeight: 1.5 }}>
        Create your first workflow to start your AI creative journey
      </p>

      <button
        onClick={onCreate}
        className="mt-6 text-white font-semibold text-sm hover:opacity-80"
        style={{
          background: "#242424",
          borderRadius: "6px",
          padding: "10px 24px",
          boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px",
        }}
      >
        + Create your first workflow
      </button>
    </div>
  )
}
