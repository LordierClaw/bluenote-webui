# BlueNote Web UI Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after user approval.

**Goal:** Initialize `bluenote-webui` as a professional Node 18 TypeScript local web client for BlueNote, with a local Node server wrapping `@lordierclaw/bluenote-core` and a flat dark/blue web UI that preserves the core TUI workflows.

**Architecture:** A localhost-only Node server owns all filesystem/core access and exposes narrow HTTP APIs. A Vite + React browser client talks only to that local API and never reads/writes the BlueNote root directly. Core storage/search/note behavior remains delegated to `@lordierclaw/bluenote-core`; isolated web adapters are allowed only for documented core API gaps.

**Tech Stack:** Node `>=18`, npm consistently, TypeScript, Vite, React, minimal Express-style HTTP server, Vitest, ESLint/TypeScript checks, GitHub Actions on Node 18.

**Hard Gate:** Do not implement this plan until the user approves it. Do not modify `../bluenote-term` or `../bluenote-core`.

---

## Source compatibility baseline

Use `ANALYSIS.md` as the Phase 0 compatibility baseline. Key contracts:

- Notes stay plain Markdown.
- Normal notes stay under `note/`; drafts stay under `draft/`; metadata and derived indexes stay under `.data/`; archive stays under `.data/archive/`.
- Search must use core literal contains-compatible search semantics.
- AI is opt-in, background/non-blocking, and secrets must never be returned to browser clients.
- Initial server APIs should wrap `@lordierclaw/bluenote-core` where possible instead of reimplementing storage rules.

---

## Task 1: Establish Node 18 project metadata and tooling

**Objective:** Convert the existing placeholder repository into a Node 18 TypeScript project without building product features yet.

**Files:**
- Create/modify: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json` if needed
- Create: `eslint.config.js`
- Modify: `.gitignore`
- Keep: `README.md` placeholder until the README task

**Steps:**
1. Choose npm and encode it consistently with `packageManager`, `engines.node >=18`, and package scripts.
2. Add minimal dependencies:
   - runtime: `@lordierclaw/bluenote-core`, lightweight HTTP server dependency if chosen, React/Vite dependencies.
   - dev: TypeScript, ESLint, Vitest, relevant type packages.
3. Add scripts:
   - `dev`
   - `build`
   - `start` or `preview`
   - `typecheck`
   - `lint`
   - `test`
   - `check`
4. Update `.gitignore` for `node_modules`, `dist`, Vite cache, coverage, logs, env files, and local BlueNote workspaces used by tests/smoke.

**Verification:**
- Run `npm install`.
- Run `npm run typecheck` and `npm run lint`; expect initial scaffold to pass or reveal only missing source files to be addressed in Task 2.
- Run `git diff --stat` and confirm no generated junk is tracked.

**Commit:** Do not commit yet unless the task is green and self-contained; final requested public commit is `feat: initialize bluenote webui` after all verification.

---

## Task 2: Add professional source layout and shared contracts

**Objective:** Create the repository structure and typed shared API contract used by server, client, and tests.

**Files:**
- Create directories:
  - `src/server/routes/`
  - `src/server/services/`
  - `src/client/app/`
  - `src/client/components/`
  - `src/client/styles/`
  - `src/shared/`
  - `tests/`
  - `scripts/`
- Create: `src/shared/types.ts`
- Create: `src/server/index.ts`
- Create: `src/client/main.tsx`
- Create: `src/client/app/App.tsx`
- Create: `index.html`

**Steps:**
1. Define API response and domain view types in `src/shared/types.ts`:
   - health response
   - workspace status
   - note summary/detail
   - command/search result
   - AI status summary with masked/safe values only
   - API error shape
2. Add minimal server/client entrypoints that compile.
3. Add basic tests asserting shared type helpers/constants if helper code exists.

**Verification:**
- Run `npm run typecheck`.
- Run `npm run test`.

---

## Task 3: Implement local server bootstrap and safe HTTP routing shell

**Objective:** Start a localhost-only Node server and serve health/workspace-safe APIs without exposing workspace files.

**Files:**
- Modify: `src/server/index.ts`
- Create: `src/server/routes/health.ts`
- Create: `src/server/routes/workspace.ts`
- Create: `src/server/routes/notes.ts`
- Create: `src/server/services/http.ts` or equivalent minimal router helper
- Test: `tests/server-health.test.ts`

**Steps:**
1. Bind to `127.0.0.1` by default.
2. Add `GET /api/health` returning app name, status, and Node version.
3. Add JSON parsing and uniform error responses.
4. Add a deny-by-design stance: no static serving from the BlueNote workspace and no `.data` file route.
5. Keep the server testable without opening a real long-lived port, e.g. export `createServer()`.

**Verification:**
- Write tests first for `GET /api/health` and local host defaults.
- Run focused test, then `npm run test` and `npm run typecheck`.

---

## Task 4: Implement workspace service over `@lordierclaw/bluenote-core`

**Objective:** Provide workspace open/init/status behavior through core APIs.

**Files:**
- Create: `src/server/services/workspace-service.ts`
- Modify: `src/server/routes/workspace.ts`
- Test: `tests/workspace-service.test.ts`
- Optional: `src/server/services/core-adapter.ts`

**Steps:**
1. Track selected workspace root in process-local state for the running local server.
2. Implement:
   - `GET /api/workspace`
   - `POST /api/workspace/open`
   - `POST /api/workspace/init`
3. Use `createBlueNoteCore({ rootPath })` / `init` / `rebuild` as applicable.
4. Validate root path inputs as server-local paths. Do not accept browser attempts to read arbitrary hidden files.
5. Document any unavoidable initial limitation (for example process-local workspace selection) in README/implementation notes later.

**Verification:**
- Test init/open against a temp directory.
- Verify expected root folders are created by core, not by webui code.
- Run `npm run test` and `npm run typecheck`.

---

## Task 5: Implement note API service using core business logic

**Objective:** Add minimal practical note APIs without duplicating storage/search behavior.

**Files:**
- Create: `src/server/services/note-service.ts`
- Modify: `src/server/routes/notes.ts`
- Test: `tests/note-service.test.ts`

**Endpoints:**
- `GET /api/notes?folder=...&query=...`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PATCH /api/notes/:id`
- `DELETE /api/notes/:id`
- `POST /api/notes/:id/archive`
- `POST /api/rebuild`

