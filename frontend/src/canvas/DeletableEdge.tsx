import { useState, useCallback } from "react"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from "@xyflow/react"
import { useCanvasStore } from "../store/canvasStore"

export default function DeletableEdge(props: EdgeProps) {
  try {
    return <DeletableEdgeInner {...props} />
  } catch {
    // Fallback: render basic edge without delete button
    return <BaseEdge id={props.id} path={props.path ?? ""} style={props.style} />
  }
}

function DeletableEdgeInner({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition = Position.Right, targetPosition = Position.Left,
  selected, style = {},
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const removeEdge = useCanvasStore((s) => s.removeEdge)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    removeEdge(id)
  }, [id, removeEdge])

  const isHighlighted = selected || hovered

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: isHighlighted ? "#3B82F6" : (style.stroke as string || "#c4c7c7"),
          strokeWidth: isHighlighted ? 2.5 : 2,
          transition: "stroke 0.15s ease, stroke-width 0.15s ease",
          cursor: "pointer",
        }}
      />
      {isHighlighted && (
        <EdgeLabelRenderer>
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <button
              onClick={handleDelete}
              style={{
                width: "20px", height: "20px",
                borderRadius: "50%",
                border: "none",
                background: "#EF4444",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
                padding: 0,
              }}
            >−</button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
