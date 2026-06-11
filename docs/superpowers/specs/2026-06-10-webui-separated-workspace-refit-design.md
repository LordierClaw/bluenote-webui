# BlueNote WebUI Separated Workspace Refit Design

**Date:** 2026-06-10
**Status:** approved direction from user follow-up
**Supersedes:** portions of `2026-06-10-webui-vscode-obsidian-ux-overhaul-design.md`

## Goal

Refit the BlueNote WebUI into a strict three-surface workspace:

1. **Manager** — a fast, file-manager-like navigator for folders and notes
2. **Editor** — a plain, focused writing surface with editor-style status feedback
3. **Preview** — a markdown-first preview surface

AI should remain a **background workflow**, not a first-class writing pane. Users should be able to:
- inspect queue/running/failed/completed job state
- inspect useful output/status
- launch/configure AI via BlueNote core-compatible flows
- avoid having AI compete visually with editor/preview as a primary pane

## Product-level direction

The current redesign drifted too far toward a blended product shell. The user wants stronger role separation:
- manager should behave like a compact file manager
- editor should feel like a normal editor, not a dashboard
- preview should mainly render markdown
- AI should read like a background operations/status system

This means the remaining work should optimize for **clarity, speed, and separation**, not for “rich utility integration” inside every surface.

## Surface definitions

### 1) Manager surface

The left side should behave like a file manager / note explorer.

Required behavior:
- a **single unified explorer surface** for both folders and notes
- folders should appear first, then notes, inside the same explorer flow
- no separate manager layout/cards for “folders view” versus “notes view”
- fast scanability of folders and notes
- easiest possible open/select flow
- clear distinction between folder / normal note / draft note by icon
- note row shows title, filename/path, and description when useful
- CRUD and quick actions should be near the manager, not hidden in unrelated editor UI
- back/forward navigation must stay easy (clickable and shortcut-driven)
- search/filter should be **hidden by default** and opened from a dedicated control in the manager header
- when opened, search behaves like a local explorer filter/jump affordance rather than a permanently exposed field

The manager is responsible for navigation and item operations. It should not feel like a secondary info panel.

### 2) Editor surface

The center surface should be plain and focused.

Required behavior:
- content-first textarea/editor
- keep note title + minimal metadata where needed
- clear save/dirty state
- status bar with editor-style details such as:
  - line
  - column
  - wrap state
  - note type / mode as appropriate
- command clutter should be reduced compared to the current grouped-card treatment if that treatment interrupts writing focus

The editor should feel closer to a normal local editor than a web dashboard.

### 3) Preview surface

The right surface should mainly be markdown preview.

Required behavior:
- render markdown cleanly
- preserve plain preview reading mode
- not compete with AI/status concepts for the same visual identity
- when preview is hidden/collapsed responsively, user must still be able to re-open it quickly

### 4) AI surface / workflow

AI remains important, but not as a permanent peer surface beside the editor and preview.

Required behavior:
- AI runs in background-oriented flows
- user can inspect current queue / running / failed / output / status
- user can open AI controls/status from a dedicated utility area or dialog
- config changes should remain core-faithful (`bluenote-core`) rather than inventing a misleading web-only config model
- AI status should not visually dominate the writing workflow

## Layout implications

The shell should preserve three separable regions:
- manager
- editor
- preview

But the UI language should clarify their roles:
- **manager** = explorer/file browser
- **editor** = writing tool
- **preview** = render target

The prior “utility pane” idea should be softened or narrowed so it does not dissolve the preview into a generic right rail. Preview must remain legible as a dedicated markdown preview surface.

## Interaction rules

### Manager interactions
- single-click should be enough for the common open/select behavior
- keyboard shortcuts for back/forward should remain
- quick actions should be discoverable and near their object of action
- folder/note creation should feel local to the manager

### Editor interactions
- save and note actions should remain accessible, but should not overwhelm the writing surface
- status information belongs in an editor-style footer/status area more than in large cards

### Preview interactions
- preview toggle stays available
- preview content should be calm and readable

### AI interactions
- open via explicit AI/status control
- inspect queue/running/failed and output details
- close without disrupting editor focus

## Implementation consequences

The remaining implementation should:
- revise the manager to be more file-manager-like even if some Task 4 work must be adjusted
- revise the editor header/action treatment from “grouped command cards” toward a more editor-native surface
- preserve markdown preview as a dedicated right pane
- move AI emphasis toward a background status/config workflow, likely dialog-first or compact status-first

## Non-goals

- Do not invent a web-only AI configuration model that diverges from BlueNote core
- Do not merge preview and AI into a generic all-purpose utility concept if that obscures preview’s role
- Do not turn the editor into a dashboard

## Verification expectations

Final verification must confirm:
- manager feels like the fastest way to navigate/open notes and folders
- editor feels plain/focused
- preview reads as markdown preview
- AI reads as background processing/status/config, not a parallel writing pane
- draft promotion bug is fixed and WebUI remains usable after save-draft-as-normal flow
- browser screenshots support the final UX judgment
