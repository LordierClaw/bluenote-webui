# BlueNote WebUI Design Language

BlueNote WebUI follows **Calm Explorer Workspace**: a local-first browser design language for serious note browsing, writing, previewing, and command-driven actions. It should feel stable, restrained, and useful — closer to a trustworthy productivity tool than a styled prototype.

This document is canonical for future WebUI shell changes. If a future session updates UI structure, colors, spacing, overlays, or responsive behavior, it should start here.

## Product personality

- **Local and trustworthy:** the UI should feel like it is operating on local notes through an explicit local app boundary.
- **Calm for writing:** the editor should reduce noise and let the body dominate.
- **Structured for browsing:** the manager should feel like an explorer with clear hierarchy and predictable actions.
- **Purposeful for commands:** search, rename, move, create, and AI flows should feel like members of one interaction family.
- **Restrained, not sterile:** the interface can be polished and premium without turning decorative.

## Core principles

1. **Editor first.** The center writing surface is the quietest and most important surface.
2. **Explorer, not sidebar.** The manager must feel like a real browser for notes/folders with navigation, scanability, and selection context.
3. **Preview is a peer.** The preview pane should visually read as equal to the editor on desktop.
4. **Actions belong to context.** Workspace-level actions, selection actions, and transient task-box actions must be visually separated.
5. **One strong accent at a time.** Focus, selection, and danger should be obvious without splashing accent color everywhere.
6. **Icons replace repeated labels.** Folder / note / draft distinction should rely on iconography first, text only where it adds meaning.
7. **Overlay family consistency.** Search, rename, move, create, save-draft-as, and AI surfaces should feel structurally related.
8. **Responsive by simplification.** When the viewport shrinks, the app should hide less-important panes before it compresses everything into cramped clutter.
9. **Screenshot truth.** A UI idea is not accepted until it looks defensible in real browser screenshots.

## Canonical workspace model

### Primary surfaces
- **Manager (left):** explorer, history, breadcrumbs, quick creation, local filter, contextual item actions.
- **Editor (center):** note title/state plus writing surface and minimal status.
- **Preview (right):** markdown rendering peer to the editor.

### Invoked surfaces
- **Search Everything:** command/search palette.
- **AI dialog:** segmented status/config/auth/queue workflow.
- **Action dialogs:** task boxes for rename, move, create, save-draft-as, and related flows.

### Locked layout rules
- Manager is smaller than editor and preview.
- Editor and preview should read as equal peers by default on desktop.
- Manager auto-hides before preview.
- The editor should not be turned back into a management toolbar.
- Search Everything remains an invoked command surface, not a permanent pane.
- AI remains secondary, not a persistent writing-column concept.

## Color roles

Use semantic roles, not arbitrary hues.

| Role | Use |
| --- | --- |
| `bg.app` | Application background |
| `bg.surface` | Standard cards/panes/dialog shells |
| `bg.surfaceRaised` | Active inputs, raised overlays, selected task boxes |
| `bg.selected` | Selected rows or active segmented controls |
| `border.subtle` | Passive panel borders/dividers |
| `border.focus` | Current focus/high-priority active region |
| `text.primary` | Titles, body, primary labels |
| `text.secondary` | Descriptions, supporting labels |
| `text.muted` | Paths, filenames, helper metadata, shortcuts |
| `accent.blue` | Primary interaction/focus/brand state |
| `status.success` | Saved/healthy/available |
| `status.warning` | Unsaved/pending/caution |
| `status.danger` | Delete/failed/irreversible |
| `status.info` | Neutral active info/search context |

### Color rules
- Blue is the primary interactive accent.
- Green is for healthy/success only.
- Orange is for warning/attention only.
- Red is for destructive/failure only.
- Passive surfaces should not all glow blue.
- Focus should be readable in both dark and light mode.

## Surface rules

### App shell
- Top bar is compact and utilitarian.
- It may contain workspace identity/metadata, search trigger, theme toggle, AI trigger, and compact restore/open controls when responsive state requires them.
- It should not become a dumping ground for redundant pane controls.

### Manager
- The manager should read as a unified explorer.
- Folders come first, then notes.
- Navigation rows use:
  - icon
  - title
  - filename/path
  - description or count
- Selected-item actions should be calm at rest and obvious when invoked.
- Back/forward must feel like true navigation controls.

### Editor
- The text body is the dominant visual element.
- Metadata and status exist, but remain quieter than content.
- No intrusive left focus bar.
- Save/dirty/failure states must be explicit and semantically styled.

### Preview
- Preview should not visually collapse into a utility afterthought.
- Markdown typography, block spacing, code blocks, quotes, and lists should feel intentional.
- Preview and editor should visually belong to the same product family without becoming identical.

### Search Everything
- The command palette should be large enough to feel like a real workspace.
- Preferred vertical order:
  1. search bar
  2. result list
  3. preview/details
- Empty, active, and populated states should all feel deliberate.

### AI dialog
- Segment vertically heavy flows into tabs or equivalent sections.
- Summary-first, details on demand.
- Must stay usable on smaller screens through bounded height + internal scrolling.

## Typography and hierarchy

1. Product/screen title
2. Section title
3. Primary row title / note title
4. Secondary description
5. Filename/path/metadata
6. Shortcut hints

Rules:
- Show title before filename/path.
- Distinguish filename/path from description.
- Avoid repeating category text when iconography already communicates the same thing.
- Metadata should not compete with titles.

## Interaction family

### Task-box model
Create, rename, move, save-draft-as, and similar flows should feel like task boxes:
- clear purpose
- clear current target or destination
- one primary action
- one safe cancel path
- close by Escape
- close by outside click when safe
- keyboard-first focus order

### Search model
- `Ctrl/Cmd+K` is the single global Search Everything shortcut.
- Search should be consistent across click and keyboard entry.
- Results should scan cleanly and support keyboard movement.

### Selection model
- One selected note/folder at a time in the manager.
- The selected row should be obvious without needing multiple stacked focus cues.
- Contextual actions should clearly refer to the current selection.

## Responsive rules

### Width
- **Wide:** manager + editor + preview visible; editor and preview read as peers.
- **Medium:** manager may auto-hide first; restore controls must be obvious.
- **Narrow:** preview may hide after manager; editor stays primary.

### Responsive behavior rules
- Hide before you squeeze.
- Restoring a hidden pane must be easy and discoverable.
- Do not strand key workflows behind hidden panes with no recovery path.

## Browser-verification contract

Any significant UI change should be reviewed in a real browser and rated from screenshots.

Minimum verification checklist:
- top bar hierarchy is clear
- manager scans well
- editor feels calmer than manager/search
- preview reads as a peer, not a leftover rail
- dialogs are usable and visually anchored
- light mode looks intentionally designed
- dark mode remains clean and readable
- browser console is free of JS errors

## Known failure patterns to avoid

- turning the manager into a card-heavy dashboard
- turning the editor into a management toolbar
- making preview feel like a narrow status gutter
- overusing accent borders on passive surfaces
- relying on text labels where icons would scan faster
- adding always-visible controls that responsive behavior should handle more elegantly
- shipping UI claims based only on tests or DOM structure

## Future-session update rule

When a future session changes the WebUI, it should update this document if the change affects:
- layout hierarchy
- color roles or semantic styling
- responsive behavior
- overlay/task-box interaction rules
- manager/editor/preview responsibilities
- browser-verification expectations

If the change is only a local implementation detail and does not alter product-wide UI rules, update the relevant plan or architecture doc instead.
