# Core Parity and Shell Model

This document captures the durable architectural decisions for BlueNote WebUI’s product shell so future plans and sessions do not need to reconstruct them from old redesign specs.

## Product shell

The WebUI uses a **three-surface workspace**:

- **Manager** — explorer and contextual navigation/actions
- **Editor** — primary writing surface
- **Preview** — markdown rendering peer

Additional invoked surfaces:
- **Search Everything**
- **AI dialog**
- **Action dialogs** for task-box flows

## Locked shell decisions

1. Manager, editor, and preview remain the core workspace surfaces.
2. Manager is smaller than editor and preview.
3. Editor and preview should visually read as equal peers on desktop.
4. Manager auto-hides before preview on narrower widths.
5. Editor stays focused on editing rather than management-heavy actions.
6. Manager actions are contextual to the current selection and belong in the manager flow.
7. Search Everything remains the global command/search surface.
8. AI remains an invoked, segmented, secondary workflow.
9. Light mode and dark mode are both first-class and locally persisted.
10. UX quality claims require real browser verification.

## Manager contract

The manager should behave like an explorer, not a dense dashboard or raw list.

Required properties:
- navigation history with back/forward
- breadcrumbs/current folder context
- folders first, then notes
- icon-led distinction between folder / normal note / draft note
- rows showing title, filename/path, and description/count
- contextual actions for the current selection
- integrated local filtering that does not add pointless chrome

## Editor contract

The editor is the primary work surface.

Required properties:
- clean title/state/status communication
- focused text-body dominance
- clear save/dirty/failure states
- no management-heavy action clutter
- no reintroduction of the old intrusive left focus bar

## Preview contract

Preview is a dedicated markdown companion.

Required properties:
- typography and spacing worthy of direct reading
- clear separation from AI/status concepts
- easy responsive restore when hidden
- desktop parity with the editor in visual importance

## Search Everything contract

Search Everything should align with the BlueNote command-search model.

Required properties:
- global shortcut `Ctrl/Cmd+K`
- invoked command surface rather than permanent pane
- vertical flow: search bar → results → preview/details
- clean empty and populated states
- reliable close behavior via Escape and safe outside-click

## AI contract

AI is secondary and core-faithful.

Required properties:
- segmented status / queue / config / auth organization
- compact dialog with internal scrolling on smaller screens
- server-side secret handling only
- no WebUI-only AI semantics that diverge from actual product behavior

## Historical-doc rule

Execution plans and redesign explorations may evolve, but the decisions in this file should be treated as the stable shell model until a future approved architecture or product decision explicitly changes them.
