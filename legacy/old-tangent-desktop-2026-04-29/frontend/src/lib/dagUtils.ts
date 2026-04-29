// All functions use `any` to avoid version mismatches between @xyflow/react packages

export function topologicalSort(nodes: any[], edges: any[]): string[] {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)
    for (const next of adj.get(id) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  if (result.length !== nodes.length) throw new Error("Cycle detected in graph")
  return result
}

export function getExecutionLayers(nodes: any[], edges: any[]): string[][] {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
  }

  const layers: string[][] = []
  const remaining = new Set(nodes.map((n: any) => n.id))

  while (remaining.size > 0) {
    const layer: string[] = []
    for (const id of remaining) {
      if ((inDegree.get(id) || 0) === 0) layer.push(id)
    }
    if (layer.length === 0) throw new Error("Cycle detected")
    layers.push(layer)
    for (const id of layer) {
      remaining.delete(id)
      for (const next of adj.get(id) || []) {
        inDegree.set(next, (inDegree.get(next) || 1) - 1)
      }
    }
  }
  return layers
}

export function getNodeDependencies(nodeId: string, edges: any[]): string[] {
  const deps = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const e of edges) {
      if (e.target === id && !deps.has(e.source)) {
        deps.add(e.source)
        queue.push(e.source)
      }
    }
  }
  return Array.from(deps)
}

export function getNodeDependents(nodeId: string, edges: any[]): string[] {
  const deps = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const e of edges) {
      if (e.source === id && !deps.has(e.target)) {
        deps.add(e.target)
        queue.push(e.target)
      }
    }
  }
  return Array.from(deps)
}

export function hasCycle(nodes: any[], edges: any[]): boolean {
  try { topologicalSort(nodes, edges); return false } catch { return true }
}