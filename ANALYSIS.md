# BlueNote Web UI Phase 0 Analysis

This analysis is based on local inspection of `LordierClaw/bluenote-term` and sibling `bluenote-core` sources. It is intentionally concise and implementation-oriented.

## 1. Current CLI/TUI structure

- `bluenote-term` is a Bun-first ESM workspace (`packageManager: bun@1.3.14`) with root scripts in `package.json`.
- Root CLI entrypoints:
  - root package `bin.bn` / `bin.bluenote`: `./bin/bn.ts`
  - `bin/bn.ts` imports `../packages/term/bin/bn`.
  - CLI command parser/runtime is `packages/term/src/cli/entry.ts`.
- TUI entrypoint: `packages/term/src/tui/app.ts`.
- TUI controller/state/rendering is split across:
  - `packages/term/src/tui/workspace-controller.ts`
  - `packages/term/src/tui/state.ts`
  - `packages/term/src/tui/render-manager.ts`
  - `packages/term/src/tui/render-editor.ts`
  - `packages/term/src/tui/render-search-everything.ts`
  - adapters under `packages/term/src/tui/adapters/`.
- Root package scripts include `check`, `typecheck`, `lint`, `test`, `smoke:opentui`, and `smoke:cli`. `check` runs lint, typecheck, tests, and both smoke scripts.
- `bluenote-term` consumes `@lordierclaw/bluenote-core` for business logic. CLI imports core APIs such as `initRoot`, `createNote`, `listNotes`, `showNote`, `searchNotes`, `archiveNote`, `deleteNote`, and `rebuildIndexes`. TUI also imports core storage, note mutation, AI, and index helpers.

## 2. Setup behavior

- `bn init` calls `initRoot`, which resolves the BlueNote root from override, `BLUENOTE_ROOT`, or default `~/.bluenote`.
- `initRoot` calls `ensureManagedRoot`, migrates legacy `.state` to `.data`, and writes a state manifest.
- Expected managed root layout is created by core:
  - `note/`
  - `draft/`
  - `.data/`
  - `.data/archive/`
  - `.data/notes/`
  - `.data/recovery/`
  - `.data/tmp/`
  - `.data/logs/`
  - `.data/ai/`
  - `.data/ai/prompts/`
  - `.data/ai/logs/`
- Existing local dev commands in `bluenote-term` are Bun-oriented: `bun run cli`, `bun run dev:tui`, `bun run check`, etc.
- `bluenote-core` itself targets Node `>=18` and exposes a headless `createBlueNoteCore` wrapper appropriate for the web UI server.

## 3. Storage behavior

- User notes remain plain Markdown content. Metadata is not stored as note frontmatter for current plain-note workflows.
- Normal notes live under `note/`; drafts live under `draft/`; archive lives under `.data/archive/`.
- Per-note metadata sidecars live under `.data/notes/`.
- AI state lives under `.data/ai/`, including config, prompts, queue, logs, and Codex auth state.
- Derived metadata/search files are rebuildable. Core rebuild writes `.data/metadata.sqlite` and `.data/search-index.json` from note files and sidecars.
- Web UI must call core APIs for storage and mutation instead of reconstructing these rules in browser or server code. Small web adapters are acceptable only for gaps core does not expose, and those gaps must be documented.

## 4. Search behavior

- Search is compatibility-oriented literal contains-style matching, not fuzzy search.
- Core search indexes and searches fields: `key`, `title`, `description`, `body`, and `relativePath`; contains matching also considers filename/path.
- Matching is case-insensitive after whitespace normalization. Exact/prefix/substring/contiguous-token contains matches are prioritized before falling back to MiniSearch term results.
- `searchNotes(query, { visibility })` returns matches sorted by source priority (`title`, `description`, `content`, `key/path`), then score, then path.
- Web UI search and command palette must preserve this semantic by using core `searchNotes` / `createBlueNoteCore().search.search` for note search.

## 5. TUI behavior

- Manager screen:
  - Browses notes and folders, anchored under `note/` by default.
  - Shows note/folder rows and a preview pane when enabled and wide enough.
  - Supports filtering, opening, folder navigation, create note/folder, quick draft, rename, move, delete confirmation, preview toggle, and returning to editor.
  - Shows current-open note and AI status.
- Editor screen:
  - Edits the note body with dirty/saved/autosave status.
  - Supports save, autosave, undo/redo, wrap toggle, find/replace, next/previous note, paste/copy helpers, and draft promotion (`Save Draft As`).
  - Failed saves keep the unsaved buffer visible and dirty/recoverable.
- Search Everything:
  - Global palette opened by `Ctrl+P`.
  - Searches notes/folders/paths/content and command entries.
  - Shows preview and empty-state examples/commands.
- Preview pane:
  - Manager preview can show hidden/empty/folder/note-content states.
  - Search preview can show selected result context.
- Current-open note behavior:
  - TUI records latest opened note in `.data/latest-opened-note.json` with `relativePath` and `openedAt`.
- Startup behavior:
  - Startup resolves latest-opened note if it still exists and is within TTL from `.data/config.json`.
  - Otherwise it creates a fresh draft and marks its AI description timestamp fresh.

## 6. TUI keyboard actions and web mapping

