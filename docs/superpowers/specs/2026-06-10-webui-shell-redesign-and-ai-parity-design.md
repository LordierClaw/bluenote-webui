# BlueNote WebUI Shell Redesign and AI Parity Design

**Date:** 2026-06-10
**Status:** Approved design spec
**Scope:** Combined spec for WebUI shell redesign, responsive behavior, term-style operational parity, and full term-style AI workflow parity with shell-level AI status.

---

## 1. Goal

Redesign the BlueNote WebUI so it feels meaningfully more polished and useful without drifting away from BlueNote’s real product model.

The redesign must:
- use a richer flat visual language rather than the current one-tone look
- adopt Font Awesome icons for navigation and action affordances
- remain responsive across small and regular/large windows
- let users explicitly show/hide the manager and preview panes
- auto-hide panes at small widths, with manager hiding before preview
- enlarge and improve the search affordance
- move note/file operations into a dedicated action bar with icon-led actions
- preserve parity with `bluenote-term` for note operations, search behavior, and AI behavior
- implement full term-style AI workflows, while keeping the shell-level AI presence limited to AI status first
- verify all UI changes in a real browser from the user point of view, including a design/usability rating

---

## 2. Chosen Product Direction

### 2.1 Chosen implementation approach
The approved approach is **Option 1 — shell-first parity**.

This means the project should:
1. redesign the shell structure first
2. improve responsiveness and operational affordances first
3. keep the shell visually richer but behaviorally aligned to term/core
4. add full AI workflows behind on-demand surfaces instead of turning the shell into a permanently expanded AI dashboard

### 2.2 Chosen visual direction
The approved visual direction is **B — rich flat workspace**.

This visual language should be interpreted as:
- flat, productivity-oriented surfaces rather than glossy or skeuomorphic UI
- multiple accent colors used with discipline for navigation, action groups, note state, and AI state
- stronger separation of functional areas without introducing decorative noise
- denser, more capable product UI rather than a marketing-page aesthetic

The user briefly explored a warmer option before settling on this direction. The spec should therefore favor “alive but still native/productive” over “editorial” or “minimal monochrome.”

---

## 3. Product Architecture

The redesigned WebUI will use a **3-zone shell** that preserves BlueNote’s product model and makes the app easier to understand at a glance.

### 3.1 Manager pane (left)
Responsibilities:
- folder and note navigation
- current folder context and navigation history
- local folder-scoped filtering/search
- compact action entry for creation and navigation workflows
- dense scanning of note metadata

The manager pane should feel like a note browser, not just a raw list.

### 3.2 Editor pane (center)
Responsibilities:
- primary writing/editing surface
- save-state communication
- contextual action strip for note operations
- stable dominant surface at all viewport sizes

The editor remains the product’s primary working area and must retain priority over both side panes.

### 3.3 Preview / status pane (right)
Responsibilities:
- markdown preview by default
- contextual preview/status information
- AI-adjacent status/info surfaces when the user explicitly opens an AI workflow or when AI state needs to be surfaced for the current note/workspace
- secondary operational context that supports, but does not compete with, the editor

The preview pane stays visible longer than the manager at small widths per the approved responsive rule.

---

## 4. Responsive Behavior

The responsive system must support both manual control and intelligent fallback.

### 4.1 User-controlled toggles
The WebUI must provide explicit controls for:
- show/hide manager
- show/hide preview

These controls should remain accessible and obvious, even when auto-hide behavior is active.

### 4.2 Auto-hide policy
Approved policy:
- at small widths, **manager hides first**
- preview remains visible longer than manager
- at very small widths, the editor becomes dominant and side panes become temporary/toggleable surfaces

### 4.3 Layout tiers
#### Large screens
- manager + editor + preview visible together when enabled
- editor receives the most width
- shell can afford rich metadata in manager and useful preview/status context on the right

#### Medium screens
- layout compresses while still favoring a 3-zone shell when the viewport can preserve readable manager metadata, a usable editor width, and a readable preview pane simultaneously
- metadata remains readable
- search and action bar remain accessible without wrapping into unusable clutter

#### Small screens
- manager auto-hides before preview
- preview can remain present if space allows
- editor stays primary
- reopening hidden panes must be one click or one shortcut away

#### Very small screens
- editor-only mode becomes the dominant state
- manager and preview must behave like temporary/toggled overlays or compact surfaces rather than permanently consuming horizontal space

