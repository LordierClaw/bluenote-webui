# WebUI AI Parity Design

## Status

Draft for user approval. Do not implement until this design and a follow-up implementation plan are approved.

## Context

`bluenote-core` and `bluenote-term` already implement the AI feature set. The redesigned WebUI has AI routes and a dialog scaffold, but it does not yet fully match the terminal/TUI contract.

User correction for this design: **WebUI must follow BlueNote Term/TUI AI handling, where note-affecting AI work is queue-first.** WebUI actions that request description generation enqueue/refresh durable queue jobs; provider calls happen only through queue processing/background drains. Editing waits for idle before enqueueing, and opening another note queues the previous saved note immediately.

Source of truth for behavior:

- `bluenote-core`: AI config, prompt, queue, provider, description, logs, redaction, and sidecar semantics.
- `bluenote-term`: client UX reference for setup/config/status/auth/queue commands and TUI queue-first idle handling.
- `bluenote-webui`: local browser UI and localhost server presentation only.

## Existing core AI contract

Core stores AI state under the managed root:

```text
.data/ai/
  config.json
  prompts/describe-note.md
  queue.json
  logs/
  codex-auth.json
```

Important public APIs already exported by `@lordierclaw/bluenote-core`:

- `createAiConfigRepository(rootPath)` reads/writes validated config.
- `maskApiKey(value)` masks OpenAI-compatible API keys for display.
- `createAiQueueRepository(rootPath)` reads/writes locked queue state.
- `enqueueDescribeNoteJob(...)`, `enqueueDescribeNoteIfAiEnabled(...)`, `listPendingAiJobs(...)`, `listRetryableAiJobs(...)`, and related mutation helpers manage `describe-note` jobs.
- `ensureDescribeNotePrompt(...)` / `readDescribeNotePrompt(...)` create and hash the editable prompt file.
- `createAiTextGenerationClient(config, options)` creates OpenAI-compatible or Codex clients.
- `generateNoteDescription(...)` validates provider output, protects against stale note updates, auto-applies the description to the sidecar, removes matching queue jobs, rebuilds indexes, and writes configured logs.
- `createCodexAuthRepository(...)` and `createCodexAuthClient(...)` manage Codex device-code auth and token refresh.
- `sanitizeAiErrorMessage(...)` and Codex-specific redaction helpers keep provider/auth secrets out of user-facing errors.

Config schema:

- Providers: `openai-compatible` or `codex`.
- Shared fields: `version: 1`, `enabled`, `model`, `logging`, `maxAttempts`, `outputLanguage`.
- OpenAI-compatible additionally requires `baseUrl` and `apiKey`.
- Codex uses stored `.data/ai/codex-auth.json` instead of an API key.

Queue semantics:

- Jobs are currently `kind: "describe-note"`.
- Jobs include key, relative path, content hash, prompt hash, status, attempts, last error, and timestamps.
- Queue processing retries pending/failed jobs while attempts are below `maxAttempts`.
- Deleted-note jobs are dropped without provider calls.
- Codex setup/auth blockers preserve queued work and do not consume attempts.

Description generation semantics:

- Provider output is auto-applied only after validation.
- Note Markdown remains plain and unchanged.
- Sidecar `description` and `ai.description.lastProcessedAt` are updated.
- Search indexes are rebuilt after a successful apply.
- If the note changes during generation, stale output is rejected and the note remains unchanged.
- In WebUI, note actions should not call `generateNoteDescription` directly. They should enqueue/refresh durable work, then trigger queue processing where appropriate.

## Existing terminal reference UX

`bn ai` CLI supports:

- `config set` for OpenAI-compatible and Codex.
- `config show` with masked API key and no raw secrets.
- `codex auth login/status/logout`.
- `describe <key|path>` to immediately generate and apply a description.
- `queue` to list pending jobs.
- `process-queue [--limit <n>]` to process retryable queued jobs and summarize applied/failed/remaining counts.

The terminal **TUI** reference behavior is queue-first for note-affecting AI work:

- `enqueueNote(selector)` reads the current note and calls core `enqueueDescribeNoteIfAiEnabled`.
- Saved editor changes schedule AI idle work only after successful persistence.
- Editor context uses a 10 second idle delay.
- Manager context uses a 5 second idle delay.
- Opening another note while an idle enqueue is pending immediately queues the previous saved note before switching.
- Enqueue failures never roll back note persistence.
- After enqueueing, TUI starts queue processing in the background when a processor is available.
- If queue processing is already in flight, TUI records that a follow-up drain should run after the current processor finishes.
- TUI AI status states include not configured, auth required, connected, running, updated, and error, with queue counts/failures. Normal note save/autosave/navigation remains non-blocking.

## Current WebUI gaps

The redesigned WebUI already has AI API routes and a tabbed `AiWorkspaceDialog`, but inspection found these likely gaps:

