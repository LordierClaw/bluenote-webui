# BlueNote WebUI Shell Redesign and AI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the BlueNote WebUI into a richer responsive workspace with manager/preview toggles, icon-led action parity, and full term-style AI workflows surfaced through a shell-first web UX.

**Architecture:** Keep the existing App/AppShell/manager/editor/preview split, but introduce a thin workspace-shell state layer for responsive pane visibility and action surfaces. Reuse browser-safe BlueNote core primitives for search and AI repository/queue/provider behavior, while adding WebUI-specific server services/routes and focused client components for configuration, queue, and note-level AI actions.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, local Node 16.14 toolchain, `@lordierclaw/bluenote-core`, `react-markdown`, Font Awesome React packages.

---

## File Structure

### Existing files to modify
- `src/client/app/App.tsx` — orchestrates workspace data, action/dialog state, keyboard shortcuts, shell wiring.
- `src/client/app/api.ts` — extend client API for AI config, Codex auth status/login/logout, describe, queue, process-queue.
- `src/client/components/AppShell.tsx` — richer top bar, shell controls, AI status chip, responsive toggle entrypoints.
- `src/client/components/FolderManager.tsx` — redesign navigation rows, larger search, icon-led manager header, pane visibility awareness.
- `src/client/components/EditorPane.tsx` — move note operations into icon action bar and AI action entrypoints.
- `src/client/components/PreviewPane.tsx` — support preview/status/AI info modes and preview toggle affordance.
- `src/client/components/ActionDialog.tsx` — general modal surface for note ops and AI flows.
- `src/client/styles/theme.css` — rich flat workspace theme, responsive breakpoints, action strip, icon styles, pane auto-hide behavior.
- `src/shared/types.ts` — extend shared types for pane visibility state and AI config/queue/action payloads.
- `src/server/routes/ai.ts` — register AI parity routes beyond status.
- `src/server/services/ai-service.ts` — expand from status-only to config/auth/describe/queue/process services.
- `package.json` — add Font Awesome dependencies.

### New files to create
- `src/client/app/useResponsivePanes.ts` — browser-only responsive pane state + localStorage persistence for manager/preview visibility.
- `src/client/components/ShellActionBar.tsx` — icon-led shared action bar for note operations and pane toggles.
- `src/client/components/AiDialog.tsx` — on-demand AI workflows container (config, queue, describe, auth status/login/logout).
- `src/client/components/PaneToggleButtons.tsx` — compact reusable manager/preview toggle controls for narrow layouts.
- `src/server/services/ai-commands.ts` — browser-safe wrappers around core AI repositories/clients that mirror term CLI behavior.
- `tests/client-shell-layout.test.tsx` — responsive pane toggle and action-bar tests.
- `tests/client-ai-dialog.test.tsx` — AI config/status/dialog flow tests.
- `tests/server-ai-routes.test.ts` — AI route parity tests.

---

### Task 1: Shell foundation, responsive panes, and Font Awesome design system

**Files:**
- Modify: `src/client/app/App.tsx`
- Modify: `src/client/components/AppShell.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `package.json`
- Create: `src/client/app/useResponsivePanes.ts`
- Create: `src/client/components/PaneToggleButtons.tsx`
- Test: `tests/client-shell-layout.test.tsx`

- [ ] **Step 1: Write the failing shell-layout test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { AppShell } from "../src/client/components/AppShell"
import { useResponsivePanes } from "../src/client/app/useResponsivePanes"

vi.mock("../src/client/app/useResponsivePanes", () => ({
  useResponsivePanes: vi.fn(),
}))

describe("responsive pane controls", () => {
  beforeEach(() => {
    vi.mocked(useResponsivePanes).mockReturnValue({
      managerVisible: false,
      previewVisible: true,
      managerAutoHidden: true,
      previewAutoHidden: false,
      toggleManager: vi.fn(),
      togglePreview: vi.fn(),
    })
  })

  test("shows manager and preview toggle controls when manager auto-hides", () => {
    render(
      <AppShell
        workspace={{ initialized: true, rootPath: "/tmp/demo", noteCount: 3 }}
        aiStatus={{ status: "not-configured" }}
        noteCount={3}
        theme="dark"
        onToggleTheme={() => {}}
        onPalette={() => {}}
      >
        <div>content</div>
      </AppShell>,
    )

    expect(screen.getByRole("button", { name: /show manager/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /hide preview/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the focused shell-layout test to verify RED**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/client-shell-layout.test.tsx
```
Expected: FAIL because `useResponsivePanes` / shell toggle UI does not exist yet.