### 4.4 Anti-stranding rule
Auto-hide must never strand the user by making navigation, search, save, or key actions unreachable.

---

## 5. Visual Language

The redesign should follow the approved **rich flat workspace** direction.

### 5.1 Tone
- richer than the current one-tone shell
- flat, crisp, app-like
- more color without becoming glossy, noisy, or gradient-heavy by default
- designed for repeated daily use, not one-time visual impact

### 5.2 Color strategy
Color should communicate role rather than exist as decoration.

Expected use:
- navigation accents
- action-group accents
- note-state accents (folder/note/draft)
- AI state accents
- theme-safe support for both dark and light modes

### 5.3 Iconography
The WebUI should adopt **Font Awesome** icons for:
- navigation item type
- action strip controls
- pane toggles
- search
- save and note operations
- AI status and AI entrypoints

Icons should replace repetitive type labels where possible, especially for folder/normal note/draft note distinction.

---

## 6. Manager Redesign

The left manager pane should become denser, more scannable, and more expressive.

### 6.1 Navigation item composition
Each item should show:
- icon for item type
- title as the primary text
- filename/path hint as secondary text
- description/preview line as tertiary text when available

### 6.2 Type distinction
Type must be visually represented through iconography rather than repeated text labels.

At minimum distinguish:
- folder
- normal note
- draft note

### 6.3 Search affordance
The current search affordance is considered too small.

The redesign must provide a larger, clearer search field in the manager/shell so it feels important and usable rather than cramped.

### 6.4 Information density
The redesign should increase usefulness without becoming unreadable. The manager should feel like a serious browser for notes and folders, not a decorative sidebar.

---

## 7. Action Model and Operational Parity

The redesign should stop scattering note operations across unrelated controls and instead provide a **dedicated action strip**.

### 7.1 Action strip purpose
The action strip acts as the operational hub for note/file workflows.

It should likely sit near the editor/manager boundary or other high-context area so actions feel attached to the current working note/folder context.

### 7.2 Core actions in scope
The spec includes action entrypoints for:
- new note
- new folder
- rename note
- move note
- save
- save draft as / draft promotion flows whenever the current note is a draft or the current term behavior exposes draft-promotion actions for the active selection
- Search Everything
- AI actions entrypoint
- manager toggle
- preview toggle

### 7.3 Action surfaces
Any action that requires more than a single click should open a contained UI surface rather than cluttering the shell inline.

Examples:
- move
- rename
- create note
- create folder
- Search Everything
- deeper AI workflows

### 7.4 Surface behavior contract
These surfaces should support:
- open by icon click or shortcut
- close by Escape
- close by outside click when safe
- keyboard-first navigation
- context preservation so users do not lose their place unnecessarily

### 7.5 Term-parity rule
For note operations, the WebUI must follow `bluenote-term` behavior rather than inventing a new product model.

This includes:
- naming conventions
- constraints
- state transitions
- outcomes for create/move/rename flows
- draft vs normal note handling

Core/shared behavior should be reused where browser-safe. When direct reuse is not possible, the WebUI should recreate only the thin presentation adapter around the same product rules.

---

## 8. Search Everything Parity

Search Everything should remain term-faithful rather than becoming a generic web search box.

Requirements:
- preserve BlueNote’s real search semantics
- use browser-safe shared/core primitives where possible
- preserve typed result modeling where applicable
- support useful preview of the selected result
- remain keyboard-usable and visually clear
- fit naturally into the redesigned shell/action model

Search should feel larger and more important in the shell than it does today.

---

## 9. AI Parity Model

### 9.1 Shell-level AI presence
The shell should expose **AI status first**, matching the term app’s shell-level philosophy.

Expected shell-level behavior:
- clearly visible AI status in the chrome/header area
- states such as configured / not configured / active / queued / error where meaningful
- compact presence that does not dominate the note-writing shell

### 9.2 Full workflow parity behind on-demand surfaces
Even though shell-level AI remains light, the combined spec still requires **full term-style AI workflow parity**.

That means the WebUI must ultimately support:
- AI configuration UI
- note-level AI entrypoints/actions
- deeper AI workflow surfaces opened on demand
- queue / processing visibility where the term app exposes such behavior
- relevant result and error flows

### 9.3 UX placement rule
The approved interaction model is:
- shell shows status first
- deeper AI flows open on demand
- AI is a native extension of note operations, not a separate permanently open workspace

