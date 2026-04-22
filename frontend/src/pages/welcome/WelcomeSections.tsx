import type { NavigateFunction } from "react-router-dom"

interface SectionProps {
  navigate: NavigateFunction
}

export function SkillsSection(_props: SectionProps) {
  return (
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
  )
}

export function PhilosophySection(_props: SectionProps) {
  return (
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
  )
}

export function CtaSection({ navigate }: SectionProps) {
  return (
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
  )
}