- [ ] **Step 3: Add Font Awesome packages and responsive pane hook/components**

```json
{
  "dependencies": {
    "@fortawesome/fontawesome-svg-core": "^6.7.2",
    "@fortawesome/free-solid-svg-icons": "^6.7.2",
    "@fortawesome/react-fontawesome": "^0.2.2"
  }
}
```

```ts
// src/client/app/useResponsivePanes.ts
import { useEffect, useMemo, useState } from "react"

const MANAGER_KEY = "bluenote-webui.manager-visible"
const PREVIEW_KEY = "bluenote-webui.preview-visible"
const MANAGER_BREAKPOINT = 980
const PREVIEW_BREAKPOINT = 760

export function useResponsivePanes() {
  const [width, setWidth] = useState(() => window.innerWidth)
  const [managerPreference, setManagerPreference] = useState(() => window.localStorage.getItem(MANAGER_KEY) !== "false")
  const [previewPreference, setPreviewPreference] = useState(() => window.localStorage.getItem(PREVIEW_KEY) !== "false")

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const managerAutoHidden = width < MANAGER_BREAKPOINT && !managerPreference
  const previewAutoHidden = width < PREVIEW_BREAKPOINT && !previewPreference

  return useMemo(() => ({
    managerVisible: width >= MANAGER_BREAKPOINT ? managerPreference : managerPreference && width >= PREVIEW_BREAKPOINT,
    previewVisible: width >= PREVIEW_BREAKPOINT ? previewPreference : previewPreference,
    managerAutoHidden: width < MANAGER_BREAKPOINT && !managerPreference,
    previewAutoHidden: width < PREVIEW_BREAKPOINT && !previewPreference,
    toggleManager() {
      setManagerPreference((value) => {
        const next = !value
        window.localStorage.setItem(MANAGER_KEY, String(next))
        return next
      })
    },
    togglePreview() {
      setPreviewPreference((value) => {
        const next = !value
        window.localStorage.setItem(PREVIEW_KEY, String(next))
        return next
      })
    },
  }), [managerPreference, previewPreference, width])
}
```

- [ ] **Step 4: Wire the hook into `App.tsx` / `AppShell.tsx` and apply the rich-flat shell CSS**

```tsx
// App.tsx
const panes = useResponsivePanes()
...
<AppShell
  ...
  panes={panes}
>
  <div className={`main-grid ${panes.managerVisible ? "manager-visible" : "manager-hidden"} ${panes.previewVisible ? "preview-visible" : "preview-hidden"}`}>
```

```tsx
// AppShell.tsx
<PaneToggleButtons
  managerVisible={panes.managerVisible}
  previewVisible={panes.previewVisible}
  managerAutoHidden={panes.managerAutoHidden}
  previewAutoHidden={panes.previewAutoHidden}
  onToggleManager={panes.toggleManager}
  onTogglePreview={panes.togglePreview}
/>
```

- [ ] **Step 5: Run the focused shell-layout test to verify GREEN**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/client-shell-layout.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit foundation changes**

```bash
git add package.json package-lock.json src/client/app/App.tsx src/client/app/useResponsivePanes.ts src/client/components/AppShell.tsx src/client/components/PaneToggleButtons.tsx src/client/styles/theme.css tests/client-shell-layout.test.tsx
git commit -m "feat: add responsive webui shell foundation"
```

### Task 2: Manager redesign, action bar parity, and larger search

