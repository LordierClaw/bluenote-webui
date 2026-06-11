# BlueNote WebUI VSCode/Obsidian UX Overhaul Design

**Date:** 2026-06-10
**Status:** Approved design baseline
**Scope:** Full visual/interaction redesign of the BlueNote WebUI manager, editor header/action model, preview/AI utility pane, overlay surfaces, and shell chrome. This spec supersedes the earlier richer-flat-shell direction when the two conflict.

---

## 1. Goal

Redesign the BlueNote WebUI so it feels like a serious local-first writing tool rather than a rough prototype.

The new shell must:
- keep BlueNote's real information architecture and core behavior
- feel closer to VS Code / Obsidian in structure and usability
- dramatically improve manager navigation, scanability, and hierarchy
- replace the current icon-soup editor action bar with grouped, understandable actions
- move save/move/rename/search/AI flows into consistent internal overlay surfaces
- integrate preview, AI, and note metadata into a coherent right-side utility pane
- preserve dark mode and support a polished light mode with local WebUI-only persistence
- be verified by actual browser and desktop screenshots, with user-POV UX scoring before completion

---

## 2. Chosen Product Direction

### 2.1 Chosen visual/interaction direction
The approved direction is:
- **VS Code / Obsidian-like shell structure**
- with **cleaner premium composition**, not a literal IDE clone
- optimized for **real note management and writing UX**, not decorative polish only

### 2.2 Product principle
The redesign should prioritize:
1. lower interaction cost
2. clearer mental model
3. stronger affordances
4. keyboard-friendly command workflows
5. visual refinement in support of usability

This means the app should feel like a dense, capable note workspace first and a styled webpage second.

---

## 3. Current UX Problems To Fix

Based on live browser usage and real desktop screenshots, the current UI fails in these ways:

### 3.1 Manager problems
- the manager reads like a raw list instead of a navigation system
- breadcrumbs, history, actions, search, and content list do not form a coherent explorer
- note rows do not scan well and do not feel distinct enough by state/type
- folder vs note vs draft relies too much on text and too little on iconography and row styling

### 3.2 Editor action problems
- the action bar is ambiguous and visually weak
- actions feel equally important even when they are not
- users cannot quickly infer where rename/move/search/save/AI belong conceptually
- the action strip does not feel attached to the current note context

### 3.3 Preview/AI problems
- preview is visually detached rather than integrated into the workflow
- AI appears bolted on instead of being a task-oriented assistant for notes
- AI status, configuration, queue actions, and note-level actions do not share a clear home

### 3.4 Shell/chrome problems
- the top bar mixes app identity, workspace state, note count, theme controls, AI status, and pane controls without strong hierarchy
- the overall shell has weak panel contrast and too little intentional spacing rhythm
- the UI looks like a dark wireframe or early prototype rather than a finished product

---

## 4. Locked Layout Architecture

The redesigned app should use a deliberate 3-column workspace.

### 4.1 Left pane: Explorer
Responsibilities:
- navigation history
- workspace scope / breadcrumbs
- quick create actions
- local sidebar search
- note/folder/draft list
- optional recent/history section if space permits

This pane should feel like a true explorer/sidebar.

### 4.2 Center pane: Editor workspace
Responsibilities:
- note title and meta header
- save state and note state communication
- grouped note actions
- editor surface
- action-triggered overlays

This is the dominant working surface and should own the visual center of gravity.

### 4.3 Right pane: Utility pane
Responsibilities:
- Preview tab
- AI tab
- Info/Metadata tab
- contextual secondary content that supports the active note

This pane should be tabbed and collapsible. It should no longer feel like a narrow leftover rail.

---

## 5. Manager / Explorer Redesign

### 5.1 Explorer sections
The left pane should be reorganized into these stacked zones:

1. **Navigation strip**
   - back
   - forward
   - current scope/breadcrumbs
   - compact visibility/expand affordances where useful

2. **Quick actions**
   - new note
   - quick draft
   - new folder

3. **Search block**
   - larger search field
   - stronger placeholder text
   - clearly integrated with the explorer, not floating awkwardly

4. **Item list**
   - folders and notes rendered as high-scan rows
   - stronger selected/hover/focus states

### 5.2 Row composition
Each note row should show:
- icon by type
- title as primary text
- filename/path as secondary text
- description preview as tertiary text when available

### 5.3 Type distinction
At minimum visually distinguish:
- folder
- normal note
- draft note

Use iconography, color accents, and selected-state treatment rather than repeated textual labels.

### 5.4 Interaction
- row click opens item
- hover may reveal compact row actions later, but base design must work without hover-only affordances
- keyboard navigation should remain viable
- back/forward must feel like real explorer history, not decorative controls

---

## 6. Editor Header and Action Model

### 6.1 Editor header
The center pane should start with a strong editor header containing:
- note title
- note type / status
- file path or folder context
- save/load status

This should visually replace the current thin weak title/action separation.

### 6.2 Action model
Visible actions should be grouped by meaning.

Recommended visible groups:
- **Create**: new note, new folder, quick draft
- **Current note**: save, rename, move, save draft as
- **Find / navigate**: search everything, command palette
- **Assist**: AI
- **Pane/view**: preview toggle, utility toggle if needed

