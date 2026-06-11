# BlueNote WebUI Term-Aligned Shell Cleanup Design

**Date:** 2026-06-11
**Status:** Approved for implementation

## Goal

Refit the BlueNote WebUI shell to better match BlueNote Term UX expectations while preserving the existing manager/editor/preview product model. This redesign corrects the awkward action placement, unbalanced pane proportions, weak responsive behavior, cramped global search, overlong AI status/config dialog, and overly neutral color language.

## Locked decisions from user feedback

1. **Manager contextual actions** appear in a **bottom action bar inside the manager** for the **selected note or selected folder**.
2. **Editor** should be close to a **pure editing surface** and should **not carry management buttons**.
3. **Search everything** must follow the **bluenote-term** vertical layout from top to bottom:
   1. search bar
   2. search result list
   3. search preview
4. **Manager filter toggle** should be removed.
5. **Manager should be smaller** than the editor and preview.
6. **Editor and preview should be equal in width**.
7. **Manager should auto-hide first** when the browser window gets smaller.
8. **Always-visible show/hide manager/preview buttons** are poor UX and should be replaced by responsive auto-hide plus restoration controls that behave more like a mobile hamburger/drawer pattern.
9. **AI status/config** must compress vertically, support smaller screens, and reveal only what the user needs through tabs, view toggles, or similar segmentation.
10. **Color language** should align more closely with BlueNote Term using black/white plus stronger semantic blue/green/orange/red accents.

## Architecture overview

Keep the existing three-surface architecture:
- **Manager** = file explorer + contextual manager actions
- **Editor** = primary writing surface
- **Preview** = markdown rendering peer to editor
- **AI** = modal/dialog workflow for background status, queue, configuration, and auth
- **Search everything** = modal/command surface modeled after BlueNote Term

The redesign is a shell/interaction refit, not a product-model rewrite. Existing manager/editor/preview semantics stay intact.

## Layout design

### Top shell

The top shell should be compact and should stop acting like a dumping ground for pane toggles.

Required behavior:
- show branding and concise workspace metadata
- retain theme toggle
- retain global search trigger
- retain AI status trigger
- add a **single restore/open manager control** when manager is hidden or on small screens
- remove always-visible dual pane hide/show controls from the top bar

The top shell should feel utilitarian and tight, not like a dashboard header.

### Pane proportions

Default desktop proportions should become:
- **manager**: smaller column
- **editor**: medium column
- **preview**: medium column equal to editor

Editor and preview should read as peers. Manager should not dominate the workspace.

### Responsive behavior

When width shrinks:
1. manager auto-hides first
2. preview auto-hides later
3. hidden panes can be restored via compact toggles appropriate to the current breakpoint/state

The responsive controls should feel intentional and sparse. The current explicit hide buttons are removed.

## Manager design

### Navigation header

Manager navigation should feel more like a normal explorer.

Required behavior:
- cleaner back/forward controls
- breadcrumbs/path styled as navigation text, not chunky normal buttons
- unified explorer surface remains (folders first, then notes)
- no explicit filter show/hide control

### Search/filter behavior

The manager-level filter should not advertise itself as a toggle button.

Required behavior:
- remove the current show/hide filter button
- manager filter may remain inline only when needed by the new design, but it must not create pointless extra chrome
- if a filter input remains visible, it should feel integrated and secondary to browsing

### Item actions

Current per-row action placement is visually awkward.

Required behavior:
- remove side-mounted per-row action clutter as the primary action surface
- when a note or folder is selected, show a **bottom contextual action bar inside the manager**
- the bottom action bar changes by selection type:
  - **folder**: open / rename / create-inside / delete only if allowed
  - **note**: rename / move / archive / delete
- if nothing actionable is selected, the bottom manager action bar can stay hidden or inert

## Editor design

The editor is for editing, not managing.

Required behavior:
- remove management-heavy action bars from the editor top area
- preserve title/state/status presentation only as needed
- rely on keyboard shortcuts / dialogs / manager/contextual flows for management actions
- keep status bar and writing experience focused

## Search everything design

Search everything should explicitly follow the BlueNote Term model.

Required layout from top to bottom:
1. **search bar**
2. **search result list**
3. **search preview**

Required behavior:
- wider than the current cramped layout
- clearer result scanning and keyboard navigation
- preview panel shows relevant matched information such as title, file path, and highlighted text; command-like items can show descriptions instead
- the layout should feel like a command/search workspace, not a tiny utility popup

## AI status/config dialog design

The current AI dialog is too tall and too linear.

Required behavior:
- compact the dialog vertically
- support smaller screens via fixed height + internal scrolling
- use segmentation such as tabs/toggles/views to reduce vertical overload
- prioritize summary-first views
- expose only the currently relevant section at once

Recommended sections:
- Status
- Queue
- Config
- Auth

## Visual language

Color should become more intentional and more aligned with BlueNote Term.

Required principles:
- black/white neutral base
- blue = primary interactive state
- green = healthy/success
- orange = warning/attention
- red = destructive/failure
- avoid decorative over-coloring
- preserve readability and contrast in light/dark themes

## Testing and verification

Implementation is not complete without all of the following:
- updated component tests for manager context bar, editor action removal, responsive behavior, and AI/search surface structure
- full `npm run check` in `bluenote-webui`
- real browser verification on the local app
- explicit checks that:
  - manager is smaller than editor/preview
  - editor and preview read as equal peers
  - manager auto-hides first on narrower widths
  - search everything uses the required vertical structure
  - AI dialog is usable on smaller screens
  - browser console remains free of JS errors

## Non-goals

This redesign does **not**:
- replace the core manager/editor/preview architecture
- move AI back into a primary writing pane
- turn the app into a marketing-page layout
- introduce decorative color systems unrelated to state