Manager actions:
- `Enter`/Right/`o`: open focused note/folder → web row click, Open button, Enter.
- Up/Down or `k`/`j`: move selection → web keyboard list navigation.
- Left/Esc: parent/back → Back button and Esc where safe.
- `/` or `Ctrl+F`: manager filter → filter input; preserve browser-friendly `Ctrl+F` carefully.
- `n`: create note/folder prompt → New button and command palette.
- `N`: quick new draft → Quick Draft button and command.
- `r`: rename → Rename action.
- `m`: move → Move action.
- `d`: delete confirmation → Delete button with confirmation.
- `p`: preview toggle → Preview toggle.
- `s`/`Ctrl+P`: Search Everything → command palette.
- `e`: show editor → focus editor/open editor pane.
- `q`: quit guarded by dirty state → web can omit quit or use close/leave guard.

Editor actions:
- `Ctrl+S`: save → save button and shortcut.
- `Alt+S`: save draft as normal note → Save Draft As action where note is draft.
- `Esc`: manager/back → focus list or close modal; avoid destructive navigation if dirty.
- `Ctrl+F`: find → can be deferred or implemented with in-editor find UI.
- `Ctrl+R`: replace → can be deferred initially.
- `Ctrl+Z`/`Ctrl+Y`: browser/editor undo/redo mostly native; document behavior.
- `Alt+Z`: wrap toggle → optional UI toggle.
- `Ctrl+PageUp/Down`: previous/next note → optional shortcut/buttons.
- Clipboard/copy/paste commands → use browser clipboard APIs where safe and permitted.

Search Everything actions:
- `Ctrl+P`: open/close palette.
- Up/Down: selection.
- Enter: open selected note/folder or run selected command.
- Esc: close.
- `Alt+P` in TUI: preview toggle; web can expose a preview toggle/button.

Commands to map to web buttons/shortcuts/palette entries: new note, quick draft, save, save draft as, rename, move, delete, archive, rebuild, copy all, paste/replace-all, find/replace placeholders, preview toggle.

## 7. AI behavior

- AI is opt-in. Config is stored under `.data/ai/config.json`; Codex auth state may include sensitive files such as `.data/ai/codex-auth.json`.
- TUI displays AI state as not configured, auth required, connected, running, updated, or error, plus queue counts/failures.
- Core exposes queue/config/provider helpers. TUI schedules AI describe work after idle/editor-manager transitions and processes the queue in the background.
- Non-blocking contract: AI setup, queueing, provider calls, and queue processing must not block startup, rendering, typing, navigation, saving, autosave, note switching, or quit.
- Web UI uses the localhost server and core public AI APIs for setup/config, status, queueing, and queue processing. OpenAI-compatible providers and Codex are supported without duplicating provider semantics in the browser.
- Note-affecting AI is queue-first: save, autosave, idle/open-note transitions, and explicit describe actions enqueue or refresh durable description work and do not call providers directly. Background drains process the queue, generate/apply descriptions, and report safe status/queue results.
- Do not expose raw provider config, bearer tokens, API keys, provider headers, Codex auth JSON, or `.data/ai/*` files to browser responses; secrets remain local and masked.

## 8. Web UI mapping

Required initial web UI:
- Setup/onboarding screen for opening or initializing a local BlueNote root.
- Local-only Node server boundary using `@lordierclaw/bluenote-core`.
- Browser app shell with top bar, folder/root sidebar, manager/note list, editor, preview/details pane, command palette.
- Note listing, filtering/search, open note, create draft/normal note, edit body, save/autosave where practical, delete/archive with confirmation, rebuild.
- Draft workflow including quick draft and draft-to-normal promotion if core API is available.
- AI setup/config, status, queue, and non-blocking queue processing via core, without exposing secrets.

Deferred or scaffolded initially:
- Full browser equivalent of TUI find/replace.
- Full move/rename/folder lifecycle if core gaps require filesystem folder adapters.
- Clipboard-heavy commands beyond browser-safe copy/paste.
- Advanced AI controls beyond safe setup/config, queue-first description handling, and non-blocking background drains.
- Exact TUI startup latest-opened behavior if it requires TUI-only state; document any initial web difference.

Browser-specific design needed:
- Filesystem root selection is a server-side local path flow, not direct browser workspace access.
- Autosave must account for HTTP failures and retain unsaved editor state client-side.
- Keyboard shortcuts must avoid surprising overrides of browser-native shortcuts.
- Local server must bind to localhost and never serve hidden `.data` files directly, including `.data/ai/*`.

## 9. Risks

- Browser filesystem access: direct File System Access API is not portable and would bypass core; use local Node server instead.
- Local server access: must bind to localhost by default, avoid arbitrary static file serving from workspace, validate path inputs, and keep `.data` private.
- Node 18 compatibility: frontend/server dependencies must support Node 18; avoid Node 20-only APIs.
- Core API gaps: folder creation/listing, latest-opened startup state, and some TUI-specific AI orchestration may not be fully represented in the high-level `createBlueNoteCore` API. Any small adapter must be isolated and documented.
- AI secret handling: browser responses must mask config and never expose `.data/ai/*`, bearer tokens, API keys, provider headers, or Codex auth JSON.
