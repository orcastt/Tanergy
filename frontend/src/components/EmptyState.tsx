export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="30" width="36" height="28" rx="4" fill="#f5f5f5" stroke="#e5e5e5" strokeWidth="1" />
        <rect x="64" y="50" width="36" height="28" rx="4" fill="#f5f5f5" stroke="#e5e5e5" strokeWidth="1" />
        <circle cx="42" cy="64" r="3" fill="#d4d4d4" />
        <circle cx="78" cy="64" r="3" fill="#d4d4d4" />
        <line x1="45" y1="64" x2="64" y2="64" stroke="#e5e5e5" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>

      <h2
        className="mt-6"
        style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: "1.5rem", fontWeight: 600, color: "#242424" }}
      >
        No workflows yet
      </h2>

      <p className="mt-2 text-sm" style={{ color: "#898989", maxWidth: "320px", textAlign: "center" }}>
        Create your first workflow to start your AI creative journey
      </p>

      <button
        onClick={onCreate}
        className="mt-6 text-white font-medium"
        style={{
          background: "#242424",
          borderRadius: "6px",
          padding: "10px 24px",
          boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px",
        }}
      >
        Create your first workflow
      </button>
    </div>
  )
}
