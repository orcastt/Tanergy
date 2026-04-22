import { useNavigate } from "react-router-dom"
import { useLicenseStore } from "../store/licenseStore"
import { SkillsSection, PhilosophySection, CtaSection } from "./welcome/WelcomeSections"

export default function WelcomePage() {
  const navigate = useNavigate()
  const status = useLicenseStore((s) => s.status)
  const trialEndsAt = useLicenseStore((s) => s.trialEndsAt)

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3f3", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1.25rem 2rem", background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
      }}>
        <div style={{
          fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem",
          fontWeight: 700, letterSpacing: "-0.04em", color: "#242424", textTransform: "uppercase",
        }}>
          TANGENT
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#898989" }}>
            {status === "trial"
              ? `${trialEndsAt ?? ""} days trial`
              : status === "active" ? "Pro" : "Free"}
          </span>
          <button
            onClick={() => navigate("/settings")}
            style={{
              padding: "0.5rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500,
              background: "transparent", border: "none", color: "#747878", cursor: "pointer",
              borderRadius: "0.5rem",
            }}
          >
            Settings
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600,
              background: "#242424", color: "#fff", border: "none", cursor: "pointer",
              borderRadius: "0.5rem",
            }}
          >
            Enter Workspace
          </button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section style={{
          maxWidth: "1120px", margin: "0 auto", padding: "6rem 2rem 4rem",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        }}>
          <span style={{
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "#646464", marginBottom: "1.5rem",
          }}>
            Canvas-as-an-Engine
          </span>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 700, letterSpacing: "-0.04em", color: "#242424",
            lineHeight: 1, marginBottom: "2rem", maxWidth: "900px",
          }}>
            The Kinetic Engine for Creative Workflows.
          </h1>
          <p style={{
            fontSize: "1.125rem", color: "#747878", maxWidth: "540px",
            lineHeight: 1.7, marginBottom: "2.5rem",
          }}>
            From prompt to publication in one seamless canvas. Orchestrate advanced AI pipelines with architectural precision.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                padding: "0.875rem 2rem", background: "#242424", color: "#fff",
                border: "none", borderRadius: "0.5rem", fontSize: "0.875rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Start Creating
            </button>
            <button
              onClick={() => {
                document.getElementById("skills-section")?.scrollIntoView({ behavior: "smooth" })
              }}
              style={{
                padding: "0.875rem 2rem", background: "#fff", color: "#242424",
                border: "none", borderRadius: "0.5rem", fontSize: "0.875rem",
                fontWeight: 600, cursor: "pointer",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
              }}
            >
              Explore Skills
            </button>
          </div>

          {/* Node Mockup */}
          <div style={{
            marginTop: "4rem", width: "100%", maxWidth: "900px", background: "#fff",
            borderRadius: "0.75rem", padding: "2rem",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
            display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.06,
              backgroundImage: "radial-gradient(#242424 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }} />
            {[
              { label: "Input Node", title: "Prompt Orchestrator", color: "#6349EA" },
              { label: "Logic Node", title: "Sentiment Analysis", color: "#3B82F6" },
              { label: "Output Node", title: "Image Generation", color: "#22C55E" },
            ].map((node, i) => (
              <div key={i} style={{
                minWidth: "220px", flex: "1 1 220px", background: "#fff", padding: "1.25rem",
                borderRadius: "0.75rem", borderLeft: `4px solid ${node.color}`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
                position: "relative", zIndex: 1,
                transform: i === 0 ? "rotate(-1deg)" : i === 2 ? "rotate(1deg)" : "none",
              }}>
                <div style={{
                  fontSize: "0.5625rem", textTransform: "uppercase", fontWeight: 700,
                  color: "#898989", letterSpacing: "0.15em", marginBottom: "0.5rem",
                }}>
                  {node.label}
                </div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1b1c1c", marginBottom: "0.75rem" }}>
                  {node.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <div style={{ height: "4px", background: "#f5f3f3", borderRadius: "2px", width: "100%" }} />
                  <div style={{ height: "4px", background: "#f5f3f3", borderRadius: "2px", width: "66%" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <SkillsSection navigate={navigate} />
        <PhilosophySection navigate={navigate} />
        <CtaSection navigate={navigate} />
      </main>
    </div>
  )
}