**Files:**
- Modify: `src/client/components/FolderManager.tsx`
- Modify: `src/client/components/EditorPane.tsx`
- Modify: `src/client/components/PreviewPane.tsx`
- Modify: `src/client/app/App.tsx`
- Create: `src/client/components/ShellActionBar.tsx`
- Test: `tests/client-components.test.tsx`
- Test: `tests/client-shell-layout.test.tsx`

- [ ] **Step 1: Write the failing manager/action-bar test**

```tsx
test("renders icon-led action bar and richer navigation metadata", () => {
  render(
    <FolderManager
      currentFolder="note/projects"
      selectedKey="note-1"
      folders={[{ relativePath: "note/projects/archive", name: "archive", noteCount: 2 }]}
      notes={[{ key: "note-1", title: "Project Plan", description: "Milestones", relativePath: "note/projects/project-plan.md", folder: "note" }]}
      query=""
      onQuery={() => {}}
      onOpenFolder={() => {}}
      onSelectNote={() => {}}
      onCreateFolder={() => {}}
      onCreateNote={() => {}}
      onQuickDraft={() => {}}
    />,
  )

  expect(screen.getByRole("textbox", { name: /search in folder/i })).toHaveAttribute("placeholder", expect.stringMatching(/search notes/i))
  expect(screen.getByLabelText(/normal note project plan/i)).toBeInTheDocument()
  expect(screen.getByText("note/projects/project-plan.md")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused component tests to verify RED**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/client-components.test.tsx tests/client-shell-layout.test.tsx
```
Expected: FAIL because the manager still uses plain glyphs, cramped search, and no dedicated shell action bar.

- [ ] **Step 3: Add `ShellActionBar` and redesign manager/editor/preview markup**

```tsx
// src/client/components/ShellActionBar.tsx
export function ShellActionBar({ onNewNote, onNewFolder, onRename, onMove, onSearch, onAi, onToggleManager, onTogglePreview, canMutate, canPromoteDraft }: Props) {
  return (
    <div className="shell-action-bar" aria-label="Note actions">
      <button type="button" aria-label="New note" onClick={onNewNote}><FontAwesomeIcon icon={faNoteSticky} /></button>
      <button type="button" aria-label="New folder" onClick={onNewFolder}><FontAwesomeIcon icon={faFolderPlus} /></button>
      <button type="button" aria-label="Rename note" disabled={!canMutate} onClick={onRename}><FontAwesomeIcon icon={faIcursor} /></button>
      <button type="button" aria-label="Move note" disabled={!canMutate} onClick={onMove}><FontAwesomeIcon icon={faArrowsTurnRight} /></button>
      <button type="button" aria-label="Search everything" onClick={onSearch}><FontAwesomeIcon icon={faMagnifyingGlass} /></button>
      <button type="button" aria-label="AI actions" onClick={onAi}><FontAwesomeIcon icon={faWandMagicSparkles} /></button>
    </div>
  )
}
```

```tsx
// FolderManager note rows
<span className="nav-icon note-icon"><FontAwesomeIcon icon={note.folder === "draft" ? faFilePen : faFileLines} /></span>
<span className="nav-title">{note.title}</span>
<span className="nav-file">{note.relativePath}</span>
<span className="nav-description">{note.description || "No description"}</span>
```

- [ ] **Step 4: Run the focused component tests to verify GREEN**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/client-components.test.tsx tests/client-shell-layout.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit manager/action-bar changes**

```bash
git add src/client/app/App.tsx src/client/components/FolderManager.tsx src/client/components/EditorPane.tsx src/client/components/PreviewPane.tsx src/client/components/ShellActionBar.tsx src/client/styles/theme.css tests/client-components.test.tsx tests/client-shell-layout.test.tsx
git commit -m "feat: redesign manager and action bar parity"
```

