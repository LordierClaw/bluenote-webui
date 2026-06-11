# BlueNote WebUI Exact Merged Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep BlueNote WebUI aligned with BlueNote core and BlueNote term while refining the manager/editor/preview workspace, search, AI dialogs, theme behavior, and browser-verified UX under one exact execution plan.

**Architecture:** Preserve the current three-surface product model — manager, editor, preview — with Search Everything, AI, and action dialogs as invoked surfaces. Long-lived product rules now live in `docs/product/`, `docs/architecture/`, and `docs/workflow/`; this file is the dated execution plan for remaining implementation work.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, vanilla CSS in `src/client/styles/theme.css`, Font Awesome icons, local Node 16.14 toolchain via `source ../use-node-16.14.sh`, BlueNote core behavior, real browser verification.

---

## Canonical reference documents

Before changing the shell, align with:

- `docs/product/overview.md`
- `docs/product/design-language.md`
- `docs/architecture/runtime-and-dependencies.md`
- `docs/architecture/core-parity-and-shell-model.md`
- `docs/workflow/verification.md`

This plan should execute against those rules rather than redefining them.

---

## Current baseline already landed in the repo

The merged plan starts from the actual repo state:

- responsive manager/preview pane behavior exists
- manager uses a unified explorer-style surface
- note rows distinguish folder / note / draft by icon
- manager supports contextual bottom-bar actions through an invoked Actions surface
- draft promotion flow has been browser-verified against startup/reload behavior
- Search Everything uses `Ctrl/Cmd+K`
- theme toggle persists in localStorage
- markdown preview exists as a dedicated pane
- custom scrollbar styling exists across major scroll surfaces
- command palette visuals have already been widened and improved

Future work should refine and verify this baseline rather than re-arguing the product model.

---

## Files that define the current WebUI shell

### Product code
- `src/client/app/App.tsx`
- `src/client/app/useResponsivePanes.ts`
- `src/client/components/AppShell.tsx`
- `src/client/components/FolderManager.tsx`
- `src/client/components/EditorPane.tsx`
- `src/client/components/PreviewPane.tsx`
- `src/client/components/CommandPalette.tsx`
- `src/client/components/AiWorkspaceDialog.tsx`
- `src/client/components/ActionDialog.tsx`
- `src/client/styles/theme.css`

### Tests
- `tests/client-components.test.tsx`
- `tests/client-shell-layout.test.tsx`
- `tests/client-responsive-panes.test.tsx`
- `tests/client-utility-pane.test.tsx`
- `tests/client-visual-css-contract.test.ts`

### Cross-repo references
- `../bluenote-core`
- `../bluenote-term`

---

## Exact remaining work

### Task 1: Keep note identity and startup selection core-faithful

**Files:**
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-shell-layout.test.tsx`
- Modify if needed: `src/client/app/App.tsx`
- Modify if needed: `src/client/app/api.ts`
- Modify if needed: `src/server/routes/notes.ts`
- Modify if needed: `src/server/services/note-service.ts`

- [ ] Protect the draft-to-note promotion path with regression coverage.
- [ ] Assert that post-promotion selection persists a valid normal-note identity rather than a stale draft selector.
- [ ] Verify startup load remains valid after reload.
- [ ] If mismatch remains, prefer canonical BlueNote core-derived selectors over stale client-local identities.
- [ ] Re-run targeted tests and browser verification for create draft → promote → reload → startup succeeds.

### Task 2: Finish the manager as a true explorer

**Files:**
- Modify: `src/client/components/FolderManager.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-shell-layout.test.tsx`

- [ ] Preserve the unified explorer without reintroducing card-heavy or split-surface treatments.
- [ ] Keep title, filename/path, and description aligned and readable in navigation rows.
- [ ] Keep back/forward controls discoverable and easy to hit.
- [ ] Keep the selected-item contextual action surface calm at rest and clear when opened.
- [ ] Browser-verify the manager in desktop dark, desktop light, and a narrower responsive width.

### Task 3: Keep the editor centered on writing quality

**Files:**
- Modify: `src/client/components/EditorPane.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-visual-css-contract.test.ts`

- [ ] Keep metadata/status present but visually quieter than the text body.
- [ ] Preserve save/dirty/title clarity without turning the editor into a management console.
- [ ] Keep focus treatment clean and never reintroduce the old intrusive left-side focus bar.
- [ ] Refine spacing, contrast, and empty-state feel in both themes.
- [ ] Browser-rate editor header, body, and status bar from screenshots.

### Task 4: Make preview feel like a dedicated markdown peer

**Files:**
- Modify: `src/client/components/PreviewPane.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-visual-css-contract.test.ts`

- [ ] Improve markdown typography, spacing, code blocks, and divider restraint.
- [ ] Keep preview clearly distinct from AI/status concepts.
- [ ] Keep preview toggle behavior responsive and easy to restore when hidden.
- [ ] Verify preview and editor read as equal peers on desktop and remain reachable on narrow widths.

### Task 5: Finish Search Everything as a command surface

**Files:**
- Modify: `src/client/components/CommandPalette.tsx`
- Modify: `src/client/components/ActionDialog.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-utility-pane.test.tsx`
- Modify: `tests/client-shell-layout.test.tsx`

- [ ] Preserve `Ctrl/Cmd+K` as the single global shortcut.
- [ ] Keep the layout top-to-bottom: search bar → results → preview.
- [ ] Improve result-item active/hover states and scanning rhythm with real results.
- [ ] Ensure click-outside and Escape closure remain reliable.
- [ ] Browser-verify both empty and populated search states.

### Task 6: Keep AI compact, segmented, and secondary

**Files:**
- Modify: `src/client/components/AiWorkspaceDialog.tsx`
- Modify: `src/client/components/ActionDialog.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-ai-dialog.test.tsx`

- [ ] Keep AI status/config/auth/queue flows segmented so the dialog does not become a vertical wall.
- [ ] Ensure smaller-screen usability through constrained height and internal scrolling.
- [ ] Preserve BlueNote core-faithful config/auth behavior.
- [ ] Browser-verify that the AI dialog is usable and not visually dominant.

### Task 7: Final shell and theme polish

**Files:**
- Modify: `src/client/components/AppShell.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-shell-layout.test.tsx`
- Modify: `tests/client-visual-css-contract.test.ts`

- [ ] Keep the top bar compact and utilitarian.
- [ ] Retain only useful global controls.
- [ ] Maintain custom scrollbar styling across manager/editor/preview/overlay surfaces.
- [ ] Ensure light mode is as intentionally designed as dark mode.
- [ ] Rate topbar, manager, editor, preview, dialogs, and responsive states from screenshots.

### Task 8: Final verification gate

- [ ] Run targeted tests for touched areas.
- [ ] Run full verification:

```bash
cd /home/hainn/blue/code/bluenote/bluenote-webui
source ../use-node-16.14.sh
npm run check
```

- [ ] Use the real browser to verify at minimum:
  - manager smaller than editor/preview
  - editor and preview visually peer each other
  - manager auto-hides first
  - Search Everything opens with `Ctrl/Cmd+K`
  - draft promotion remains clean across reload/startup
  - theme persistence survives reload
  - browser console is free of JS errors
- [ ] If only `bluenote-webui` changed, keep verification scoped to WebUI. If changes extend into `bluenote-core` or `bluenote-term`, run the corresponding repo tests too.
- [ ] Report final UX quality from actual screenshots, including any remaining weaknesses rather than overclaiming perfection.