**Steps:**
1. Use core APIs for list/get/create/delete/archive/search/rebuild.
2. For `PATCH` body-save, first inspect whether core exposes a suitable high-level update API. If no public update API exists, add a small isolated adapter using core repository helpers and document the gap; do not alter note format or layout.
3. Support draft creation and normal-note creation through core `create` options.
4. Support draft promotion if core `promoteDraft` is available; either expose via `PATCH`/action endpoint or document as planned if not wired initially.
5. Ensure errors preserve unsaved client buffers by returning failures without pretending success.

**Verification:**
- Tests create a temp BlueNote root via core, exercise all implemented endpoints/services, and inspect through core to verify results.
- Add at least one regression proving search calls core search and preserves literal contains behavior.
- Run `npm run test`, `npm run typecheck`, and `npm run lint`.

---

## Task 6: Add safe AI status surface

**Objective:** Surface opt-in AI status/queue summary only when safe, without exposing secrets or blocking UI.

**Files:**
- Create: `src/server/services/ai-service.ts`
- Create/modify: `src/server/routes/ai.ts`
- Modify: server route registration
- Test: `tests/ai-service.test.ts`

**Steps:**
1. Inspect core AI exports and use safe repositories/helpers where available.
2. Implement `GET /api/ai/status` returning one of: not-configured, auth-required, connected, running/queued summary, error.
3. Mask provider values and never return raw API keys, bearer tokens, headers, or `.data/ai/codex-auth.json` content.
4. Do not process AI queue on the request path unless proven non-blocking; initial API may be status-only.

**Verification:**
- Test not-configured status on a fresh temp root.
- Test configured-secret-like fixture is masked and not present in JSON output.
- Run `npm run test`.

---

## Task 7: Build client setup/onboarding and API client layer

**Objective:** Add browser-side API client and setup screen for opening/initializing a local workspace.

**Files:**
- Create: `src/client/app/api.ts`
- Create: `src/client/app/useWorkspace.ts` or equivalent state hook
- Create: `src/client/components/SetupScreen.tsx`
- Modify: `src/client/app/App.tsx`
- Test: client component/API tests as practical

**Steps:**
1. Build a small fetch wrapper with typed JSON responses and error handling.
2. On startup, call `GET /api/workspace`.
3. If no workspace is selected/initialized, show setup screen with local path input and Open/Initialize actions.
4. Do not ask browser to directly read directories.
5. Keep copy clear that the server runs locally and accesses local filesystem paths.

**Verification:**
- Component tests for setup state and API error display.
- Run `npm run test` and `npm run typecheck`.

---

## Task 8: Build flat dark/blue app shell and manager layout

**Objective:** Implement the required visual shell and manager/note browsing surface.

**Files:**
- Create: `src/client/styles/theme.css`
- Create: `src/client/components/AppShell.tsx`
- Create: `src/client/components/Sidebar.tsx`
- Create: `src/client/components/NoteList.tsx`
- Create: `src/client/components/PreviewPane.tsx`
- Modify: `src/client/app/App.tsx`

