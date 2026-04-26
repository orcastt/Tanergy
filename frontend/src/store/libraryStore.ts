import { create } from "zustand"
import { tauri } from "../services/tauri"
import type { CreateLibraryItemPayload, LibraryItem, LibraryKind } from "../types/library"

interface LibraryState {
  open: boolean
  kind: LibraryKind
  query: string
  selectedTag: string
  items: LibraryItem[]
  tags: string[]
  loading: boolean
  error: string | null
  setOpen: (open: boolean) => void
  setKind: (kind: LibraryKind) => void
  setQuery: (query: string) => void
  setSelectedTag: (tag: string) => void
  refresh: () => Promise<void>
  createItem: (payload: CreateLibraryItemPayload) => Promise<LibraryItem>
  deleteItem: (id: string) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  open: false,
  kind: "text",
  query: "",
  selectedTag: "",
  items: [],
  tags: [],
  loading: false,
  error: null,

  setOpen: (open) => {
    set({ open })
    if (open) void get().refresh()
  },
  setKind: (kind) => {
    set({ kind })
    void get().refresh()
  },
  setQuery: (query) => {
    set({ query })
    void get().refresh()
  },
  setSelectedTag: (selectedTag) => {
    set({ selectedTag })
    void get().refresh()
  },
  refresh: async () => {
    const { kind, query, selectedTag } = get()
    set({ loading: true, error: null })
    try {
      const [items, tags] = await Promise.all([
        tauri.listLibraryItems({ kind, query, tag: selectedTag || undefined }),
        tauri.listLibraryTags(),
      ])
      set({ items, tags, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },
  createItem: async (payload) => {
    const item = await tauri.createLibraryItem(payload)
    await get().refresh()
    return item
  },
  deleteItem: async (id) => {
    await tauri.deleteLibraryItem(id)
    await get().refresh()
  },
}))
