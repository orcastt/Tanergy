export interface Workflow {
  id: string
  name: string
  thumbnail_path: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowDetail {
  id: string
  name: string
  graph_json: string
  thumbnail_path: string | null
  created_at: string
  updated_at: string
}
