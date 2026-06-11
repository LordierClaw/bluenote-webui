# bluenote-webui

Local-first web UI for BlueNote. It is a Node 16.14-compatible TypeScript app with a localhost-only server that wraps `@lordierclaw/bluenote-core`; the browser UI talks to that server over HTTP and does not read BlueNote workspaces directly.

`bluenote-webui` is intended to be behaviorally compatible with the main workflows in `LordierClaw/bluenote-term`: setup/open a BlueNote root, browse notes and drafts, edit Markdown bodies, save/autosave, search, use a Search Everything-style command palette, and surface safe AI status.

## Requirements

- Node `>=16.14 <17` or Node `>=18`
- npm 8 or newer
- A sibling checkout of `LordierClaw/bluenote-core` at `../bluenote-core` for local development and CI until the core package is published/tagged with built artifacts.

## Setup

```bash
# from ../bluenote-core
npm ci --include=dev
npm run build

# from bluenote-webui
npm ci --include=dev
npm run dev
```

The dev server binds locally. The API defaults to `127.0.0.1:4174`; Vite proxies `/api` to it.

For restricted environments, build once and run the single local server; it serves both the API and built UI:

```bash
npm run build
npm run start
```

Then open `http://127.0.0.1:4174`.

## Scripts

```bash
npm run dev        # local API server + Vite UI
npm run build      # TypeScript server build + Vite client build
npm run start      # run built local server, serving API and static UI
npm run typecheck
npm run lint
npm run test
npm run check      # typecheck + lint + test + build
```

## Current status and limitations

- Uses `@lordierclaw/bluenote-core` for root init, note create/list/get/delete/archive/promote, rebuild, and search semantics.
- A small server-side save adapter is used because core does not currently expose a high-level body update API; it still uses core repository helpers and preserves plain Markdown notes plus `.data` metadata layout.
- Workspace selection is process-local to the running local server.
- Folder management and full find/replace are scaffolded for web UI parity but not complete.
- AI endpoint is status-only and masks sensitive values; raw API keys, bearer tokens, provider headers, and `.data/ai/codex-auth.json` are never returned.

## Shortcuts

- `Ctrl+K` / `Cmd+K`: Search Everything / command palette
- `Ctrl+S` / `Cmd+S`: save current note
- Palette supports new note, quick draft, save, archive, delete, rebuild, preview toggle, and note search entries.