### 6.3 Interaction principle
The user should be able to tell:
- what applies to the workspace
- what applies to the current note
- what opens a dialog/overlay
- what changes the shell layout

The current toolbar does not communicate this well enough.

---

## 7. Overlay / Inside-Box System

The user explicitly requested internal box surfaces for save, move, rename, search, and related operations.

### 7.1 Surface types
Use a consistent hierarchy:
- **popover/sheet** for lightweight contextual actions
- **command palette / quick panel** for search and command-style flows
- **modal dialog** for more focused rename/move/create/config flows

### 7.2 Required interactions
These surfaces must support:
- open via click or shortcut
- close via Escape
- close via outside click when safe
- keyboard-first focus order
- predictable submit/cancel flows

### 7.3 Consistency rule
Save, move, rename, search, and AI should feel like members of the same interaction family, not five unrelated UI inventions.

---

## 8. Preview / AI / Info Utility Pane

### 8.1 Utility tab model
The right pane should become a tabbed utility surface with at least:
- `Preview`
- `AI`
- `Info`

### 8.2 Preview tab
The preview tab should:
- show markdown cleanly
- use better typography and spacing
- feel aligned with the active note, not visually detached

### 8.3 AI tab
The AI tab should shift from “status badge with config” to “assistant for the active note/workspace”.

Suggested task-oriented entry points:
- describe current note
- improve writing
- summarize note
- queue/process jobs
- configure provider/model
- auth/connect status

### 8.4 Info tab
The info tab can hold:
- note path
- folder
- updated timestamps if available
- note/draft state
- future diagnostics or metadata

---

## 9. Top Bar Simplification

The top bar should become quieter and more intentional.

### 9.1 Left side
- app identity
- lightweight workspace label

### 9.2 Center (optional or compact)
- command/search trigger if it improves discoverability

### 9.3 Right side
- theme toggle
- AI status chip
- note/workspace meta in subdued form

### 9.4 Rule
Do not overload the top bar with every operation. It is shell chrome, not the main action surface.

---

## 10. Visual Language

### 10.1 Aesthetic target
The app should feel like:
- dark graphite / blue-black productivity shell
- crisp and structured
- restrained but premium
- denser and more confident than the current design

### 10.2 Visual improvements required
- stronger pane contrast
- more intentional spacing rhythm
- better typography hierarchy
- fewer generic outlined buttons everywhere
- more meaningful selected/hover/focus states
- tighter alignment between labels, controls, and content regions

### 10.3 Light mode
Light mode must not be an afterthought. It should preserve:
- contrast hierarchy
- row separation
- readable muted text
- strong but non-harsh borders/dividers

Persist theme in WebUI localStorage only.

---

## 11. Responsive Behavior

### 11.1 Large screens
- explorer + editor + utility pane visible together when enabled
- editor remains clearly dominant

### 11.2 Medium screens
- utility pane may narrow first
- manager remains usable and readable
- no cramped wrapping of key actions

### 11.3 Small screens
- manager can auto-hide, but must be recoverable instantly
- utility pane should degrade into a temporary/toggled pane
- editor stays primary

### 11.4 Non-stranding rule
No responsive state may strand the user from:
- navigation
- save
- search
- current-note actions
- AI entrypoints

---

## 12. Parity / Product Integrity Rules

This redesign is not permission to invent a different BlueNote product model.

The WebUI must continue to respect:
- BlueNote’s note/draft/folder semantics
- term/core behavior for create/move/rename/save/search/draft-promotion flows
- browser-safe boundaries when reusing shared/core logic

Visual redesign may be radical. Product semantics may not be.

---

## 13. Verification Requirements

The work is not complete unless all are performed:

### 13.1 Test verification
Add/update tests covering:
- manager rendering and note row metadata
- utility-pane tabs / toggles
- overlay open/close behavior
- editor action grouping and discoverability affordances where testable
- theme persistence
- responsive shell rules
- AI pane and AI workflow entrypoints

### 13.2 Browser verification
Verify in a real browser:
- full-width desktop shell
- narrower responsive shell
- manager usability
- action overlays
- preview readability
- AI usability
- theme toggle persistence
- navigation history
- draft promotion and normal note flows

### 13.3 Screenshot verification
Capture real screenshots of:
- before/current problematic state
- redesigned desktop shell
- redesigned narrow shell
- at least one overlay/dialog
- AI utility surface

### 13.4 User-POV scoring
Rate from a user perspective:
- visual quality
- manager UX
- editor UX
- AI UX
- overall productivity feel

---

## 14. Success Criteria

The redesign succeeds when:
- the app no longer looks like a prototype
- the manager feels like an explorer, not a raw list
- the editor actions feel grouped and understandable
- preview and AI have a coherent home
- internal action boxes feel consistent and keyboard-friendly
- the shell works well in both dark and light mode
- the final result is backed by tests, real browser verification, and screenshot-based user-POV review

---

## 15. Recommended Implementation Order

1. shell layout + visual token cleanup
2. manager/explorer redesign
3. editor header + grouped action model
4. utility pane tabs (preview / AI / info)
5. overlay system for save/move/rename/search
6. AI task-oriented pane polish
7. browser verification + screenshots + UX scoring
