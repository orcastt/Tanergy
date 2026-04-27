import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { tauri } from "../../services/tauri"
import type { LibraryItem, LibraryKind } from "../../types/library"

type GraphNodeKind = "root" | "kind" | "tag" | "item"

interface GraphNode {
  id: string
  label: string
  kind: GraphNodeKind
  x: number
  y: number
  radius: number
  accent: string
  itemKind?: LibraryKind
}

interface GraphEdge {
  from: string
  to: string
}

interface GraphLabels {
  root: string
  text: string
  image: string
}

interface LibraryKnowledgeGraphProps {
  query: string
  selectedTag: string
  onSelectTag: (tag: string) => void
  onSelectKind: (kind: LibraryKind) => void
}

const GRAPH_WIDTH = 920
const GRAPH_HEIGHT = 540
const MAX_ITEMS = 34
const MAX_TAGS = 22
const CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }

export default function LibraryKnowledgeGraph({ query, selectedTag, onSelectTag, onSelectKind }: LibraryKnowledgeGraphProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [kindFilter, setKindFilter] = useState<LibraryKind | "">("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadGraphItems() {
      await Promise.resolve()
      if (!active) return
      setLoading(true)
      setError(null)
      try {
        const nextItems = await tauri.listLibraryItems({ kind: kindFilter || undefined, query, tag: selectedTag || undefined })
        if (active) setItems(nextItems)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadGraphItems()
    return () => { active = false }
  }, [kindFilter, query, selectedTag])

  const graphLabels = useMemo((): GraphLabels => ({
    root: t("workspaceLibrary.legendLibrary"),
    text: t("workspaceLibrary.legendText"),
    image: t("workspaceLibrary.legendImage"),
  }), [t])
  const graph = useMemo(() => buildGraph(items, graphLabels), [items, graphLabels])

  function selectKind(kind: LibraryKind) {
    setKindFilter(kindFilter === kind ? "" : kind)
    onSelectKind(kind)
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>{t("workspaceLibrary.graphTitle")}</h3>
          <p style={subtitleStyle}>{t("workspaceLibrary.graphSubtitle", { count: items.length })}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {kindFilter && (
            <button onClick={() => setKindFilter("")} style={ghostButtonStyle}>
              {t("workspaceLibrary.showAll")}
            </button>
          )}
          {selectedTag && (
            <button onClick={() => onSelectTag("")} style={ghostButtonStyle}>
              {t("workspaceLibrary.clearTag")}
            </button>
          )}
        </div>
      </div>

      {loading && <GraphState icon="hourglass_top" text={t("workspaceLibrary.graphLoading")} />}
      {error && <GraphState icon="error" text={error} tone="error" />}
      {!loading && !error && items.length === 0 && <GraphState icon="hub" text={t("workspaceLibrary.graphEmpty")} />}
      {!loading && !error && items.length > 0 && (
        <div style={graphShellStyle}>
          <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} style={{ width: "100%", minHeight: 520 }}>
            <defs>
              <filter id="graphNodeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#222A35" floodOpacity="0.08" />
              </filter>
            </defs>
            {graph.edges.map((edge) => {
              const from = graph.nodeMap.get(edge.from)
              const to = graph.nodeMap.get(edge.to)
              if (!from || !to) return null
              return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(36,36,36,0.15)" strokeWidth={1.2} />
            })}
            {graph.nodes.map((node) => (
              <g key={node.id} role="button" tabIndex={0} onClick={() => handleNodeClick(node, onSelectTag, selectKind)} style={{ cursor: node.kind === "item" || node.kind === "root" ? "default" : "pointer" }}>
                <circle cx={node.x} cy={node.y} r={node.radius} fill="#fff" stroke={node.accent} strokeWidth={node.kind === "root" ? 2.4 : 1.4} filter="url(#graphNodeShadow)" />
                <text x={node.x} y={node.y - 2} textAnchor="middle" dominantBaseline="middle" fill="#242424" fontSize={node.kind === "root" ? 15 : 11} fontWeight={node.kind === "item" ? 600 : 800}>
                  {truncateLabel(node.label, node.kind === "item" ? 10 : 12)}
                </text>
                <text x={node.x} y={node.y + 14} textAnchor="middle" dominantBaseline="middle" fill="#898989" fontSize={9} fontWeight={700}>
                  {getKindLabel(node.kind, t)}
                </text>
              </g>
            ))}
          </svg>
          <div style={legendStyle}>
            <LegendDot color="#242424" label={t("workspaceLibrary.legendLibrary")} />
            <LegendDot color="#3B82F6" label={t("workspaceLibrary.legendText")} />
            <LegendDot color="#22C55E" label={t("workspaceLibrary.legendImage")} />
            <LegendDot color="#8B5CF6" label={t("workspaceLibrary.legendTag")} />
          </div>
        </div>
      )}
    </section>
  )
}

