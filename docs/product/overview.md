# BlueNote WebUI Product Overview

BlueNote WebUI is the local browser workspace for BlueNote. It preserves BlueNote’s file-first, local-first note model while presenting it through a browser-based manager/editor/preview interface backed by a local Node server.

## Product principles

- **Core-parity first:** WebUI behavior must stay faithful to `bluenote-core` note identity, folder semantics, draft promotion, search behavior, archive behavior, and AI boundaries.
- **Local-first:** the browser never becomes the source of truth; filesystem and BlueNote root mutations are owned by the local server and core.
- **Writing-first:** the editor is the calmest surface and remains focused on editing rather than management-heavy chrome.
- **Explorer-backed:** navigation should feel like a practical file explorer, not a decorative sidebar.
- **Preview as a peer:** markdown preview is a first-class companion to the editor, not a bolted-on utility sliver.
- **Search as command surface:** Search Everything is a command/search workflow, not just a tiny filter popup.
- **AI is secondary:** AI is opt-in, background-oriented, segmented, and must not displace the main writing workflow.
- **Real-browser verified:** major UX claims require screenshot-backed browser verification, not only DOM or tests.
- **WebUI design language is canonical:** UI work should follow `docs/product/design-language.md` unless a later approved design doc explicitly replaces part of it.

## Current product model

The WebUI is built around three core workspace surfaces:

- **Manager** — explorer for folders, notes, drafts, navigation history, and contextual actions.
- **Editor** — primary note-writing surface with save state, keyboard-driven flows, and minimal management chrome.
- **Preview** — markdown rendering peer to the editor.

Additional invoked surfaces:

- **Search Everything** — global search and command palette.
- **AI dialog** — status, queue, config, and auth workflow.
- **Action dialogs** — rename, move, create, save-draft-as, and related task-box interactions.

## Current delivered scope

Current WebUI behavior includes:

- local server + browser client architecture
- workspace open/init through the local server
- note browsing across `note/` and `draft/`
- note create/edit/save/archive/delete flows backed by BlueNote core behavior
- draft promotion into normal notes
- markdown preview in the preview pane
- manager navigation history and breadcrumbs
- contextual manager actions for selected notes/folders
- Search Everything via `Ctrl/Cmd+K`
- dark mode and light mode with WebUI-local theme persistence
- AI status/config/auth/queue dialog workflows
- responsive pane behavior where manager auto-hides before preview
- browser-verifiable UI shell using the local Node 16.14 toolchain

## Product constraints

- The WebUI must not invent note identity rules that diverge from `bluenote-core`.
- Draft vs normal-note semantics must stay explicit and correct through save, rename, move, archive, and startup reload paths.
- Browser UI state may assist navigation, but canonical note selection must stay compatible with BlueNote core-derived selectors.
- Search behavior should remain aligned with BlueNote’s actual search semantics rather than drifting toward decorative fuzzy-search behavior unless the core product changes.
- AI secrets and auth state must remain server-side and masked.

## Still out of scope

- hosted sync or cloud accounts
- multi-user collaboration
- browser-direct filesystem ownership
- WebUI-only storage formats
- AI-first shell redesigns that displace manager/editor/preview
- visual changes that cannot be defended from real screenshots and user POV usage

## Delivery stance

BlueNote WebUI should evolve by preserving the product model while tightening the UX. Long-lived docs should capture stable product rules, design language, architecture, and workflow; execution-specific details belong in dated plan files under `docs/plans/`.
