# WebUI Verification Workflow

BlueNote WebUI changes should be verified as a product, not just as code.

## Baseline repo gate

Run from `bluenote-webui/`:

```bash
source ../use-node-16.14.sh
npm run check
```

Expected gate:
- typecheck passes
- lint passes
- tests pass
- build passes

## Scoped verification rule

If only `bluenote-webui` changed, keep verification scoped to this repo.

If the change depends on `bluenote-core` or `bluenote-term` behavior, run the corresponding repo checks needed to verify the shared contract.

## Browser verification rule

For user-facing WebUI work, do not stop at tests.

Use the running browser app to verify:
- visible layout hierarchy
- keyboard and click entrypoints for major flows
- theme persistence if touched
- responsive behavior if touched
- browser console stays free of JS/runtime errors

## Required UX verification for major shell changes

At minimum, verify these in the real browser when relevant:
- manager is smaller than editor/preview
- editor and preview read as peers
- manager auto-hides before preview
- Search Everything opens from `Ctrl/Cmd+K`
- draft promotion remains valid across reload/startup
- dialogs/task boxes are usable
- dark mode and light mode both look intentional

## Screenshot-backed rating rule

If you claim the UI is polished, improved, balanced, premium, cleaner, calmer, or otherwise better, support that claim with actual screenshots from the running app and rate the important regions from a user POV.

Suggested region ratings:
- top bar
- manager
- editor
- preview
- overlay/dialog state
- responsive narrow state

## Honest reporting rule

Do not claim “no bugs” unless you actually exercised the relevant flows. Report:
- what was tested
- what passed
- what remains uncertain
- any known screenshot/tooling caveats

## Common critical flows

These are high-value browser checks after shell or behavior changes:
- create draft
- promote draft to normal note
- reload and confirm startup selection still resolves cleanly
- open Search Everything via keyboard and click
- toggle themes and reload
- open AI dialog and confirm small-screen usability
- hide/restore manager/preview through responsive states
