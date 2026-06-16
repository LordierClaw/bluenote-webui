import type {
  AiConfigView,
  AiDescribeRequest,
  AiEnqueueDescribeResult,
  AiProcessQueueRequest,
  AiProcessQueueResult,
  AiQueueView,
  AiStatusSummary,
  CodexAuthStartView,
  CodexAuthPollView,
  CodexAuthStatusView,
  CreateNoteRequest,
  FolderView,
  NoteDetailView,
  NoteSummaryView,
  SearchResultView,
  UpdateNoteRequest,
  WorkspaceStatus,
} from "../../shared/types"

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
  aiConfig: () => request<AiConfigView>("/api/ai/config"),
  saveAiConfig: (config: unknown) => request<AiConfigView>("/api/ai/config", { method: "POST", body: JSON.stringify(config) }),
  aiQueue: () => request<AiQueueView>("/api/ai/queue"),
  aiDescribe: (body: AiDescribeRequest) => request<AiEnqueueDescribeResult>("/api/ai/describe", { method: "POST", body: JSON.stringify(body) }),
  aiQueueDescribe: (body: AiDescribeRequest) => request<AiEnqueueDescribeResult>("/api/ai/queue/describe", { method: "POST", body: JSON.stringify(body) }),
  aiProcessQueue: (body: AiProcessQueueRequest = {}) => request<AiProcessQueueResult>("/api/ai/process-queue", { method: "POST", body: JSON.stringify(body) }),
  codexAuthStatus: () => request<CodexAuthStatusView>("/api/ai/codex-auth/status"),
  startCodexAuth: () => request<CodexAuthStartView>("/api/ai/codex-auth/start", { method: "POST" }),
  pollCodexAuth: () => request<CodexAuthPollView>("/api/ai/codex-auth/poll", { method: "POST" }),
  deleteCodexAuth: () => request<{ ok: true }>("/api/ai/codex-auth", { method: "DELETE" }),
  folders: () => request<FolderView[]>("/api/folders"),
  createFolder: (relativePath: string) => request<FolderView>("/api/folders", { method: "POST", body: JSON.stringify({ relativePath }) }),
  renameFolder: (relativePath: string, nextName: string) => request<{ previousRelativePath: string; relativePath: string }>("/api/folders/rename", { method: "PATCH", body: JSON.stringify({ relativePath, nextName }) }),
  notes: (params: { folder?: string; query?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.folder) query.set("folder", params.folder)
    if (params.query) query.set("query", params.query)
    return request<(NoteSummaryView | SearchResultView)[]>(`/api/notes?${query.toString()}`)
  },
  note: (id: string) => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}`),
  startupNote: () => request<NoteDetailView>("/api/notes/startup"),
  createNote: (body: CreateNoteRequest) => request<NoteDetailView>("/api/notes", { method: "POST", body: JSON.stringify(body) }),
  updateNote: (id: string, body: UpdateNoteRequest) => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteNote: (id: string) => request(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  archiveNote: (id: string) => request(`/api/notes/${encodeURIComponent(id)}/archive`, { method: "POST" }),
  moveNote: (id: string, destinationFolder: string) => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}/move`, { method: "POST", body: JSON.stringify({ destinationFolder }) }),
  promoteDraft: (id: string, title?: string, destinationFolder = "note") => request<NoteDetailView>(`/api/notes/${encodeURIComponent(id)}/promote`, { method: "POST", body: JSON.stringify({ title, destinationFolder }) }),
  rebuild: () => request("/api/rebuild", { method: "POST" }),
}
