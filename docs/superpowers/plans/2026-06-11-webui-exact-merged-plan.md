# BlueNote WebUI Exact Merged Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep BlueNote WebUI aligned with BlueNote core and BlueNote term while converging all overlapping redesign/polish plans into one exact source of truth for the manager/editor/preview workspace, search, AI dialogs, theme behavior, and browser-verified UX.

**Architecture:** Preserve the current three-surface product model — manager, editor, preview — with AI and Search Everything as invoked overlays rather than primary panes. Continue using browser-safe BlueNote core behavior as the product contract, keep the editor focused on editing, keep manager actions contextual to selection, and require screenshot-backed browser verification for UX claims.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, vanilla CSS in `src/client/styles/theme.css`, Font Awesome icons, local Node 16.14 toolchain via `source ../use-node-16.14.sh`, BlueNote core behavior, local browser verification.

---

## This document supersedes

These older WebUI plan files were iterative versions of the same effort and should no longer be treated as active sources of truth:

- `docs/superpowers/plans/2026-06-10-webui-shell-redesign-and-ai-parity.md`
- `docs/superpowers/plans/2026-06-10-webui-vscode-obsidian-ux-overhaul.md`
- `docs/superpowers/plans/2026-06-10-webui-separated-workspace-refit.md`
- `docs/superpowers/plans/2026-06-11-webui-term-aligned-shell-cleanup.md`
- `docs/superpowers/plans/2026-06-11-webui-visual-polish-7-to-10.md`

Related design references that remain useful background, but are not execution plans:

- `docs/superpowers/specs/2026-06-10-webui-shell-redesign-and-ai-parity-design.md`
- `docs/superpowers/specs/2026-06-10-webui-vscode-obsidian-ux-overhaul-design.md`
- `docs/superpowers/specs/2026-06-10-webui-separated-workspace-refit-design.md`
- `docs/superpowers/specs/2026-06-11-webui-term-aligned-shell-cleanup-design.md`

---

## Current baseline already landed in the repo

The merged plan starts from the real repo state, not from the oldest ambitions:

- responsive manager/preview pane behavior exists
- manager uses a unified explorer-style surface
- note rows distinguish folder / note / draft by icon
- manager supports contextual bottom-bar actions through an invoked Actions surface
- editor header and preview header were simplified
- draft promotion flow has been browser-verified against startup/reload behavior
- Search Everything uses `Ctrl/Cmd+K` instead of `Ctrl/Cmd+P`
- theme toggle persists in localStorage
- custom scrollbar styling exists across major scroll surfaces
- command palette visuals have already been widened and improved

Future work should refine and verify this baseline rather than re-introducing older competing shell concepts.

---

## Locked product decisions

1. **Manager, editor, and preview remain the core workspace surfaces.**
2. **Manager is smaller; editor and preview read as equal peers.**
3. **Manager auto-hides first on narrower widths; preview hides later.**
4. **Editor stays focused on editing, not management-heavy action chrome.**
5. **Manager actions are selection-contextual and live in the manager flow, not in the editor.**
6. **Search Everything is an invoked command surface modeled after BlueNote term.**
7. **AI remains a background/status/config workflow, not a permanent writing pane.**
8. **Folder / note / draft semantics must stay faithful to BlueNote core behavior.**
9. **Dark and light themes are both first-class and must remain persisted locally in the WebUI.**
10. **No UX claim is complete without real browser verification; DOM/tests alone are insufficient.**

---

## Files that define the current WebUI shell

### Product code
- `src/client/app/App.tsx` — global state, keyboard shortcuts, overlay orchestration, theme state, shell wiring
- `src/client/components/AppShell.tsx` — top bar, workspace metadata, global controls, restore/open controls
- `src/client/components/FolderManager.tsx` — explorer, navigation history, manager-local actions, selection surfaces
- `src/client/components/EditorPane.tsx` — writing surface, note identity, save state, editor status
- `src/client/components/PreviewPane.tsx` — markdown preview and preview visibility affordances
- `src/client/components/ActionDialog.tsx` — shared invoked action surface
- `src/client/components/CommandPalette.tsx` — Search Everything UI
- `src/client/components/AiWorkspaceDialog.tsx` — AI status/config/auth/queue surface
- `src/client/app/useResponsivePanes.ts` — responsive pane visibility rules
- `src/client/styles/theme.css` — layout, spacing, tokens, dialogs, editor/preview/manager styling, themes

### Tests
- `tests/client-components.test.tsx`
- `tests/client-shell-layout.test.tsx`
- `tests/client-responsive-panes.test.tsx`
- `tests/client-utility-pane.test.tsx`
- `tests/client-ai-dialog.test.tsx`
- `tests/client-visual-css-contract.test.ts`

### Cross-repo behavior references
- `../bluenote-core`
- `../bluenote-term`

---

## Exact remaining work

### Task 1: Lock BlueNote core parity for note identity and startup selection