### 9.4 Parity source order
Implementation should follow this order:
1. inspect `bluenote-term` AI workflows and state model
2. inspect browser-safe core functionality
3. build thin WebUI adapters around those behaviors
4. avoid broad Node-only imports in browser code

The WebUI must not approximate AI behavior from memory or from visual mimicry alone.

---

## 10. Browser-Safe Boundaries

The WebUI must continue to respect browser-safe boundaries when consuming shared BlueNote logic.

Rules:
- prefer narrow imports over broad package root barrels
- avoid pulling Node-oriented modules into client code
- if term behavior depends on non-browser modules, adapt the behavior with a thin WebUI layer rather than importing unsafe code directly
- preserve production build health as a first-class requirement during parity work

This is especially important for search and AI integration work.

---

## 11. Error Handling and UX Safety

The redesign must improve capability without increasing fragility.

### 11.1 Pane safety
- auto-hide must never make the product feel broken or inaccessible
- users must always have a clear path to recover hidden panes

### 11.2 Operation safety
- move/rename/create flows must be cancellable
- keyboard usage must remain viable
- dialogs/contained surfaces should not trap the user unexpectedly

### 11.3 AI safety and clarity
AI-related surfaces must clearly communicate:
- not configured
- configured
- in progress
- queued
- error / failed states
- empty states where relevant

### 11.4 Responsive safety
Responsive behavior must preserve access to:
- search
- note navigation
- save
- core editor controls
- AI status entrypoints

---

## 12. Verification Requirements

This work is not complete unless all of the following are verified.

### 12.1 Regression and component coverage
Add or update tests for:
- manager toggle behavior
- preview toggle behavior
- responsive shell state rules
- action-bar note operations
- Search Everything interactions and preview behavior
- larger search affordance behavior where testable
- AI status rendering
- AI config entrypoints and surfaces
- deeper AI workflow entrypoints
- parity-sensitive note operations that mirror term behavior

### 12.2 Full WebUI gate
Run the full WebUI verification gate using the required Node 16.14 toolchain.

### 12.3 Browser verification
Verify the redesigned product in a real browser from the user point of view, including:
- desktop shell
- narrow window shell
- manager hide/show
- preview hide/show
- action dialogs
- Search Everything usability
- move / rename / create flows
- AI status visibility
- AI config access
- deeper AI workflow entrypoints
- overall design and usability rating from the user perspective

### 12.4 Cross-surface verification
For parity-sensitive behaviors:
- inspect `bluenote-term` implementation first
- confirm the WebUI behavior matches the intended product model
- do not claim parity based only on appearance

---

## 13. Delivery Staging

Even though the user requested a combined spec, implementation should remain staged internally so the work stays shippable and reviewable.

Recommended staging:
1. shell + responsiveness + pane toggles + action bar + manager redesign
2. search and operational parity polish
3. AI status + config + deeper workflow entrypoints
4. full browser verification and user-POV design/usability review

This staging is for implementation discipline, not for reducing scope.

---

## 14. Success Criteria

The combined redesign is successful when:
- the WebUI clearly feels more polished, less boring, and less cramped
- Font Awesome icons meaningfully improve scanning and type distinction
- the shell remains responsive and usable on narrow windows
- manager and preview can be shown/hidden explicitly and auto-hide correctly
- the action bar makes note operations more obvious and consistent
- the WebUI behavior remains aligned with `bluenote-term` and shared BlueNote rules
- AI is visible as status in the shell while full workflows remain accessible on demand
- all claims are backed by tests, full WebUI checks, and actual browser verification

---

## 15. Out-of-Scope For This Spec

The following are intentionally not included unless term parity requires them directly:
- turning the shell into a permanently expanded AI dashboard
- introducing a radically different BlueNote information architecture from term/core
- decorative design churn that does not improve product usability
- browser-only product semantics that conflict with the established BlueNote model

---

## 16. Summary of Locked Decisions

Locked during brainstorming:
- Combined mega-spec is intentional
- First shipped approach: **Option 1 — shell-first parity**
- Visual direction: **B — rich flat workspace**
- Small-width auto-hide priority: **hide manager first, keep preview visible longer**
- AI shell behavior: **AI status first, like term**
- AI workflow scope: **full term-style AI workflows still in scope, opened on demand**

This document is the approved design baseline for the implementation plan.
