export type LibraryKind = "text" | "image"

export interface LibraryItem {
  id: string
  kind: LibraryKind
  title: string
  content_html?: string | null
  plain_text?: string | null
  file_path?: string | null
  mime_type?: string | null
  source_workflow_id?: string | null
  source_node_id?: string | null
  created_at: string
  updated_at: string
  tags: string[]
}

export interface CreateLibraryItemPayload {
  kind: LibraryKind
  title: string
  content_html?: string | null
  plain_text?: string | null
  file_path?: string | null
  data_url?: string | null
  mime_type?: string | null
  source_workflow_id?: string | null
  source_node_id?: string | null
  tags?: string[]
}
