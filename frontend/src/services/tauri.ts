import { invoke } from "@tauri-apps/api/core"
import type { LicenseInfo, KeyStatus, ProviderInfo } from "../types/license"
import type { Workflow, WorkflowDetail } from "../types/workflow"
import type { CreditInfo } from "../types/credits"

export interface ExecutePayload {
  node_type: string
  node_data: Record<string, unknown>
  input_data: Record<string, unknown>
}

export interface ExecuteResult {
  output: unknown
  status: string
}

export interface AssetInfo {
  id: string
  node_id: string
  type: string
  file_path: string
  original_filename: string | null
  size_bytes: number
  mime_type: string
  created_at: string
}

export const tauri = {
  // Health
  healthCheck: () =>
    invoke<{ status: string; version: string }>("health_check"),

  // App config
  getConfig: (key: string) =>
    invoke<string | null>("get_config", { key }),
  setConfig: (key: string, value: string) =>
    invoke<void>("set_config", { key, value }),

  // License
  activateLicense: (key: string) =>
    invoke<LicenseInfo>("activate_license", { key }),
  checkLicenseStatus: () =>
    invoke<LicenseInfo>("check_license_status"),
  deactivateLicense: () =>
    invoke<void>("deactivate_license"),

  // API Keys
  setApiKey: (providerId: string, key: string) =>
    invoke<void>("set_api_key", { providerId, key }),
  testApiKey: (providerId: string) =>
    invoke<boolean>("test_api_key", { providerId }),
  getApiKeyStatus: (providerId: string) =>
    invoke<KeyStatus>("get_api_key_status", { providerId }),
  getAllProviders: () =>
    invoke<ProviderInfo[]>("get_all_providers"),
  removeApiKey: (providerId: string) =>
    invoke<void>("remove_api_key", { providerId }),
  setAppConfig: (key: string, value: string) =>
    invoke<void>("set_app_config", { key, value }),
  getAppConfig: (key: string) =>
    invoke<string>("get_app_config", { key }),

  // AI rewrite
  aiRewriteHtml: (originalHtml: string, instruction: string) =>
    invoke<string>("ai_rewrite_html", { originalHtml, instruction }),

  // Workflows
  listWorkflows: () =>
    invoke<Workflow[]>("list_workflows"),
  getWorkflow: (id: string) =>
    invoke<WorkflowDetail>("get_workflow", { id }),
  createWorkflow: (name?: string) =>
    invoke<WorkflowDetail>("create_workflow", { name }),
  updateWorkflow: (id: string, payload: { name?: string; graph_json?: string }) =>
    invoke<WorkflowDetail>("update_workflow", { id, payload }),
  deleteWorkflow: (id: string) =>
    invoke<void>("delete_workflow", { id }),

  // Workflow Import/Export
  exportWorkflow: (id: string) =>
    invoke<string>("export_workflow", { id }),
  importWorkflow: (name: string, graphJson: string) =>
    invoke<WorkflowDetail>("import_workflow", { name, graphJson }),

  // Node execution
  executeNode: (payload: ExecutePayload) =>
    invoke<ExecuteResult>("execute_node", { payload }),

  // Assets
  getAssets: (workflowId: string, nodeId?: string) =>
    invoke<AssetInfo[]>("get_assets", { workflowId, nodeId }),
  readAssetFile: (filePath: string) =>
    invoke<number[]>("read_asset_file", { filePath }),
  deleteAsset: (id: string) =>
    invoke<void>("delete_asset", { id }),

  // Credits
  getCreditBalance: () =>
    invoke<CreditInfo>("get_credit_balance"),
  refreshCredits: () =>
    invoke<CreditInfo>("refresh_credits"),
  loginOfficial: (email: string) =>
    invoke<void>("login_official", { email }),
  verifyOtp: (email: string, token: string) =>
    invoke<void>("verify_otp", { email, token }),
  logoutOfficial: () =>
    invoke<void>("logout_official"),

  // Agent
  agentChat: (params: { messages: { role: string; content: string }[]; context: Record<string, unknown> }) =>
    invoke<{ message: string }>("agent_chat", { payload: params }),

  // Billing
  createCheckout: (plan: string) =>
    invoke<{ url: string }>("create_checkout", { plan }),
  getSubscription: () =>
    invoke<{ plan: string; credits_remaining: number }>("get_subscription"),
}