### Task 3: WebUI AI parity routes, services, and shared types

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/routes/ai.ts`
- Modify: `src/server/services/ai-service.ts`
- Create: `src/server/services/ai-commands.ts`
- Test: `tests/ai-service.test.ts`
- Create: `tests/server-ai-routes.test.ts`

- [ ] **Step 1: Write the failing AI route test**

```ts
import { describe, expect, test } from "vitest"

import { createServer } from "../src/server/index.js"

describe("AI routes", () => {
  test("supports config show and queue endpoints", async () => {
    const server = createServer({ host: "127.0.0.1" })
    const response = await server.inject?.({ method: "GET", path: "/api/ai/queue" })
    expect(response?.statusCode).toBe(200)
  })
})
```

- [ ] **Step 2: Run the focused AI tests to verify RED**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```
Expected: FAIL because only `/api/ai/status` exists.

- [ ] **Step 3: Add typed AI route/service wrappers around core repositories and clients**

```ts
// src/server/services/ai-commands.ts
import {
  createAiConfigRepository,
  createAiQueueRepository,
  createAiTextGenerationClient,
  createCodexAuthClient,
  createCodexAuthRepository,
  dropDescribeNoteJobIfNoteMissing,
  formatCodexAuthStatus,
  generateNoteDescription,
  listPendingAiJobs,
  listRetryableAiJobs,
  maskApiKey,
  sanitizeAiErrorMessage,
  sanitizeCodexAuthErrorMessage,
} from "@lordierclaw/bluenote-core"

export async function describeNoteWithAi(rootPath: string, selector: string) {
  const config = createAiConfigRepository(rootPath).read()
  const client = createAiTextGenerationClient(config)
  return generateNoteDescription({ rootPath, selector, client })
}
```

```ts
// src/server/routes/ai.ts
router.get("/api/ai/status", () => getAiStatus())
router.get("/api/ai/config", () => getAiConfigView())
router.post("/api/ai/config", ({ body }) => saveAiConfig(body as AiConfigRequest))
router.get("/api/ai/queue", () => getAiQueueView())
router.post("/api/ai/describe", ({ body }) => describeNote((body as { selector?: string }).selector ?? ""))
router.post("/api/ai/process-queue", ({ body }) => processAiQueue((body as { limit?: number } | undefined)?.limit))
router.get("/api/ai/codex-auth", () => getCodexAuthView())
router.post("/api/ai/codex-auth/login", () => startCodexAuthLogin())
router.post("/api/ai/codex-auth/logout", () => logoutCodexAuth())
```

- [ ] **Step 4: Run the focused AI tests to verify GREEN**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit AI server parity changes**

```bash
git add src/shared/types.ts src/server/routes/ai.ts src/server/services/ai-service.ts src/server/services/ai-commands.ts tests/ai-service.test.ts tests/server-ai-routes.test.ts
git commit -m "feat: add webui ai parity services"
```

### Task 4: Client AI dialog, shell integration, and browser verification

**Files:**
- Modify: `src/client/app/App.tsx`
- Modify: `src/client/app/api.ts`
- Modify: `src/client/components/AppShell.tsx`
- Modify: `src/client/components/ActionDialog.tsx`
- Create: `src/client/components/AiDialog.tsx`
- Test: `tests/client-ai-dialog.test.tsx`
- Test: `tests/client-shell-layout.test.tsx`

- [ ] **Step 1: Write the failing AI dialog test**

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { AiDialog } from "../src/client/components/AiDialog"

