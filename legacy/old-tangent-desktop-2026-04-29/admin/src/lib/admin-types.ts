export interface Provider {
  id: string;
  name: string;
  base_url: string;
  key_env: string;
  auth_style: string;
  extra_headers: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
}

export interface Model {
  id: string;
  provider: string;
  model: string;
  display_name: string;
  call_type: string;
  is_active: boolean;
  credits_per_call: number;
  credits_per_1k_tokens: number;
  max_tokens: number;
  endpoint_type: string | null;
  capabilities: Record<string, unknown>;
  parameter_schema: Record<string, unknown>;
  pricing_schema: Record<string, unknown>;
  smoke_test_payload: Record<string, unknown>;
  is_default: boolean;
  fallback_priority: number;
}

export interface ApiLog {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  call_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  credits_used: number;
  latency_ms: number;
  status: string;
  error_message: string | null;
  endpoint: string | null;
  request_params: Record<string, unknown>;
  response_meta: Record<string, unknown>;
  upstream_task_id: string | null;
  error_code: string | null;
  refund_transaction_id: string | null;
  upstream_cost: Record<string, unknown>;
  route_provider: string | null;
  created_at: string;
}

export interface ProviderHealth {
  provider: Provider;
  key_configured: boolean;
  key_env: string;
  base_url: string;
  is_active: boolean;
  ready: boolean;
  issues: string[];
}

export interface TestResult {
  provider: string;
  model: string | null;
  endpoint: string | null;
  execute: boolean;
  ok: boolean;
  latency_ms: number;
  status_code: number | null;
  request_params: Record<string, unknown>;
  response_meta: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  api_log_id: string | null;
}

export interface ModelUsage {
  total_calls: number;
  success_calls: number;
  error_calls: number;
  total_credits: number;
  avg_latency_ms: number;
  success_rate: number;
}

export interface ModelDetail {
  model: Model;
  usage: ModelUsage;
  recent_logs: ApiLog[];
}

export interface ApiLogDetail {
  log: ApiLog;
  user_email: string | null;
  user_display_name: string | null;
  created_at: string;
}