1. Saving an existing OpenAI-compatible config without retyping the API key can send `apiKey: undefined`; core validation requires a real string, so WebUI must preserve the existing secret server-side when the field is left blank.
2. WebUI create/save currently disables AI enqueueing (`enqueueAi: false`) and does not enqueue stale description refreshes after note content/title changes.
3. The queue button labeled “Queue describe” calls immediate generation instead of enqueueing work.
4. Codex auth can start a device flow but does not complete/poll the login flow like terminal `bn ai codex auth login`.
5. WebUI status and queue surfaces exist but need stricter parity for auth-required/setup-blocked/error states.
6. WebUI tests cover only shallow config/status routing; they do not prove queue-first description handling, queue processing, secret preservation/redaction, stale-result safety, idle/open-note enqueue timing, or Codex setup-block preservation.
7. README still says AI is status-only, which will become stale after implementation.

## Recommended approach

Use **full WebUI parity with the terminal TUI queue-first model now**, while keeping core as the behavioral owner.

WebUI should add local-server API and browser UX around the existing core functionality, not reimplement AI logic in the browser. Note-affecting AI actions should enqueue durable `describe-note` jobs first; provider processing should be a queue-drain/background-processing concern.

Rejected alternatives:

1. **OpenAI-compatible first only** — simpler, but inconsistent with the user’s explicit choice and with completed core/term Codex work.
2. **Status/config only** — safest surface, but preserves the placeholder gap and does not meet the feature request.
3. **Immediate describe actions in WebUI** — closer to CLI `bn ai describe`, but rejected by the user for WebUI. WebUI should follow TUI queue-first behavior instead.

## Architecture

### Server responsibilities

The WebUI server owns safe HTTP façades:

- workspace root lookup and validation,
- config form normalization,
- preserving existing secrets when the browser submits a blank OpenAI-compatible API key,
- calling core AI repositories/services,
- returning masked/safe views only,
- converting core/UsageError failures into safe HTTP errors,
- exposing enqueue-only APIs for note-affecting AI actions,
- processing queued jobs through core provider/generation helpers,
- managing Codex device auth polling/completion without exposing tokens.

The server must never return:

- raw API keys,
- bearer tokens,
- Codex access/refresh/id tokens,
- `.data/ai/codex-auth.json`,
- provider request headers,
- unredacted provider/auth errors.

### Browser responsibilities

The browser owns presentation and user interaction:

- topbar AI status indicator,
- AI dialog status/config/queue/auth tabs,
- OpenAI-compatible and Codex setup forms,
- plaintext API-key warning copy,
- device-code auth progress,
- queue controls,
- enqueue-current-note action,
- idle/open-note scheduling that matches TUI delays,
- visible success/failure messages.

The browser must not infer or reconstruct core storage semantics.

### Core responsibilities

No core changes are expected initially. If WebUI needs a missing capability, add a public core API only after a specific plan task identifies the gap.

## Proposed API surface

Reuse existing routes where practical and add narrow routes only where needed.

Existing routes to keep/refine:

- `GET /api/ai/status`
- `GET /api/ai/config`
- `POST /api/ai/config`
- `GET /api/ai/queue`
- `POST /api/ai/process-queue`
- `GET /api/ai/codex-auth/status`
- `POST /api/ai/codex-auth/start`
- `DELETE /api/ai/codex-auth`

Route changes/additions:

- Replace or narrow `POST /api/ai/describe` before implementation. It must not remain a direct provider-call action for WebUI note actions.
- Add `POST /api/ai/queue/describe` to enqueue the current note for description refresh without provider calls.
- Keep `POST /api/ai/process-queue` as the only WebUI route that invokes providers for note descriptions, operating on durable queued jobs.
- Add `POST /api/ai/codex-auth/poll` or equivalent to poll/complete the active device flow and persist auth when complete.

Server returned views should include only safe state:

- masked OpenAI-compatible API key,
- provider/model/enabled/output language/max attempts/logging flags,
- queue job kind/key/relativePath/status/attempts/lastError/updatedAt,
- Codex auth state/hint/expiry/issuer without tokens.

## Config design

OpenAI-compatible setup form:

- Fields: enabled, base URL, API key, model, max attempts, output language, logging flags.
- When editing existing OpenAI-compatible config, an empty API-key input means “keep existing key.”
- If no existing key exists, API key is required.
- Successful save returns masked config and displays the plaintext local-storage warning.

Codex setup form:

- Fields: enabled, model, max attempts, output language, logging flags.
- Save writes Codex provider config without OpenAI-compatible secrets.
- Auth tab handles login/status/logout.

## Codex auth design

The WebUI should match terminal device-code auth using core auth helpers:

1. User saves Codex config.
2. User starts auth.
3. Server starts device flow and returns verification URL, user code, and poll interval.
4. Browser displays the URL/code and polls the server.
5. Server polls/completes through the core Codex auth client and writes auth using the core repository.
6. Browser refreshes safe auth/status views.

