import type { AiStatusSummary, CreateNoteRequest, NoteDetailView, NoteSummaryView, SearchResultView, UpdateNoteRequest, WorkspaceStatus } from "../../shared/types"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = data?.error?.message ?? `Request failed with ${response.status}`
    throw new Error(message)
  }
  return data as T
}

export const api = {
  health: () => request("/api/health"),
  workspace: () => request<WorkspaceStatus>("/api/workspace"),
  openWorkspace: (rootPath: string) => request<WorkspaceStatus>("/api/workspace/open", { method: "POST", body: JSON.stringify({ rootPath }) }),
  initWorkspace: (rootPath: string) => request<WorkspaceStatus>("/api/workspace/init", { method: "POST", body: JSON.stringify({ rootPath }) }),
  aiStatus: () => request<AiStatusSummary>("/api/ai/status"),
  notes: (params: { folder?: string; query?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.folder) query.set("folder", params.folder)
    if (params.query) query.set("query", params.query)
    return request<(NoteSummaryView | SearchResultView)[]>(`/api/notes?${query.toString()}`)
  },
  note: (id: string) => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}`),
  createNote: (body: CreateNoteRequest) => request<NoteDetailView>("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  updateNote: (id: string, body: UpdateNoteRequest) => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteNote: (id: string) => request(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  archiveNote: (id: string) => request(`/api/notes/${encodeURIComponent(id)}/archive`, { method: "POST" }),
  promoteDraft: (id: string, title?: string) => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}/promote`, { method: "POST", body: JSON.stringify({ title, destinationFolder: "note" }) }),
  rebuild: () => request("/api/rebuild", { method: "POST" }),
}
