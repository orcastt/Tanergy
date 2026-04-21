// DEPRECATED — Legacy REST API client (replaced by Tauri IPC in Slice 2).
// This stub exists only to prevent build errors from workflowStore imports.

function _throw(): Promise<never> {
  return Promise.reject(new Error("REST API deprecated — use Tauri IPC"))
}

const api = {
  get<T = any>(..._args: any[]): Promise<{ data: T }> { return _throw() },
  post<T = any>(..._args: any[]): Promise<{ data: T }> { return _throw() },
  put<T = any>(..._args: any[]): Promise<{ data: T }> { return _throw() },
  delete(..._args: any[]): Promise<void> { return _throw() },
}

export default api
