# @lordierclaw/bluenote-webui

Local-first browser UI for BlueNote. It runs a localhost-only Node server around `@lordierclaw/bluenote-core`; the browser talks to that server over HTTP and does not read BlueNote workspaces directly.

## Role in BlueNote

This repo owns:

- browser UI layout and interaction
- localhost server/proxy behavior
- web setup flow
- WebUI command entrypoint and public command API
- browser-facing integration for core note/search/storage/AI workflows

It does not own core storage/search/AI semantics, terminal UI behavior, or top-level distribution routing.

## Install

For the full BlueNote app, install the distribution CLI first, then install this optional browser client:

```sh
npm install -g @lordierclaw/bluenote
npm install -g @lordierclaw/bluenote-webui
bluenote doctor
```

Start the local daemon through the distribution CLI, then launch the WebUI through the distribution command:

```sh
bluenote daemon start
bluenote web
```

The distribution README is the canonical guide for full app install, uninstall, PATH setup, and optional client verification.

## Local development

Expected sibling checkout layout:

```text
../bluenote-core
../bluenote-webui
../bluenote
```

For source-link app setup:

```sh
cd ../bluenote
npm ci --include=dev
npm run check
npm link

cd ../bluenote-webui
npm ci --include=dev
npm run check
npm link

bluenote doctor
```

For WebUI-only development:

```sh
cd ../bluenote-core
npm ci --include=dev
npm run build

cd ../bluenote-webui
npm ci --include=dev
npm run dev
```

The dev server binds locally. The API defaults to `127.0.0.1:4174`; Vite proxies `/api` to it. For restricted environments, build once and run the single local server:

```sh
npm run build
npm run start
```

Then open `http://127.0.0.1:4174`.

## Scripts

```sh
npm run dev        # local API server + Vite UI
npm run build      # TypeScript server build + Vite client build
npm run start      # run built local server, serving API and static UI
npm run typecheck
npm run lint
npm run test
npm run check      # typecheck + lint + test + build
```

Distribution packages can start the WebUI without importing internal files:

```ts
import { runWebCommand } from "@lordierclaw/bluenote-webui"

await runWebCommand(["--host", "127.0.0.1", "--port", "4174"])
```

## Packaging and versions

The package name is `@lordierclaw/bluenote-webui`. The public executable discovered on `PATH` is `bluenote-webui`.

The package consumes the latest published `@lordierclaw/bluenote-core` through public exports by default. Distribution packages should call the public executable or public command API instead of importing WebUI internals.

Maintainer release flow: publish a GitHub Release for the matching `v*` tag. The release workflow verifies the package first and only then publishes to npm.

## Cross-platform notes

- Runtime target: Node `>=16.14 <17 || >=18`.
- Tooling uses npm, TypeScript, Vite, and the local server build.
- Server and browser UI bind to localhost by default.
- Browser responses must mask secrets; raw API keys, bearer tokens, provider headers, and `.data/ai/*` files are never returned or served.

## Related packages

- `@lordierclaw/bluenote`: official distribution CLI and top-level app command.
- `@lordierclaw/bluenote-core`: shared headless note/search/storage/AI behavior.
- `@lordierclaw/bluenote-term`: terminal/TUI client.
