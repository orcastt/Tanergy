export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      {/* Illustration */}
      <div className="relative" style={{ width: 180, height: 130 }}>
        {/* Nodes */}
        <div className="absolute rounded-xl flex items-center justify-center" style={{ left: 8, top: 16, width: 60, height: 48, background: "#F5F3FF", border: "1.5px solid #DDD6FE" }}>
          <span className="text-lg" style={{ color: "#7C3AED" }}>A</span>
        </div>
        <div className="absolute rounded-xl flex items-center justify-center" style={{ left: 108, top: 60, width: 60, height: 48, background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}>
          <span className="text-lg" style={{ color: "#2563EB" }}>B</span>
        </div>
        {/* Connection */}
        <svg className="absolute inset-0" width="180" height="130">
          <line x1="68" y1="40" x2="108" y2="84" stroke="#C4B5FD" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="68" cy="40" r="5" fill="#8B5CF6" />
          <circle cx="108" cy="84" r="5" fill="#3B82F6" />
        </svg>
        {/* Floating dots */}
        <div className="absolute rounded-full" style={{ left: 90, top: 20, width: 8, height: 8, background: "#FDE68A" }} />
        <div className="absolute rounded-full" style={{ left: 55, top: 90, width: 6, height: 6, background: "#A7F3D0" }} />
      </div>

      <h2 className="font-display mt-8" style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1a1a2e" }}>
        No workflows yet
      </h2>
      <p className="mt-3 text-sm text-center" style={{ color: "#71717a", maxWidth: "340px", lineHeight: 1.6 }}>
        Create your first workflow to start building AI-powered creative pipelines
      </p>
      <button onClick={onCreate} className="btn-primary mt-6 text-sm" style={{ padding: "12px 28px" }}>
        + Create your first workflow
      </button>
    </div>
  )
}