**Steps:**
1. Implement dark navy/near-black default theme, subtle borders, blue primary, high-contrast text.
2. Add top bar, left sidebar, main note list/manager, editor region placeholder, and right preview/details pane.
3. Hide internal BlueNote folders from UI.
4. Show folders/root sections based on API data; if empty-folder APIs are not complete, document the limitation.
5. Add preview toggle and selected note preview.

**Verification:**
- Component tests for rendering notes/folders and no internal `.data` rows.
- Run `npm run test`, `npm run lint`, `npm run typecheck`.

---

## Task 9: Implement editor, save, autosave, and dirty-state safeguards

**Objective:** Provide practical note editing with save/autosave behavior that does not lose unsaved user content.

**Files:**
- Create: `src/client/components/EditorPane.tsx`
- Create: `src/client/app/useAutosave.ts`
- Modify: `src/client/app/App.tsx`
- Test: editor/autosave tests

**Steps:**
1. Load note detail into editor body state.
2. Track dirty/saving/saved/error status.
3. Implement `Ctrl+S` and Save button.
4. Implement debounced autosave if practical; failed autosaves must keep dirty body visible and show failure status.
5. Prevent destructive note switches/deletes from silently replacing dirty buffers.
6. Add Save Draft As control if server supports promotion; otherwise show disabled/scaffolded action and document limitation.

**Verification:**
- Tests prove failed save leaves user-edited buffer intact.
- Tests prove successful save clears dirty state.
- Run `npm run test` and `npm run typecheck`.

---

## Task 10: Implement Search Everything / command palette

**Objective:** Add a `Ctrl+P` palette that searches notes and exposes common commands.

**Files:**
- Create: `src/client/components/CommandPalette.tsx`
- Create: `src/client/app/commands.ts`
- Modify: `src/client/app/App.tsx`
- Test: command palette tests

**Steps:**
1. Open/close palette with `Ctrl+P`, close with Esc.
2. Search notes through the server/core search endpoint.
3. Include command entries for supported actions: new note, quick draft, save, delete, archive, rebuild, preview toggle, setup/open workspace.
4. Include disabled/planned entries for find/replace/copy-all/replace-all only if not implemented; label clearly.
5. Enter selects a result/command; Up/Down moves focus.

**Verification:**
- Tests for keyboard open/close and command filtering.
- Test note search calls API and displays title/path/match source.
- Run `npm run test`.

---

## Task 11: Add CI, concise README, and implementation notes

**Objective:** Complete professional repository setup and concise documentation without marketing-site/docs sprawl.

**Files:**
- Create: `.github/workflows/check.yml`
- Rewrite: `README.md`
- Create only if needed: `IMPLEMENTATION_NOTES.md` (short) or add short section to README

**Steps:**
1. CI should run on Node 18, install with npm, and run `npm run check` (or explicit typecheck/lint/test/build if clearer).
2. README should cover:
   - what `bluenote-webui` is
   - relationship with `bluenote-term` and `@lordierclaw/bluenote-core`
   - Node 18 requirement
   - local setup/dev/build/check commands
   - current status/limitations
   - implemented shortcuts
3. If there are core API gaps or web/TUI behavior differences, document them briefly.
4. Keep README concise and useful; no roadmap dump or marketing language.

**Verification:**
- Run `npm run check`.
- Confirm README is concise.

---

## Task 12: Local smoke verification and final repository hygiene

**Objective:** Prove the scaffolded web UI works locally and is safe to commit/push.

**Files:**
- Optional: `scripts/smoke.mjs` or `tests/smoke.test.ts`
- Modify: `package.json` scripts if adding smoke

**Steps:**
1. Run full install/check sequence:
   - `npm install`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npm run check`
2. If practical, run a local smoke test against a temp BlueNote root:
   - start server or create in-process server
   - call health
   - init temp workspace
   - create a draft
   - list/search/get it
   - save body
3. Inspect `git status --short`, `git diff --stat`, and tracked files.
4. Confirm no secrets, generated junk, workspace `.data`, node_modules, dist, or logs are tracked.

**Verification:**
- All checks pass, or exact failures are fixed/reported without hiding them.

---

## Task 13: Commit and push to main

**Objective:** Publish the verified initialization to `main` as requested.

**Steps:**
1. Ensure current branch is `main` and remote is `origin` for `LordierClaw/bluenote-webui`.
2. Stage only intended files.
3. Commit:
   ```bash
   git add -A
   git commit -m "feat: initialize bluenote webui"
   ```
4. Push directly to `main`:
   ```bash
   git push origin main
   ```
5. Do not force push unless explicitly necessary; if unavoidable, use `--force-with-lease` only after explaining why.

**Final verification before reporting done:**
- `git status --short --branch` is clean and aligned with `origin/main`.
- Latest commit is `feat: initialize bluenote webui`.
- The final response includes real command results for install/check/build/smoke and push.
