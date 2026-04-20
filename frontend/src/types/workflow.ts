export interface Workflow {
  id: string
  name: string
  thumbnail_url: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowDetail extends Workflow {
  graph_json: { nodes: unknown[]; edges: unknown[] }
}

export interface WorkflowListResponse {
  workflows: Workflow[]
  total: number
}
