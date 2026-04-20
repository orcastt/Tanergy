import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

// ─── Scroll Reveal ─────────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el) } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ─── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    tag: "电商海报生成", title: "E-commerce Visionary",
    desc: "Generates high-conversion product backgrounds based on lighting logic.",
    colors: ["#6349EA", "#22C55E", "#c4c7c7"], extra: 3,
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuApgDUzl7-p4XMU19km8eB9WVUGqNlJfx07KswEzSEIpgYl5XGhvn5Yob2LWfAu6b326T3zoehuSrWRl4BPhMqrURZUupoNgH2yTZJyFCdMj5GJvS2YdZwv7CoZoG7apYQGK4YhW2TijutOTFh4OiaMbMZqSWZ9DISYVrcCvIhdcUtEs8SGMhkxsIwcPFhssM9BxW0DvERuzQuCTvi05-LLDu3_7nRu3bIq-l6z8gMvBuSMdKzLAnyBxcCGA3nWzHk4dV1evPPd7lq0",
  },
  {
    tag: "公众号长文", title: "Long-form Narrative",
    desc: "Multi-stage drafting agent for deep-dive editorial content and research papers.",
    colors: ["#3B82F6", "#c4c7c7"], extra: 1,
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5WaZRnWvDPbN9C7vYNUaD9lCC7PENmKFllQU18ex8GfpVbfchi4dQJT6i0mXwG30Ag2m9cJ4PfvXMKqGEaWDpOiKPlv0AJj3BGGH8W9QQQCuBVZXP0EE2DDDRDp4GH5dgtvfFNGDFmmmg9ONKSuMkk4Ev9_L-OgAZjRmWytKHNAymPMiXsjHCmS3IVZkvpmd1TfUDIssDbII5SzTne2ukzqB0RmuCowLFv-r8Lc9M6ftyVxG0AgKcfDpqQcOw_QYJhX9ZjGm0Veen",
  },
  {
    tag: "小红书种草笔记", title: "Social Spark Agent",
    desc: "Analyzes trending keywords to generate high-engagement social copy.",
    colors: ["#6349EA", "#3B82F6"], extra: 0,
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD-3tGYZxqcYveZ30fDmZtPhvymYXqK3gfz1vmdw_73_REeDajSIjYAW32X-0QaAEXQIJBp2h6HNMnYs2QKpKfWiqsM-t35ygTedi-3bT7d_Aheb-LH3hoKjlqI3y2sQcnVAfe8b8TT6zdABeXJxL9CgKoN4EGbrZb74fdgn7PLkps-tzD48KTHphcej1FBRarpOB4NVVZz6xiOpgde6SMNjTBE639d74tIb4pgY-UnW0klQChcYNZy-LWV1KJqQXbIfZdWEGmIVLCT",
  },
]

