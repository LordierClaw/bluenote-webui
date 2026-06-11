# bluenote-webui Agent Guide

## Role

`bluenote-webui` is the local web UI client for BlueNote.

## Owns

- browser UI and layout
- localhost-only web server/API/proxy for the web client
- web setup/open-root flow
- browser command palette and web presentation of core state

## Does not own

- core note model, storage layout, search semantics, or AI semantics
- terminal/TUI/OpenTUI behavior or keybindings
- official distribution CLI command routing/help/version/doctor
- sync/server/cloud features without cross-repo design first

## Runtime compatibility

Must remain compatible with Node `>=16.14 <17 || >=18` and npm.

## Public API/export rules

- Consume `@lordierclaw/bluenote-core` through public package exports only.
- Do not import core `src/*`, generated `dist/*`, tests, or sibling internals.
- Expose reusable web command/server APIs through public entrypoints when the distribution repo needs them.

## Dependency rules

- Should use core public APIs for storage, search, and AI behavior.
- Must not duplicate core storage/search/AI logic in browser or server code.
- Must not require core to depend on web UI code.

## Read first

1. Parent `.agent/CURRENT_TASK.md` when working from the parent workspace.
2. Parent `AGENTS.md`.
3. `../bluenote/AGENTS.md` and `../bluenote/docs/*` for cross-repo rules.
4. This file.
5. `README.md`, `ANALYSIS.md`, and relevant `docs/plans/*`.

Older analysis/plan docs are historical unless the active task references them.

## Common tasks

- Browser UI/local server/setup flow: edit this repo.
- Core storage/search/AI behavior: edit `bluenote-core` first.
- Terminal UX: edit `bluenote-term`.
- Distribution command routing: edit `bluenote`.

## Checks

- Docs-only: `git status` plus file inspection.
- Runtime changes: `npm run check` or narrower `npm run typecheck`, `npm run lint`, `npm run test`.

## Documentation update rule

Update README/docs when setup flow, local server behavior, runtime compatibility, public web command APIs, or workflow changes. Do not overwrite historical planning docs.
