import { create } from "zustand"
import { tauri } from "../services/tauri"
import { buildActions } from "./nodeBuilder"

export interface AgentMessage {
  id: string
  role: "user" | "assistant"
  content: string
  actions?: AgentAction[]
}

export interface AgentAction {
  op: "add" | "connect"
  type?: string
  from?: string
  fromPort?: string
  to?: string
  toPort?: string
  position?: [number, number]
}

interface AgentState {
  open: boolean
  messages: AgentMessage[]
  loading: boolean
  setOpen: (open: boolean) => void
  sendMessage: (text: string) => Promise<void>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  open: false,
  messages: [],
  loading: false,

  setOpen: (open) => set({ open }),

  sendMessage: async (text: string) => {
    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    }
    set((s) => ({ messages: [...s.messages, userMsg], loading: true }))

    try {
      const history = get().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const result = await tauri.agentChat({ messages: history, context: {} })
      const parsed = parseAgentResponse(result.message)
      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: parsed.message,
        actions: parsed.actions,
      }
      set((s) => ({ messages: [...s.messages, assistantMsg], loading: false }))

      if (parsed.actions.length > 0) {
        buildActions(parsed.actions)
      }
    } catch (e) {
      const errorMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${e instanceof Error ? e.message : String(e)}`,
      }
      set((s) => ({ messages: [...s.messages, errorMsg], loading: false }))
    }
  },
}))

function parseAgentResponse(raw: string): { message: string; actions: AgentAction[] } {
  try {
    const json = JSON.parse(raw)
    return {
      message: json.message ?? raw,
      actions: Array.isArray(json.actions) ? json.actions : [],
    }
  } catch {
    return { message: raw, actions: [] }
  }
}