function TemplateCard({ t, delay }: { t: typeof TEMPLATES[0]; delay: number }) {
  const { ref, visible } = useReveal(0.08)
  return (
    <div ref={ref} className="break-inside-avoid group cursor-pointer" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(36px)",
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      <div className="bg-white rounded-xl lp-card p-4">
        <div className="relative overflow-hidden rounded-lg mb-4">
          <img alt={t.tag} className="w-full grayscale group-hover:grayscale-0 transition-all duration-500" src={t.img} />
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest lp-tag">
            {t.tag}
          </div>
        </div>
        <div className="p-2">
          <h3 className="font-bold mb-2 lp-title">{t.title}</h3>
          <p className="text-xs mb-6 lp-desc">{t.desc}</p>
          <div className="flex items-center gap-1">
            {t.colors.map((c, i) => (
              <div key={i} className="rounded-full ring-2 ring-white -ml-2 first:ml-0 lp-node" style={{ background: c === "#c4c7c7" ? "#c4c7c7" : c }} />
            ))}
            {t.extra > 0 && (
              <div className="rounded-full ring-2 ring-white -ml-2 flex items-center justify-center text-[8px] font-bold lp-node-count">
                +{t.extra}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero Node ─────────────────────────────────────────────────────────────

function HeroNode({ color, label, title, rotate, align, delay }: {
  color: string; label: string; title: string; rotate: number; align: string; delay: number
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div className="min-w-[280px] bg-white rounded-xl lp-card lp-node-card border-l-4 self-center" style={{
      borderLeftColor: color,
      alignSelf: align as any,
      transform: `rotate(${rotate}deg) translateY(${visible ? 0 : 20}px)`,
      transition: `transform 0.5s ease ${delay}ms, opacity 0.5s ease ${delay}ms`,
      opacity: visible ? 1 : 0,
    }}>
      <div className="text-[10px] uppercase font-bold text-[#898989] mb-2 tracking-widest">{label}</div>
      <div className="text-sm font-semibold mb-4 lp-title">{title}</div>
      <div className="h-2 w-full bg-[#efeded] rounded-full mb-2" />
      <div className="h-2 w-2/3 bg-[#efeded] rounded-full" />
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate()
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="lp-root">

      {/* ── Nav ── */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo" onClick={() => navigate("/")}>TANGENT</div>
          <nav className="lp-nav-links hidden md:flex">
            {["Templates", "Philosophy", "Pricing", "Community"].map(item => (
              <a key={item} href="#" className="lp-nav-link">{item}</a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/login")} className="lp-btn-ghost">Sign In</button>
            <button onClick={() => navigate("/signup")} className="lp-btn-primary">Get Started</button>
          </div>
        </div>
      </header>

      <main>

        {/* ── Hero ── */}
        <section className="lp-hero-section">
          <div className={`lp-hero-content ${heroVisible ? "lp-hero-visible" : ""}`}>
            <div className="lp-hero-badge">Introducing the Canvas-as-an-Engine</div>
            <h1 className="lp-hero-h1">The Kinetic Engine<br />for Creative Workflows.</h1>
            <p className="lp-hero-p">
              From prompt to publication in one seamless canvas. Orchestrate advanced AI pipelines with architectural precision and radical focus.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate("/signup")} className="lp-btn-primary-lg">Start Creating</button>
              <button onClick={() => navigate("/login")} className="lp-btn-secondary-lg">Explore Skills</button>
            </div>
          </div>

          {/* Canvas visual */}
          <div className={`lp-canvas-visual ${heroVisible ? "lp-canvas-visible" : ""}`}>
            <div className="lp-dot-grid" />
            <div className="flex gap-4 p-8 overflow-x-auto no-scrollbar w-full items-center">
              <HeroNode color="#6349EA" label="Input Node" title="Prompt Orchestrator" rotate={-2} align="self-start" delay={400} />
              <HeroNode color="#3B82F6" label="Logic Node" title="Sentiment Analysis" rotate={0} align="self-center" delay={520} />
              <HeroNode color="#22C55E" label="Output Node" title="Image Generation" rotate={2} align="self-end" delay={640} />
            </div>
          </div>
        </section>

        {/* ── Templates ── */}
        <section className="lp-templates">
          <div className="lp-templates-inner">
            <Reveal>
              <div className="lp-section-header">
                <div>
                  <h2 className="lp-section-h2">Industrial Skills</h2>
                  <p className="lp-section-p">Pre-configured kinetic blueprints ready to be deployed into your production environment.</p>
                </div>
                <div className="flex gap-2">
                  <button className="lp-icon-btn"><span className="material-symbols-outlined" style={{ fontSize: "20px" }}>grid_view</span></button>
                  <button className="lp-icon-btn-active"><span className="material-symbols-outlined" style={{ fontSize: "20px" }}>list</span></button>
                </div>
              </div>
            </Reveal>

            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
              {TEMPLATES.map((t, i) => (
                <TemplateCard key={i} t={t} delay={i * 110} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Philosophy ── */}
        <section className="lp-philosophy">
          <div className="lp-philosophy-grid">
            <Reveal>
              <div>
                <h2 className="lp-section-h2" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>The Kinetic Blueprint.</h2>
                <div className="lp-philosophy-text">
                  <p>We are moving away from the "web-as-a-document" legacy and toward a "canvas-as-an-engine" philosophy. Current AI tools are static containers; Tangent is a high-precision instrument for orchestration.</p>
                  <p>By stripping away visual noise—eliminating 1px borders and loud decorative colors—we create a workspace of radical focus where your content is the only spectacle.</p>
                </div>
                <ul className="lp-feature-list">
                  {[
                    { icon: "analytics", title: "Dynamic Pipelines", desc: "Stop rewriting prompts. Build reusable, interconnected logic nodes." },
                    { icon: "architecture", title: "Architectural Restraint", desc: "A UI designed to disappear. Focus on the data flow, not the chrome." },
                  ].map(item => (
                    <li key={item.title} className="lp-feature-item">
                      <span className="material-symbols-outlined lp-feature-icon">{item.icon}</span>
                      <div>
                        <h4 className="lp-feature-title">{item.title}</h4>
                        <p className="lp-feature-desc">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={180}>
              <div className="lp-viz-wrapper">
                <div className="lp-viz-glow" />
                <div className="lp-viz-card">
                  <div className="lp-viz-box">
                    <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#d4d4d8" }}>hub</span>
                    <p className="lp-viz-label">Visualization Engine</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta">
          <Reveal>
            <h2 className="lp-cta-h2">Ready to transition?</h2>
            <p className="lp-cta-p">Join 12,000+ creators building the future of automated creativity.</p>
            <button onClick={() => navigate("/signup")} className="lp-cta-btn">Get Invitation Access</button>
          </Reveal>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <div className="lp-logo" style={{ marginBottom: "0.75rem" }}>TANGENT</div>
              <p className="lp-footer-tagline">AI 创意工作流画布平台。拖拽连接 AI 模型，自动生成图片、视频、文章和演示文稿。</p>
            </div>
            {[
              { title: "Product", links: ["Changelog", "Status", "Templates"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service"] },
              { title: "Connect", links: ["Twitter", "GitHub"] },
            ].map(col => (
              <div key={col.title}>
                <div className="lp-footer-col-title">{col.title}</div>
                <ul className="lp-footer-links">
                  {col.links.map(l => <li key={l}><a href="#" className="lp-footer-link">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 TANGENT. All rights reserved.</span>
            <span>Made with AI for creators</span>
          </div>
        </div>
      </footer>

      <style>{`
        .lp-root { background: #f5f3f3; min-height: 100vh; overflow-x: hidden; }
        * { box-sizing: border-box; }
        .lp-logo { font-family: 'Space Grotesk', sans-serif; font-size: 1.125rem; font-weight: 700; letter-spacing: -0.04em; color: #0e0f0f; cursor: pointer; }
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); padding: 0 1.5rem; }
        .lp-nav-inner { max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; height: 64px; }
        .lp-nav-links { display: flex; gap: 2rem; align-items: center; }
        .lp-nav-link { font-size: 0.875rem; font-weight: 500; color: #5e5e5e; text-decoration: none; padding-bottom: 2px; border-bottom: 2px solid transparent; transition: all 150ms; white-space: nowrap; }
        .lp-nav-link:hover { color: #0e0f0f; border-bottom-color: #0e0f0f; }
        .lp-btn-ghost { font-size: 0.875rem; font-weight: 500; border: none; background: transparent; color: #5e5e5e; cursor: pointer; padding: 0.375rem 0; white-space: nowrap; }
        .lp-btn-primary { padding: 0.5rem 1.25rem; border-radius: 8px; border: none; font-size: 0.875rem; font-weight: 600; background: #242424; color: #fff; cursor: pointer; transform: scale(0.95); white-space: nowrap; }
        .lp-hero-section { max-width: 1280px; margin: 0 auto; padding: 7rem 1.5rem 5rem; display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; }
        .lp-hero-content { width: 100%; max-width: 800px; opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease 100ms, transform 0.7s ease 100ms; }
        .lp-hero-content.lp-hero-visible { opacity: 1; transform: translateY(0); }
        .lp-hero-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; background: #e3e2e2; font-size: 0.6875rem; font-weight: 700; color: #5e5e5e; margin-bottom: 1.5rem; letter-spacing: 0.1em; text-transform: uppercase; }
        .lp-hero-h1 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(2.5rem, 8vw, 5rem); font-weight: 700; line-height: 0.9; letter-spacing: -0.04em; color: #0e0f0f; max-width: 800px; margin: 0 auto 2rem; }
        .lp-hero-p { font-size: clamp(1rem, 2vw, 1.25rem); color: #444748; max-width: 560px; margin: 0 auto 3rem; line-height: 1.6; }
        .lp-btn-primary-lg { padding: 1rem 2rem; border-radius: 8px; border: none; font-size: 1rem; font-weight: 700; background: #242424; color: #fff; cursor: pointer; box-shadow: 0 0 0 2px #242424, 0 10px 15px -3px rgba(0,0,0,0.1); white-space: nowrap; }
        .lp-btn-secondary-lg { padding: 1rem 2rem; border-radius: 8px; border: none; font-size: 1rem; font-weight: 700; background: #fff; color: #0e0f0f; cursor: pointer; box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); white-space: nowrap; }
        .lp-canvas-visual { margin-top: 5rem; width: 100%; max-width: 900px; background: #fff; border-radius: 12px; box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.1), 0 24px 60px rgba(0,0,0,0.08); height: 400px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease 300ms, transform 0.8s ease 300ms; }
        .lp-canvas-visual.lp-canvas-visible { opacity: 1; transform: translateY(0); }
        .lp-dot-grid { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(36,36,36,0.07) 1px, transparent 1px); background-size: 20px 20px; }
        .lp-card { box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); transition: box-shadow 0.3s ease; }
        .lp-card:hover { box-shadow: 0 0 0 2px #242424, 0 10px 15px -3px rgba(0,0,0,0.1); }
        .lp-node { width: 24px; height: 24px; border: 2px solid white; flex-shrink: 0; }
        .lp-node-count { width: 24px; height: 24px; background: #efeded; color: #5e5e5e; border: 2px solid white; flex-shrink: 0; }
        .lp-title { font-family: 'Space Grotesk', sans-serif; font-size: 0.9375rem; font-weight: 600; color: #0e0f0f; }
        .lp-desc { color: #444748; }
        .lp-tag { background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); color: #5e5e5e; box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); }
        .lp-templates { background: #fff; padding: 6rem 0; box-shadow: inset 0 1px 0 0 rgba(0,0,0,0.05); }
        .lp-templates-inner { max-width: 1280px; margin: 0 auto; padding: 0 1.5rem; width: 100%; }
        .lp-section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; gap: 1.5rem; flex-wrap: wrap; width: 100%; }
        .lp-section-h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; letter-spacing: -0.03em; color: #0e0f0f; margin-bottom: 0.75rem; }
        .lp-section-p { color: #444748; max-width: 400px; }
        .lp-icon-btn { padding: 0.5rem; border-radius: 8px; background: #f5f3f3; border: none; box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); cursor: pointer; display: flex; align-items: center; flex-shrink: 0; }
        .lp-icon-btn-active { padding: 0.5rem; border-radius: 8px; background: #fff; border: none; box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); cursor: pointer; display: flex; align-items: center; flex-shrink: 0; }
        .lp-philosophy { max-width: 1280px; margin: 0 auto; padding: 6rem 1.5rem; width: 100%; }
        .lp-philosophy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; width: 100%; }
        @media (max-width: 768px) { .lp-philosophy-grid { grid-template-columns: 1fr; } }
        .lp-philosophy-text { display: flex; flex-direction: column; gap: 1rem; color: #444748; line-height: 1.8; margin-top: 1.5rem; }
        .lp-feature-list { list-style: none; display: flex; flex-direction: column; gap: 1.25rem; margin-top: 2rem; }
        .lp-feature-item { display: flex; align-items: flex-start; gap: 1rem; }
        .lp-feature-icon { font-size: 22px; color: #0e0f0f; margin-top: 2px; flex-shrink: 0; }
        .lp-feature-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: #0e0f0f; margin-bottom: 0.25rem; }
        .lp-feature-desc { font-size: 0.875rem; color: #444748; }
        .lp-viz-wrapper { position: relative; }
        .lp-viz-glow { position: absolute; inset: -16px; background: rgba(36,36,36,0.04); border-radius: 16px; }
        .lp-viz-card { position: relative; background: #fff; border-radius: 12px; box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05); overflow: hidden; }
        .lp-viz-box { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #e3e2e2; border-radius: 8px; margin: 2rem; }
        .lp-viz-label { font-size: 0.6875rem; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.75rem; }
        .lp-cta { background: #242424; padding: 6rem 1.5rem; text-align: center; width: 100%; }
        .lp-cta-inner { max-width: 1280px; margin: 0 auto; }
        .lp-cta-h2 { font-family: 'Space Grotesk', sans-serif; font-size: clamp(2rem, 5vw, 4rem); font-weight: 700; color: #fff; letter-spacing: -0.03em; margin-bottom: 1rem; }
        .lp-cta-p { color: #a1a1aa; font-size: 1.125rem; margin-bottom: 3rem; }
        .lp-cta-btn { padding: 1rem 2.5rem; border-radius: 8px; border: none; font-size: 1rem; font-weight: 700; background: #fff; color: #0e0f0f; cursor: pointer; }
        .lp-footer { background: #faf9f9; border-top: 1px solid #efeded; padding: 4rem 1.5rem 2rem; }
        .lp-footer-inner { max-width: 1280px; margin: 0 auto; }
        .lp-footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 2rem; padding-bottom: 3rem; border-bottom: 1px solid #efeded; }
        .lp-footer-brand { grid-column: span 2; }
        .lp-footer-tagline { font-size: 0.875rem; color: #747878; max-width: 220px; line-height: 1.6; }
        .lp-footer-col-title { font-size: 0.6875rem; font-weight: 700; color: #5e5e5e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }
        .lp-footer-links { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
        .lp-footer-link { font-size: 0.875rem; color: #747878; text-decoration: none; }
        .lp-footer-link:hover { color: #0e0f0f; }
        .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 1.5rem; margin-top: 1.5rem; font-size: 0.75rem; color: #a1a1aa; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (max-width: 640px) {
          .lp-hero-section { padding: 6rem 1rem 4rem; }
          .lp-section-header { flex-direction: column; align-items: flex-start; }
          .lp-footer-grid { grid-template-columns: 1fr 1fr; }
          .lp-footer-brand { grid-column: span 2; }
          .lp-footer-bottom { flex-direction: column; gap: 0.5rem; text-align: center; }
          .lp-nav-links { display: none; }
          .lp-nav-inner { flex-wrap: nowrap; gap: 0.5rem; }
        }
        @media (max-width: 480px) {
          .lp-cta { padding: 4rem 1rem; }
          .lp-philosophy { padding: 4rem 1rem; }
        }
      `}</style>
    </div>
  )
}