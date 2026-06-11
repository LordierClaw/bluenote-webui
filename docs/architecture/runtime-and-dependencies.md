# Runtime and Dependencies

## Runtime rules

BlueNote WebUI runs as a **local Node server + browser client** application.

- Use the isolated BlueNote Node toolchain for this repo.
- Current required local toolchain:
  - Node `v16.14.2`
  - npm `8.5.0`
- Activate with:

```bash
source ../use-node-16.14.sh
node -v
npm -v
```

Expected binaries:

```text
/home/hainn/.local/share/bluenote-toolchains/node-v16.14.2-linux-x64/bin/node
/home/hainn/.local/share/bluenote-toolchains/node-v16.14.2-linux-x64/bin/npm
```

## Architecture contract

The browser client is **not** the source of truth.

- The local server owns filesystem access.
- The server wraps `@lordierclaw/bluenote-core` behavior.
- The browser talks only to the local API.
- BlueNote note, draft, archive, metadata, search, and AI behavior should remain core-aligned.

This means WebUI should not invent alternative storage rules or filesystem behavior.

## Current baseline dependencies

- `@lordierclaw/bluenote-core` — headless note/storage/search/AI behavior
- React 18 — client UI
- Vite 4 — browser build/dev tooling
- TypeScript — strict typing
- Vitest + Testing Library + jsdom — test stack
- ESLint — linting
- Font Awesome — iconography in the shell

## UI architecture baseline

The current shell is built around:

- `src/client/app/App.tsx` — global state, shell wiring, actions, shortcuts, theme, responsive orchestration
- `src/client/app/useResponsivePanes.ts` — manager/preview responsive visibility rules
- `src/client/components/AppShell.tsx` — shell chrome
- `src/client/components/FolderManager.tsx` — manager explorer
- `src/client/components/EditorPane.tsx` — editor surface
- `src/client/components/PreviewPane.tsx` — markdown preview
- `src/client/components/CommandPalette.tsx` — Search Everything
- `src/client/components/AiWorkspaceDialog.tsx` — AI status/config/auth/queue dialog
- `src/client/components/ActionDialog.tsx` — shared task-box dialog shell
- `src/client/styles/theme.css` — theme tokens, layout, surfaces, dialog styling, responsive polish

## Core-parity rules

- Normal notes remain under `note/`.
- Draft notes remain under `draft/`.
- Note identity and startup selection must stay compatible with canonical core behavior.
- Search semantics should remain aligned with BlueNote behavior.
- AI secrets/auth state must remain server-side and masked.

## Validation expectations

The public repo gate for WebUI changes is:

```bash
source ../use-node-16.14.sh
npm run check
```

That gate must cover:
- typecheck
- lint
- tests
- build

## Cross-repo verification rule

If a change is isolated to `bluenote-webui`, scoped verification in this repo is preferred.

If a change alters behavior shared with `bluenote-core` or `bluenote-term`, also run the corresponding repo checks needed to verify that contract.

## Browser verification rule

For user-facing WebUI changes, console checks alone are insufficient. Use the real browser to verify visible behavior and, when making UX claims, rely on actual screenshots from the running app.