The browser never receives access tokens or refresh tokens.

If auth expires or setup is missing, status should show `auth-required` and queue processing should preserve jobs without consuming attempts.

## Queue-first description design

Supported actions:

- **Queue current note:** enqueue/refresh `describe-note` work without provider call.
- **Generate descriptions:** process queued work. The queue processor calls core `generateNoteDescription` for queued jobs, auto-applies valid output, refreshes note/list/search/AI status, and preserves core stale-result safety.
- **Process queue:** process retryable jobs using core generation logic and report applied/failed/remaining/setup-blocked.

There should not be a WebUI “describe now” direct-provider path for note actions. A user-clicked AI describe action should enqueue the current saved note first, then optionally kick a background queue drain.

After save/title changes, mirror the terminal TUI timing model:

- Preserve normal save/autosave responsiveness.
- Save/autosave never calls a provider.
- After successful persistence, compare the submitted body/title against the prior saved snapshot to decide whether AI work is needed.
- If the saved note changed and AI config exists/enabled, schedule enqueue work rather than immediately enqueueing on the hot save path.
- Editor context delay: 10 seconds idle after a saved edit.
- Manager context delay: 5 seconds idle after leaving editor or after a save completes while the user is in manager context.
- Opening another note while a saved note has pending idle AI work should enqueue the previous note immediately before switching.
- Continued editing resets the editor idle timer.
- Manager navigation/activity resets the manager idle timer when there is pending AI idle work.
- Queue/enqueue failures should not roll back note saves; they should be surfaced as AI status/notice only.
- After an enqueue succeeds, WebUI may start queue processing in the background without awaiting provider completion from input/save/navigation handlers.
- If queue processing is already in flight, record that a follow-up drain is needed so jobs created during provider work do not remain pending forever.

Implementation should align with term/core semantics:

- one active describe job per note,
- prompt hash included,
- content hash refreshes reset attempts when work changed,
- deleted jobs dropped during processing,
- stale provider results rejected by core.

## Error handling and redaction

- Use core redaction helpers for all provider/auth errors.
- Redact configured OpenAI-compatible API key in addition to generic bearer/JWT-like tokens.
- Return HTTP errors with safe messages and optional hints.
- Queue processing should mirror terminal/TUI behavior:
  - provider failures mark matching jobs failed,
  - invalid output marks matching jobs failed,
  - stale results leave refreshed jobs pending when applicable,
  - Codex setup/auth blockers preserve work and return `setupBlocked: true`.

## Testing strategy

TDD tasks should add focused failing tests before implementation.

Server tests:

- Config save/show masks secrets and preserves an existing OpenAI-compatible key when the browser leaves the key field blank.
- Invalid config returns safe HTTP errors.
- Codex config writes no OpenAI-compatible secret fields.
- Codex auth start/poll/status/logout never exposes tokens.
- Enqueue current note creates/refreshed a durable `describe-note` job and does not call a provider.
- Processing the queue with an injected/fake provider updates sidecar description, leaves Markdown unchanged, removes queue job, rebuilds indexes, and refreshes search/list behavior.
- Provider error responses are redacted.
- Processing queue applies valid jobs, marks invalid/provider failures, drops deleted-note jobs, and preserves jobs on Codex setup blockers.
- Save/update schedules stale description refresh when AI is enabled, without provider calls or save rollback.
- Editor idle fires after 10 seconds and enqueues exactly one latest-content job.
- Manager idle fires after 5 seconds when save completes in manager context or after leaving editor.
- Opening another note while a saved note has pending AI idle work enqueues the previous note immediately before switching.
- If an enqueue finishes while queue processing is in flight, a follow-up drain is requested.

Client tests:

- Dialog renders status/config/queue/auth tabs with safe values.
- Saving OpenAI-compatible config with blank key indicates “keep existing key” and does not expose the secret.
- Queue-current-note and run-queue buttons call the correct API routes and refresh data.
- Note edits schedule the WebUI idle enqueue timer only after successful save/autosave.
- Switching to another note flushes pending saved-note AI work immediately before opening the next note.
- Codex auth flow displays verification URL/user code and polls/completes status safely.
- Topbar status reflects not configured/auth required/connected/running/queued/failed states.

Verification commands after implementation:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

Also run a real local smoke against a temp BlueNote root where practical, with fake/mock provider paths for automated tests and no committed secrets.

## Documentation updates

Update current-facing docs when implementation lands:

- `README.md` current status/limitations should no longer say AI is status-only.
- `ANALYSIS.md` should describe the implemented WebUI AI parity instead of the initial placeholder/status-only posture.
- Any architecture docs mentioning AI status-only behavior should be aligned.

## Open questions

None for the chosen scope. The approved target is full WebUI parity with the existing core/term AI feature set, using core APIs for functionality, and following the terminal TUI queue-first handling for note-affecting AI work.
