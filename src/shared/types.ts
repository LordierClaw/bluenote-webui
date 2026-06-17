export const APP_NAME = "bluenote-webui"

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    hint?: string
  }
}

export interface HealthResponse {
  app: typeof APP_NAME
  status: "ok"
  nodeVersion: string
  host: string
}

export interface WorkspaceStatus {
  selected: boolean
  initialized: boolean
  rootPath?: string
  defaultRootPath?: string
  noteCount?: number
  message?: string
}

export interface FolderView {
  relativePath: string
  name: string
  noteCount: number
}

export type NoteFolder = "note" | "draft" | "all"

export interface NoteSummaryView {
  key: string
  title: string
  description: string
  relativePath: string
  folder: "note" | "draft"
  createdAt?: string
  updatedAt?: string
}

export interface NoteDetailView extends NoteSummaryView {
  body: string
}

export interface SearchResultView extends NoteSummaryView {
  source: string
  score?: number
  match?: string
}

export interface CommandResult {
  id: string
  label: string
  kind: "command" | "note"
  disabled?: boolean
  note?: SearchResultView
}

export interface AiStatusSummary {
  status: "workspace-not-open" | "not-configured" | "auth-required" | "connected" | "running" | "error"
  provider?: string
  model?: string
  queue?: {
    pending: number
    running: number
    failed: number
  }
  message?: string
}

export interface AiConfigLoggingView {
  usage: boolean
  conversations: boolean
  results: boolean
}

export interface AiConfigView {
  configured: boolean
  enabled?: boolean
  provider?: "openai-compatible" | "codex"
  model?: string
  baseUrl?: string
  apiKeyMasked?: string
  logging?: AiConfigLoggingView
  maxAttempts?: number
  outputLanguage?: string
}

export interface AiQueueJobView {
  kind: "describe-note"
  key: string
  relativePath: string
  status: "pending" | "running" | "failed"
  attempts: number
  lastError?: string | null
  updatedAt: string
}

export interface AiQueueView {
  jobs: AiQueueJobView[]
}

export interface CodexAuthStatusView {
  state: "not-configured" | "setup-required" | "authenticated" | "expired" | "invalid"
  expiresAt?: string
  issuer?: string
  message?: string
  hint?: string
}

export interface CodexAuthStartView {
  verificationUrl: string
  userCode: string
  intervalSeconds: number
  state: "pending"
}

export interface CodexAuthPollView {
  state: "pending" | "authenticated" | "expired" | "invalid" | "cancelled"
  message?: string
  auth?: CodexAuthStatusView
}

export interface AiDescribeRequest {
  selector: string
}

export interface AiEnqueueDescribeResult {
  key: string
  relativePath: string
  enqueued: boolean
  queue: {
    pending: number
    running: number
    failed: number
  }
}

export interface AiProcessQueueRequest {
  limit?: number
}

export interface AiProcessQueueResult {
  applied: number
  failed: number
  remaining: number
  setupBlocked: boolean
}

export interface CreateNoteRequest {
  type?: "draft" | "normal"
  title?: string
  body?: string
  destinationFolder?: string
}

export interface UpdateNoteRequest {
  body: string
  title?: string
}

export function folderFromRelativePath(relativePath: string): "note" | "draft" {
  return relativePath.startsWith("draft/") ? "draft" : "note"
}
