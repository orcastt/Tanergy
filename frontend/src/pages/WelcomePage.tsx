import { useNavigate } from "react-router-dom"
import { useLicenseStore } from "../store/licenseStore"

export default function WelcomePage() {
  const navigate = useNavigate()
  const licenseInfo = useLicenseStore((s) => ({
    status: s.status,
    trialEndsAt: s.trialEndsAt,
  }))

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
            {licenseInfo?.status === "trial"
              ? `${licenseInfo.trialEndsAt ?? ""} days trial`
              : licenseInfo?.status === "active" ? "Pro" : "Free"}
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

        {/* Skills Section */}
        <section
          id="skills-section"
          style={{ background: "#fff", padding: "5rem 2rem",
            boxShadow: "inset 0 1px 0 0 rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
            <div style={{ marginBottom: "3rem" }}>
              <h2 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.25rem",
                fontWeight: 700, letterSpacing: "-0.03em", color: "#242424", marginBottom: "0.75rem",
              }}>
                Industrial Skills
              </h2>
              <p style={{ color: "#747878", fontSize: "0.9375rem", maxWidth: "480px" }}>
                Pre-configured kinetic blueprints ready to be deployed into your production environment.
              </p>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}>
              {[
                {
                  tag: "公众号长文", title: "Long-form Narrative",
                  desc: "Multi-stage drafting agent for deep-dive editorial content with research, outline, writing and review.",
                  colors: ["#3B82F6", "#6349EA"],
                },
                {
                  tag: "电商海报", title: "E-commerce Visionary",
                  desc: "Generates high-conversion product visuals based on lighting logic and brand guidelines.",
                  colors: ["#6349EA", "#22C55E"],
                },
                {
                  tag: "小红书种草", title: "Social Spark Agent",
                  desc: "Analyzes trending keywords to generate high-engagement social copy and visuals.",
                  colors: ["#6349EA", "#3B82F6"],
                },
              ].map((skill) => (
                <div key={skill.tag} style={{
                  background: "#fff", padding: "1rem", borderRadius: "0.75rem",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px #242424, 0 4px 6px -1px rgba(0,0,0,0.1)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)"
                  }}
                >
                  <div style={{
                    position: "relative", overflow: "hidden", borderRadius: "0.5rem",
                    marginBottom: "0.75rem", background: "#f5f3f3", height: "140px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "#c4c7c7" }}>
                      article
                    </span>
                    <div style={{
                      position: "absolute", top: "0.75rem", left: "0.75rem",
                      padding: "0.25rem 0.625rem", background: "rgba(255,255,255,0.9)",
                      borderRadius: "9999px", fontSize: "0.5625rem", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.12em", color: "#1b1c1c",
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.05)",
                    }}>
                      {skill.tag}
                    </div>
                  </div>
                  <div style={{ padding: "0.5rem" }}>
                    <h3 style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#1b1c1c", marginBottom: "0.375rem" }}>
                      {skill.title}
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#747878", lineHeight: 1.5, marginBottom: "1rem" }}>
                      {skill.desc}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      {skill.colors.map((c, i) => (
                        <div key={i} style={{
                          width: "1.25rem", height: "1.25rem", borderRadius: "50%",
                          background: c, border: "2px solid #fff",
                          marginLeft: i > 0 ? "-0.375rem" : "0",
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section style={{ maxWidth: "1120px", margin: "0 auto", padding: "5rem 2rem" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center",
          }}>
            <div>
              <h2 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.75rem",
                fontWeight: 700, letterSpacing: "-0.04em", color: "#242424", marginBottom: "2rem",
              }}>
                The Kinetic Blueprint.
              </h2>
              <p style={{ color: "#747878", lineHeight: 1.8, marginBottom: "1rem", fontSize: "0.9375rem" }}>
                We are moving away from the "web-as-a-document" legacy and toward a "canvas-as-an-engine" philosophy.
                Current AI tools are static containers; TANGENT is a high-precision instrument for orchestration.
              </p>
              <p style={{ color: "#747878", lineHeight: 1.8, marginBottom: "1.5rem", fontSize: "0.9375rem" }}>
                By stripping away visual noise, we create a workspace of radical focus where your content is the only spectacle.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[
                  { icon: "hub", title: "Dynamic Pipelines", desc: "Stop rewriting prompts. Build reusable, interconnected logic nodes." },
                  { icon: "architecture", title: "Architectural Restraint", desc: "A UI designed to disappear. Focus on the data flow, not the chrome." },
                ].map((item) => (
                  <div key={item.icon} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#242424", marginTop: "0.125rem" }}>
                      {item.icon}
                    </span>
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1b1c1c", marginBottom: "0.125rem" }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: "0.8125rem", color: "#747878" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", inset: "-1rem", background: "rgba(36,36,36,0.03)",
                borderRadius: "1rem",
              }} />
              <div style={{
                position: "relative", background: "#fff", padding: "2rem", borderRadius: "0.75rem",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "300px",
              }}>
                <div style={{
                  width: "100%", aspectRatio: "1", border: "2px dashed #e3e2e2", borderRadius: "0.5rem",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "#c4c7c7" }}>hub</span>
                  <p style={{
                    fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.15em",
                    fontWeight: 700, color: "#c4c7c7", marginTop: "1rem",
                  }}>
                    Visualization Engine
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{
          background: "#242424", padding: "5rem 2rem", textAlign: "center",
        }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(1.75rem, 3.5vw, 3rem)",
              fontWeight: 700, letterSpacing: "-0.03em", color: "#fff", marginBottom: "1.5rem",
            }}>
              Ready to transition?
            </h2>
            <p style={{ color: "#898989", fontSize: "1rem", marginBottom: "2.5rem" }}>
              Your API key. Your workflow. Your creative engine.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                padding: "1rem 2.5rem", background: "#fff", color: "#242424",
                border: "none", borderRadius: "0.5rem", fontSize: "0.9375rem",
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Enter Workspace
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