describe("AiDialog", () => {
  test("shows config and queue sections for connected AI", () => {
    render(
      <AiDialog
        open
        status={{ status: "connected", provider: "codex", model: "gpt-5" }}
        queue={{ pending: 2, running: 1, failed: 0, jobs: [] }}
        config={{ provider: "codex", model: "gpt-5", outputLanguage: "English", maxAttempts: 3 }}
        onClose={() => {}}
        onSaveConfig={vi.fn()}
        onDescribe={vi.fn()}
        onProcessQueue={vi.fn()}
        onCodexLogin={vi.fn()}
        onCodexLogout={vi.fn()}
      />,
    )

    expect(screen.getByText(/AI configuration/i)).toBeInTheDocument()
    expect(screen.getByText(/Pending jobs: 2/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the focused AI dialog test to verify RED**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/client-ai-dialog.test.tsx
```
Expected: FAIL because `AiDialog` and client AI APIs do not exist.

- [ ] **Step 3: Implement client AI dialog and wire it into `App.tsx`**

```ts
// src/client/app/api.ts
aiConfig: () => request<AiConfigView>("/api/ai/config"),
saveAiConfig: (body: AiConfigRequest) => request<AiConfigView>("/api/ai/config", { method: "POST", body: JSON.stringify(body) }),
aiQueue: () => request<AiQueueView>("/api/ai/queue"),
describeWithAi: (selector: string) => request<AiDescribeResult>("/api/ai/describe", { method: "POST", body: JSON.stringify({ selector }) }),
processAiQueue: (limit?: number) => request<AiProcessQueueResult>("/api/ai/process-queue", { method: "POST", body: JSON.stringify({ limit }) }),
codexAuthStatus: () => request<CodexAuthView>("/api/ai/codex-auth"),
startCodexAuthLogin: () => request<CodexAuthLoginView>("/api/ai/codex-auth/login", { method: "POST" }),
logoutCodexAuth: () => request<CodexAuthView>("/api/ai/codex-auth/logout", { method: "POST" }),
```

```tsx
// App.tsx
const [aiDialogOpen, setAiDialogOpen] = useState(false)
...
<ShellActionBar onAi={() => setAiDialogOpen(true)} ... />
<AiDialog
  open={aiDialogOpen}
  status={aiStatus}
  selectedNote={selectedNote}
  onClose={() => setAiDialogOpen(false)}
  onRefreshStatus={() => api.aiStatus().then(setAiStatus)}
/>
```

- [ ] **Step 4: Run focused UI tests, then full project gate**

Run:
```bash
source ../use-node-16.14.sh && npm run test -- tests/client-ai-dialog.test.tsx tests/client-shell-layout.test.tsx tests/client-components.test.tsx tests/ai-service.test.ts tests/server-ai-routes.test.ts
source ../use-node-16.14.sh && npm run check
```
Expected: all focused tests PASS, then full `npm run check` PASS.

- [ ] **Step 5: Verify in the browser and commit the finished work**

Run:
```bash
source ../use-node-16.14.sh && npm run dev
```
Then verify in browser:
- desktop and narrow widths
- manager hide/show
- preview hide/show
- richer action bar
- larger search affordance
- move/rename/create flows
- AI status chip
- AI dialog config/queue/describe/auth surfaces
- overall user-POV design/usability rating

Commit:
```bash
git add src/client/app/App.tsx src/client/app/api.ts src/client/components/AppShell.tsx src/client/components/ActionDialog.tsx src/client/components/AiDialog.tsx src/client/components/ShellActionBar.tsx src/client/styles/theme.css tests/client-ai-dialog.test.tsx tests/client-shell-layout.test.tsx tests/client-components.test.tsx
 git commit -m "feat: complete webui redesign and ai parity"
```

---

## Self-Review

### Spec coverage
- Shell redesign, richer color, Font Awesome icons, manager/preview toggles, larger search, and action bar parity are covered by Tasks 1-2.
- AI shell status plus full on-demand AI workflows are covered by Tasks 3-4.
- Browser verification and user-POV rating are covered by Task 4 Step 5.

### Placeholder scan
- No `TODO`/`TBD` placeholders remain.
- Every task includes exact files, tests, and commands.

### Type consistency
- Shared AI typing is centralized in `src/shared/types.ts`.
- Responsive pane state is isolated in `useResponsivePanes` and consumed by `AppShell` / `App`.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-10-webui-shell-redesign-and-ai-parity.md`.

Because you explicitly said “approve and proceed until complete,” I will use **Inline Execution** and continue in this session using the executing-plans workflow rather than stopping for an execution-choice prompt.