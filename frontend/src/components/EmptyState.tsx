export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      {/* Illustration */}
      <div className="relative" style={{ width: 180, height: 100 }}>
        <div className="absolute rounded flex items-center justify-center ring-shadow" style={{ left: 10, top: 20, width: 56, height: 32, background: "#ffffff", fontSize: "10px", fontWeight: 600, color: "#0e0f0f" }}>
          Input
        </div>
        <div className="absolute rounded flex items-center justify-center ring-shadow" style={{ left: 100, top: 50, width: 56, height: 32, background: "#ffffff", fontSize: "10px", fontWeight: 600, color: "#0e0f0f" }}>
          Process
        </div>
        <svg className="absolute inset-0" width="180" height="100" fill="none">
          <path d="M66 36 C 80 36, 85 66, 100 66" stroke="#c4c7c7" strokeWidth="2" fill="none" />
          <circle cx="66" cy="36" r="4" fill="#6349EA" />
          <circle cx="100" cy="66" r="4" fill="#3B82F6" />
        </svg>
      </div>

      <h2 className="font-headline mt-8" style={{ fontSize: "1.5rem", fontWeight: 600, color: "#0e0f0f", letterSpacing: "-0.02em" }}>
        No workflows yet
      </h2>
      <p className="mt-3 text-sm text-center" style={{ color: "#444748", maxWidth: "340px", lineHeight: 1.6 }}>
        Create your first workflow to start building AI-powered creative pipelines
      </p>
      <button onClick={onCreate} className="btn-primary mt-6" style={{ padding: "10px 24px" }}>
        + Create your first workflow
      </button>
    </div>
  )
}
