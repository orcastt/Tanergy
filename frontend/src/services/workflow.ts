import api from "./api"
import type { WorkflowListResponse, WorkflowDetail } from "../types/workflow"

export async function listWorkflows(page = 1, size = 20): Promise<WorkflowListResponse> {
  const { data } = await api.get<WorkflowListResponse>("/workflows", { params: { page, size } })
  return data
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const { data } = await api.get<WorkflowDetail>(`/workflows/${id}`)
  return data
}

export async function createWorkflow(name?: string): Promise<WorkflowDetail> {
  const { data } = await api.post<WorkflowDetail>("/workflows", name ? { name } : {})
  return data
}

export async function updateWorkflow(id: string, body: { name?: string; graph_json?: object }): Promise<WorkflowDetail> {
  const { data } = await api.put<WorkflowDetail>(`/workflows/${id}`, body)
  return data
}

export async function deleteWorkflow(id: string): Promise<void> {
  await api.delete(`/workflows/${id}`)
}