**Files:**
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-shell-layout.test.tsx`
- Modify if needed: `src/client/app/App.tsx`
- Modify if needed: `src/client/app/api.ts`
- Modify if needed: `src/server/routes/notes.ts`
- Modify if needed: `src/server/services/note-service.ts`

- [ ] Add regression coverage for the draft-to-note promotion path that previously caused startup-selector failure.
- [ ] Assert that after promoting a draft, the selected key/path persisted by the WebUI points to the new normal note identity rather than the old draft selector.
- [ ] Verify the WebUI startup load path remains valid after reload with no stale draft key lookup.
- [ ] If any server/client mismatch remains, fix it by preferring BlueNote core-derived canonical note selectors over stale client-local identities.
- [ ] Re-run targeted tests and browser verification for: create draft → promote to note → reload → startup succeeds.

### Task 2: Finish the manager as a true explorer surface

**Files:**
- Modify: `src/client/components/FolderManager.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-shell-layout.test.tsx`

- [ ] Ensure the manager remains a single unified explorer with folders first and notes after, without reintroducing card-heavy or split-surface treatments.
- [ ] Keep title, filename/path, and description aligned and readable in each navigation row.
- [ ] Ensure the selected-item contextual action surface is visually calm at rest and clearly actionable when opened.
- [ ] Keep back/forward controls easy to hit and keyboard discoverable.
- [ ] Remove any remaining redundant manager chrome that does not improve browsing speed.
- [ ] Browser-verify the manager from a user POV in desktop dark, desktop light, and a narrower responsive width.

### Task 3: Keep the editor centered on writing quality

**Files:**
- Modify: `src/client/components/EditorPane.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-visual-css-contract.test.ts`

- [ ] Keep editor metadata/status present but visually quieter than the text body.
- [ ] Preserve save/dirty/title clarity without turning the editor back into a management console.
- [ ] Ensure the editor focus treatment stays clean and does not reintroduce the old intrusive left-side focus bar.
- [ ] Refine textarea/status spacing, contrast, and empty-state feel in both themes.
- [ ] Browser-rate editor header, body, and status bar from screenshots rather than CSS assumptions alone.

### Task 4: Make preview feel like a dedicated markdown peer

**Files:**
- Modify: `src/client/components/PreviewPane.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-components.test.tsx`
- Modify: `tests/client-visual-css-contract.test.ts`

- [ ] Keep preview clearly distinct from AI/status concepts.
- [ ] Improve markdown typography, spacing, code blocks, and divider restraint.
- [ ] Keep preview toggle behavior responsive and easy to restore when hidden.
- [ ] Verify preview and editor read as equal peers on desktop and remain reachable on narrow widths.

### Task 5: Finish Search Everything as a term-aligned command surface

**Files:**
- Modify: `src/client/components/CommandPalette.tsx`
- Modify: `src/client/components/ActionDialog.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-utility-pane.test.tsx`
- Modify: `tests/client-shell-layout.test.tsx`

- [ ] Preserve `Ctrl/Cmd+K` as the single global shortcut.
- [ ] Keep the layout top-to-bottom: search bar → results → preview.
- [ ] Improve result-item active/hover states and scanning rhythm when real results populate.
- [ ] Ensure click-outside and Escape closure remain reliable.
- [ ] Browser-verify both empty and populated search states from visible screenshots.

### Task 6: Keep AI compact, segmented, and secondary

**Files:**
- Modify: `src/client/components/AiWorkspaceDialog.tsx`
- Modify: `src/client/components/ActionDialog.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-ai-dialog.test.tsx`

- [ ] Keep AI status/config/auth/queue flows segmented so the dialog does not become a vertical wall.
- [ ] Ensure small-screen usability through constrained height and internal scrolling.
- [ ] Preserve BlueNote core-faithful config/auth behavior instead of inventing WebUI-only semantics.
- [ ] Browser-verify that the AI dialog is usable and not visually dominant.

### Task 7: Final shell and theme polish without violating the product model

**Files:**
- Modify: `src/client/components/AppShell.tsx`
- Modify: `src/client/styles/theme.css`
- Modify: `tests/client-shell-layout.test.tsx`
- Modify: `tests/client-visual-css-contract.test.ts`

- [ ] Keep the top bar compact and utilitarian.
- [ ] Retain only useful global controls: workspace metadata, search, theme, AI, and restore/open controls when needed.
- [ ] Maintain custom scrollbar styling across manager/editor/preview/overlay surfaces.
- [ ] Ensure light mode is as intentionally designed as dark mode, not merely “not broken.”
- [ ] Rate topbar, manager, editor, preview, dialogs, and responsive states from screenshots.

### Task 8: Verification gates before calling the merged plan complete

**Files:**
- Modify: none required unless verification reveals regressions

- [ ] Run targeted tests for every touched area.
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

---

## Practical execution order

1. Core-parity regression protection
2. Manager explorer finish
3. Editor and preview refinement
4. Search and AI overlay polish
5. Topbar/theme/final visual pass
6. Full verification and browser evidence

This order keeps behavioral safety ahead of cosmetic refinements and avoids repeating the drift seen in the older overlapping plans.