function buildGraph(items: LibraryItem[], labels: GraphLabels) {
  const visibleItems = items.slice(0, MAX_ITEMS)
  const tags = Array.from(new Set(visibleItems.flatMap((item) => item.tags))).slice(0, MAX_TAGS)
  const nodes: GraphNode[] = [
    { id: "root", label: labels.root, kind: "root", x: CENTER.x, y: CENTER.y, radius: 48, accent: "#242424" },
    { id: "kind:text", label: labels.text, kind: "kind", x: CENTER.x - 180, y: CENTER.y - 130, radius: 34, accent: "#3B82F6", itemKind: "text" },
    { id: "kind:image", label: labels.image, kind: "kind", x: CENTER.x + 180, y: CENTER.y - 130, radius: 34, accent: "#22C55E", itemKind: "image" },
  ]
  const edges: GraphEdge[] = [{ from: "root", to: "kind:text" }, { from: "root", to: "kind:image" }]

  tags.forEach((tag, index) => {
    const point = orbit(index, Math.max(tags.length, 1), 175, Math.PI * 0.82)
    nodes.push({ id: `tag:${tag}`, label: tag, kind: "tag", x: point.x, y: point.y, radius: 28, accent: "#8B5CF6" })
    edges.push({ from: "root", to: `tag:${tag}` })
  })

  visibleItems.forEach((item, index) => {
    const point = orbit(index, Math.max(visibleItems.length, 1), 245, -Math.PI / 2)
    const id = `item:${item.id}`
    nodes.push({ id, label: item.title, kind: "item", x: point.x, y: point.y, radius: 24, accent: item.kind === "image" ? "#22C55E" : "#3B82F6", itemKind: item.kind })
    edges.push({ from: `kind:${item.kind}`, to: id })
    item.tags.filter((tag) => tags.includes(tag)).forEach((tag) => edges.push({ from: `tag:${tag}`, to: id }))
  })

  return { nodes, edges, nodeMap: new Map(nodes.map((node) => [node.id, node])) }
}

function orbit(index: number, total: number, radius: number, offset: number) {
  const angle = offset + (Math.PI * 2 * index) / total
  return { x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius }
}

function handleNodeClick(node: GraphNode, onSelectTag: (tag: string) => void, onSelectKind: (kind: LibraryKind) => void) {
  if (node.kind === "tag") onSelectTag(node.label)
  if (node.kind === "kind" && node.itemKind) onSelectKind(node.itemKind)
}

function truncateLabel(label: string, max: number) {
  return label.length > max ? `${label.slice(0, max)}…` : label
}

function getKindLabel(kind: GraphNodeKind, t: (key: string) => string) {
  if (kind === "root") return t("workspaceLibrary.kindRoot")
  if (kind === "kind") return t("workspaceLibrary.kindType")
  if (kind === "tag") return t("workspaceLibrary.kindTag")
  return t("workspaceLibrary.kindItem")
}

function GraphState({ icon, text, tone }: { icon: string; text: string; tone?: "error" }) {
  return (
    <div style={{ minHeight: 420, display: "grid", placeItems: "center", color: tone === "error" ? "#EF4444" : "var(--text-secondary)" }}>
      <div style={{ textAlign: "center" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 42 }}>{icon}</span>
        <p style={{ marginTop: 10, fontSize: 13 }}>{text}</p>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />{label}</span>
}

const panelStyle: CSSProperties = { background: "var(--bg-surface)", borderRadius: "0.5rem", padding: "1.25rem", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)" }
const headerStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }
const titleStyle: CSSProperties = { margin: 0, fontFamily: '"Space Grotesk", sans-serif', fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }
const subtitleStyle: CSSProperties = { margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }
const graphShellStyle: CSSProperties = { borderRadius: "0.75rem", background: "#FAFAFA", overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }
const legendStyle: CSSProperties = { display: "flex", gap: "1rem", padding: "0.75rem 1rem", fontSize: "0.6875rem", color: "var(--text-secondary)", background: "rgba(255,255,255,0.78)", boxShadow: "inset 0 1px 0 rgba(0,0,0,0.05)" }
const ghostButtonStyle: CSSProperties = { border: "none", borderRadius: 999, background: "var(--bg-hover)", color: "var(--text-primary)", padding: "0.45rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }
