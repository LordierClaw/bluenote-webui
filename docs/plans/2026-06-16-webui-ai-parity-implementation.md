# WebUI AI Parity Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement. Do not commit or push unless the parent session/user explicitly authorizes commits.

**Goal:** Implement full WebUI AI parity with BlueNote Term/TUI queue-first handling: setup/config, Codex auth, enqueue-first description generation, idle/open-note queue scheduling, queue processing, safe status, and documentation alignment.

**Architecture:** `bluenote-webui` remains a local browser client with a localhost Node server. The server exposes safe HTTP façades over public `@lordierclaw/bluenote-core` AI APIs and never returns secrets. The browser owns presentation/timers while all storage/provider/queue semantics stay in core.

**Approved design:** `docs/plans/2026-06-16-webui-ai-parity-design.md`

**Tech Stack:** Node 16.14-compatible TypeScript, React 18, Vite, Vitest, ESLint, `@lordierclaw/bluenote-core` public exports.

**Global constraints:**

- Do not implement direct WebUI “describe now” provider calls for note actions.
- Any note-affecting AI action must enqueue/refresh durable `describe-note` work first.
- Provider calls happen only from queue processing/background drains.
- Save/autosave/open-note flows must not block on provider calls.
- Never return raw OpenAI API keys, Codex tokens, bearer tokens, provider headers, or auth JSON to the browser.
- Use `patch` for existing files and `write_file` for new files.
- Parent-session verification is mandatory after any subagent edits.
- Commit steps in this document are checkpoints only; actual `git commit` requires explicit user permission.

---

## Task 1: Server config save parity and secret preservation

**Files:**

- Modify: `src/server/services/ai-service.ts`
- Modify: `tests/ai-service.test.ts`
- Modify: `tests/server-ai-routes.test.ts`

**Purpose:** Make WebUI config save match terminal config semantics, including preserving an existing OpenAI-compatible secret when the browser leaves the API key blank and never exposing secrets in responses.

**Step 1: Write failing tests**

Add service/route tests that prove:

- Fresh OpenAI-compatible config requires a non-empty API key.
- Existing OpenAI-compatible config keeps the stored API key when save input omits `apiKey` or sends `""`.
- Switching to Codex writes no `apiKey`/`baseUrl` fields.
- `GET /api/ai/config` and `POST /api/ai/config` responses never contain the raw key.
- Invalid config returns a safe structured API error.

Suggested test cases:

```ts
test("saveAiConfig preserves an existing OpenAI-compatible API key when the browser leaves it blank", async () => {
  const root = await setupRoot()
  createAiConfigRepository(root).write({
    version: 1,
    enabled: true,
    provider: "openai-compatible",
    baseUrl: "https://old.example/v1",
    apiKey: "secret-token-value",
    model: "old-model",
    logging: { usage: true, conversations: false, results: true },
    maxAttempts: 3,
    outputLanguage: "English",
  })

  const saved = saveAiConfig({
    version: 1,
    enabled: true,
    provider: "openai-compatible",
    baseUrl: "https://new.example/v1",
    apiKey: "",
    model: "new-model",
    logging: { usage: true, conversations: false, results: true },
    maxAttempts: 5,
    outputLanguage: "日本語",
  })

  expect(JSON.stringify(saved)).not.toContain("secret-token-value")
  expect(saved).toMatchObject({ configured: true, provider: "openai-compatible", model: "new-model" })
  expect(createAiConfigRepository(root).read()).toMatchObject({
    provider: "openai-compatible",
    baseUrl: "https://new.example/v1",
    apiKey: "secret-token-value",
    model: "new-model",
    maxAttempts: 5,
    outputLanguage: "日本語",
  })
})
```

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: FAIL because blank/missing API key is currently passed through to core validation or not normalized as “keep existing”.

**Step 3: Implement minimal server normalization**

In `src/server/services/ai-service.ts`:

- Add a small input-normalization helper for `saveAiConfig(input)`.
- Read existing config before writing.
- If provider is `openai-compatible` and input `apiKey` is missing/blank:
  - reuse existing OpenAI-compatible `apiKey` if available;
  - otherwise throw a safe validation error.
- If provider is `codex`, build a Codex config shape and drop OpenAI-compatible secret fields.
- Keep using core `createAiConfigRepository(...).write(...)` for validation and persistence.
- Return only `toConfigView(repository.read())`.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- src/server/services/ai-service.ts tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Do not commit unless authorized.

---

## Task 2: Server enqueue-only AI action and queue processing parity

**Files:**

- Modify: `src/server/services/ai-service.ts`
- Modify: `src/server/routes/ai.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/client/app/api.ts`
- Modify: `tests/ai-service.test.ts`
- Modify: `tests/server-ai-routes.test.ts`

**Purpose:** Replace WebUI note-action description generation with enqueue-only behavior; keep provider calls only in queue processing.

**Step 1: Write failing tests**

Add tests proving:

- `POST /api/ai/queue/describe` enqueues a `describe-note` job for a selected note and does not call a provider.
- Repeated enqueue refreshes one job rather than creating duplicates.
- `POST /api/ai/describe` is either removed or behaves as enqueue-only; it must not call `generateNoteDescription` directly.
- `processAiQueue` still applies valid queued jobs with a fake/injected client seam or existing service seam.

If direct provider injection is not currently available in WebUI service tests, first introduce a narrow test-only/runtime injection seam in this task and keep it server-only.

Suggested assertions:

```ts
expect(queue.jobs).toHaveLength(1)
expect(queue.jobs[0]).toMatchObject({ kind: "describe-note", key, status: "pending", attempts: 0 })
expect(providerCalls).toBe(0)
```

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: FAIL because current `describeNoteWithAi` calls provider generation directly.

**Step 3: Implement enqueue route/service**

In `src/server/services/ai-service.ts`:

- Add `enqueueNoteDescription(request)`.
- Validate `selector`.
- Require workspace root.
- Select/read the note via core public APIs or existing note service shape.
- Use core prompt/enqueue helpers (`enqueueDescribeNoteIfAiEnabled` where practical) so prompt hash/content hash semantics stay in core.
- Return a safe result: key, relativePath, enqueued boolean, and queue summary.
- Remove or narrow `describeNoteWithAi` so WebUI note actions cannot directly generate.

In `src/server/routes/ai.ts`:

- Add `POST /api/ai/queue/describe`.
- Stop wiring note action UI to direct provider describe.

In `src/shared/types.ts` and `src/client/app/api.ts`:

- Add request/response types and `api.aiQueueDescribe(...)`.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- src/server/services/ai-service.ts src/server/routes/ai.ts src/shared/types.ts src/client/app/api.ts tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Do not commit unless authorized.

---

## Task 3: Queue processor setup-block, deleted-job, failure, and redaction parity

**Files:**

- Modify: `src/server/services/ai-service.ts`
- Modify: `tests/ai-service.test.ts`
- Modify: `tests/server-ai-routes.test.ts`

**Purpose:** Make WebUI queue processing match term/core behavior for Codex setup blockers, deleted jobs, provider failures, invalid output, stale output, and redaction.

**Step 1: Write failing tests**

Add tests proving:

- Deleted-note queued jobs are removed without provider calls.
- Codex setup/auth required preserves queued work, does not increment attempts, and returns `setupBlocked: true`.
- Provider errors are redacted using configured API key plus generic bearer/JWT-like patterns.
- Invalid provider output marks the matching job failed.
- Successful provider output updates sidecar description, leaves Markdown unchanged, removes queue job, and updates search/list after rebuild.

Suggested redaction assertion:

```ts
expect(JSON.stringify(result)).not.toContain("test-token-secret")
expect(JSON.stringify(queueAfter)).not.toContain("Bearer abc.def.ghi")
```

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: FAIL for any parity gaps or missing injection seams.

**Step 3: Implement processing parity**

In `processAiQueue`:

- Keep provider calls only inside queue processing.
- Call `dropDescribeNoteJobIfNoteMissing` before creating provider clients when possible.
- Preserve setup-blocked jobs on Codex provider setup/auth errors.
- Mark matching jobs failed with sanitized errors for provider/invalid-output failures.
- Return applied/failed/remaining/setupBlocked counts.
- Refresh status/queue summary safely.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- src/server/services/ai-service.ts tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Do not commit unless authorized.

---

## Task 4: Codex device-code auth completion in WebUI

**Files:**

- Modify: `src/server/services/ai-service.ts`
- Modify: `src/server/routes/ai.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/client/app/api.ts`
- Modify: `src/client/components/AiWorkspaceDialog.tsx`
- Modify: `tests/server-ai-routes.test.ts`
- Modify: `tests/ai-service.test.ts`

**Purpose:** Complete Codex auth parity without exposing tokens to the browser.

**Step 1: Write failing tests**

Add tests proving:

- `POST /api/ai/codex-auth/start` returns verification URL/user code/interval and no token-looking values.
- `POST /api/ai/codex-auth/poll` or equivalent completes auth using fake Codex responses and persists auth server-side.
- `GET /api/ai/codex-auth/status` returns authenticated/expired/invalid/setup-required states without tokens.
- `DELETE /api/ai/codex-auth` removes auth and keeps AI config.

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: FAIL because WebUI currently starts a flow but does not complete/poll it.

**Step 3: Implement server auth polling and client UI**

Server:

- Add a safe pending-device-flow mechanism scoped to the current local server process/workspace.
- Use core Codex auth client/repository to complete polling and write auth.
- Return only safe auth status/flow progress.

Client:

- Replace the placeholder device-code input with displayed verification URL and user code.
- Poll using the returned interval until complete/error/cancel/close.
- Refresh AI auth/status after completion.
- Keep logout behavior safe.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- src/server/services/ai-service.ts src/server/routes/ai.ts src/shared/types.ts src/client/app/api.ts src/client/components/AiWorkspaceDialog.tsx tests/server-ai-routes.test.ts tests/ai-service.test.ts
```

Do not commit unless authorized.

---

## Task 5: Browser queue-first controls and status refresh

**Files:**

- Modify: `src/client/app/App.tsx`
- Modify: `src/client/components/AiWorkspaceDialog.tsx`
- Modify: `src/client/components/AppShell.tsx`
- Modify: `tests/client-shell-layout.test.tsx`
- Create or modify: `tests/client-ai-dialog.test.tsx`

**Purpose:** Wire browser UI actions to enqueue-first and queue-processing routes, and make topbar/dialog status reflect queue state.

**Step 1: Write failing client tests**

Add tests proving:

- The AI dialog button for current note calls `api.aiQueueDescribe`, not `api.aiDescribe`.
- Running queued jobs calls `api.aiProcessQueue`.
- Notices say “Queued” for enqueue actions and summarize applied/failed/remaining for process queue.
- Topbar status displays queued/failed/running/auth-required states safely.
- No raw API key appears in rendered config UI.

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/client-shell-layout.test.tsx tests/client-ai-dialog.test.tsx
```

Expected: FAIL until UI wiring is updated.

**Step 3: Implement UI wiring**

In `App.tsx`:

- Replace `describeCurrentNoteWithAi` direct route call with enqueue-first route.
- Refresh workspace/AI data after enqueue/process.
- Keep selected note stable after queue operations.

In `AiWorkspaceDialog.tsx`:

- Rename visible action copy from direct “describe” to queue-first language where needed.
- Keep “Run queued jobs” as explicit queue processing.
- Show setup-blocked/auth-required notices.

In `AppShell.tsx`:

- Ensure status summarization prioritizes running/queued/failed/auth-required and stays concise.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/client-shell-layout.test.tsx tests/client-ai-dialog.test.tsx
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- src/client/app/App.tsx src/client/components/AiWorkspaceDialog.tsx src/client/components/AppShell.tsx tests/client-shell-layout.test.tsx tests/client-ai-dialog.test.tsx
```

Do not commit unless authorized.

---

## Task 6: WebUI idle/open-note AI scheduling

**Files:**

- Modify: `src/client/app/App.tsx`
- Create or modify: `tests/client-ai-idle-queue.test.tsx`
- Modify if useful: `src/client/app/useAutosave.ts`

**Purpose:** Match terminal TUI idle scheduling: enqueue after saved edits with 10s editor idle, 5s manager idle, and immediate enqueue before opening another note.

**Step 1: Write failing tests with fake timers**

Add tests proving:

- Save/autosave completion schedules an AI enqueue timer only after successful save.
- Editor context uses 10,000ms.
- Manager context uses 5,000ms.
- Continued edits reset the timer and enqueue exactly one latest note job.
- Opening another note while there is pending saved-note AI work immediately flushes/enqueues the previous note before selecting the next note.
- Save failures do not enqueue.
- Enqueue failure does not roll back save state.

Suggested test style:

```ts
vi.useFakeTimers()
// edit note, save succeeds
expect(api.aiQueueDescribe).not.toHaveBeenCalled()
await vi.advanceTimersByTimeAsync(9_999)
expect(api.aiQueueDescribe).not.toHaveBeenCalled()
await vi.advanceTimersByTimeAsync(1)
expect(api.aiQueueDescribe).toHaveBeenCalledWith({ selector: "current-key" })
```

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/client-ai-idle-queue.test.tsx
```

Expected: FAIL because WebUI does not yet have TUI-style AI idle scheduling.

**Step 3: Implement scheduling**

In `App.tsx` or a small local hook:

- Track pending saved-note selector for AI enqueue.
- Track pre-save saved body/title snapshots so changed-content detection is not fooled by persisted response body matching submitted body.
- Schedule enqueue after successful save only.
- Use 10s delay in editor context and 5s delay in manager context.
- Flush pending AI work before opening a different note.
- Clear timers on unmount/workspace close.
- After enqueue succeeds, kick queue processing in background if appropriate and handle follow-up drain if processing is already in flight.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/client-ai-idle-queue.test.tsx
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- src/client/app/App.tsx src/client/app/useAutosave.ts tests/client-ai-idle-queue.test.tsx
```

Do not commit unless authorized.

---

## Task 7: Server/client integration smoke for queue-first workflow

**Files:**

- Modify: `tests/smoke.test.ts`
- Modify: `tests/server-ai-routes.test.ts`
- Modify as needed: `src/server/services/ai-service.ts`

**Purpose:** Prove a real local server flow initializes a workspace, configures AI, edits/saves/enqueues, processes queue, updates sidecars/indexes, and never exposes secrets.

**Step 1: Write failing smoke/integration tests**

Add or extend smoke tests to exercise:

1. Start real `createServer()`.
2. Initialize temp workspace.
3. Create a note.
4. Save AI config.
5. Enqueue description via `/api/ai/queue/describe`.
6. Process queue using fake provider seam.
7. Fetch note/list/search and verify updated description.
8. Verify Markdown body unchanged.
9. Verify response bodies do not contain raw API key.

**Step 2: Run tests — confirm failure**

Command:

```bash
npm run test -- tests/smoke.test.ts tests/server-ai-routes.test.ts
```

Expected: FAIL until all integration seams and routes are complete.

**Step 3: Implement missing integration fixes**

- Wire any missing test-only provider injection safely.
- Ensure process queue rebuilds indexes and responses return current status.
- Ensure HTTP errors are structured and safe.

**Step 4: Run tests — confirm pass**

Command:

```bash
npm run test -- tests/smoke.test.ts tests/server-ai-routes.test.ts
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- tests/smoke.test.ts tests/server-ai-routes.test.ts src/server/services/ai-service.ts
```

Do not commit unless authorized.

---

## Task 8: Documentation alignment

**Files:**

- Modify: `README.md`
- Modify: `ANALYSIS.md`
- Modify if stale: `docs/architecture/core-parity-and-shell-model.md`
- Modify if stale: `docs/workflow/verification.md`
- Test: existing docs/help tests if present, otherwise `npm run lint` / `npm run typecheck`

**Purpose:** Align current-facing docs with queue-first WebUI AI parity and remove status-only placeholder language.

**Step 1: Write failing docs guard if practical**

If the repo has a docs-contract test pattern, add assertions that:

- README no longer says AI is status-only.
- README mentions queue-first AI description handling.
- Docs mention secrets are masked and `.data/ai/*` is not served to browsers.

If no docs-contract pattern exists, proceed with manual docs diff plus lint/typecheck verification.

**Step 2: Run check — confirm failure/stale wording**

Command:

```bash
npm run test -- --runInBand
```

If Vitest does not support `--runInBand` in this repo, use:

```bash
npm run test
```

Expected: Existing tests may pass, but manual search should find stale status-only wording.

**Step 3: Update docs**

Update current-facing docs to state:

- WebUI uses localhost server and core public APIs for AI.
- AI setup/config supports OpenAI-compatible and Codex.
- Note-affecting AI is queue-first.
- Save/autosave/open-note flows do not call providers directly.
- Queue processing/background drains generate/apply descriptions.
- Secrets remain local and masked in browser responses.

**Step 4: Verify docs**

Commands:

```bash
npm run lint
npm run typecheck
```

Expected: PASS.

**Step 5: Checkpoint**

Run:

```bash
git status --short
git diff -- README.md ANALYSIS.md docs/architecture/core-parity-and-shell-model.md docs/workflow/verification.md
```

Do not commit unless authorized.

---

## Task 9: Full verification and final review prep

**Files:**

- No planned source changes unless verification reveals regressions.

**Purpose:** Verify the complete implementation and prepare for independent review/next execution stage.

**Step 1: Run focused tests**

Commands:

```bash
npm run test -- tests/ai-service.test.ts tests/server-ai-routes.test.ts tests/client-ai-dialog.test.tsx tests/client-ai-idle-queue.test.tsx tests/smoke.test.ts
```

Expected: PASS.

**Step 2: Run full gate**

Command:

```bash
npm run check
```

Expected: PASS.

If full gate fails, classify failures:

- Current-task regressions or adjacent contract drift: fix now with TDD.
- Pre-existing unrelated debt: document exact command/error and ask user before broadening scope.

**Step 3: Inspect diff and secrets**

Commands:

```bash
git status --short
git diff --check
git diff
```

Expected:

- No whitespace errors.
- No raw test secrets in docs beyond deterministic fake tokens used only in tests.
- No generated files, `.data`, temp roots, `node_modules`, build outputs, or local logs staged.

**Step 4: Parent-session review loop**

Dispatch two reviews before sign-off:

- Spec review: compare implementation against `docs/plans/2026-06-16-webui-ai-parity-design.md` and this plan.
- Code-quality review: check maintainability, secret handling, async lifecycle, Node 16.14 compatibility, and test quality.

Fix any blockers with focused tests before reporting done.

**Step 5: Final handoff**

Report:

- Files changed.
- Checks run and exact results.
- Any unresolved follow-ups.
- Whether working tree is clean or contains uncommitted approved changes.

Do not commit/push unless authorized.
