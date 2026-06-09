# BlueNote Node 16.14 Compatibility Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after user approval. Use TDD/check-first discipline and verify both `bluenote-core` and `bluenote-webui` under Node 16.14 when practical.

**Goal:** Make `bluenote-core` and `bluenote-webui` install, build, test, and run in a restricted environment with Node `16.14.x`, npm, no Docker, while preserving the current local Node server + browser client architecture and BlueNote storage behavior.

**Architecture:** Keep the existing local server model. The browser UI remains a static Vite/React client served by or proxied to a local Node API server. The Node server owns filesystem access and wraps `@lordierclaw/bluenote-core`; this preserves plain Markdown notes, `note/`, `draft/`, `.data/`, archive, literal search, and AI secret isolation. This is not a static browser-only rewrite.

**Tech Stack:** Node `>=16.14 <17` compatibility target, npm 8-compatible package metadata, TypeScript, Vite 4, React 18, Vitest 0.34, jsdom 21/22, ESLint 8, Node-compatible ESM output.

**Hard Gate:** This is a scope and acceptance-criteria change from the previous Node 18 plan. Do not implement until the user approves this plan. This work may require commits in both `/root/code/bluenote-core` and `/root/code/bluenote-webui`.

---

## Decision

The runtime target is **Node 16.14.x**.

Use package engines that communicate this clearly:

```json
"engines": {
  "node": ">=16.14 <17 || >=18"
}
```

Rationale:

- The restricted environment needs Node 16.14.
- We should not block newer Node runtimes.
- CI should explicitly include Node `16.14.x`; Node 18 can remain as a second matrix entry if desired.

Use an npm version compatible with Node 16.14:

```json
"packageManager": "npm@8.5.0"
```

`npm@8.5.0` supports `^12.13.0 || ^14.15.0 || >=16`, so it fits Node 16.14.

---

## Compatibility Constraints

Node 16.14 supports many modern features, but the downgrade must avoid Node 18-only tooling/runtime assumptions.

Known required changes:

- Replace `npm@10.8.2` package metadata with npm 8-compatible metadata.
- Replace `vite@5` with `vite@4.5.x`.
- Replace `vitest@1.x` with `vitest@0.34.x`.
- Replace `tsx@4.x` with `tsx@3.x`.
- Replace `jsdom@24` with `jsdom@21.x` or `22.x`.
- Check TypeScript `target`/`lib` settings; avoid emitting syntax Node 16.14 cannot run.
- Verify Node ESM/top-level-await behavior in `bluenote-core`, especially `sql.js` initialization.
- Check uses of newer JS built-ins and either verify Node 16.14 support or replace them.

Potential source-level audit targets:

- `Array.prototype.at()`
- `String.prototype.replaceAll()`
- `crypto.randomUUID()`
- top-level `await`
- `import.meta.url`
- `node:` imports
- `fs.rmSync`
- `structuredClone`
- Web/global APIs such as `fetch`, `File`, `Blob`, `ReadableStream`

Current observed notes:

- `bluenote-core` uses `crypto.randomUUID()` and at least one `.at(-1)`. These need Node 16.14 verification.
- `bluenote-core` TypeScript config currently targets `ES2022`.
- `bluenote-webui` TypeScript configs currently target `ES2022`.

---

## Task 1: Prepare Node 16.14 Verification Harness

**Objective:** Ensure we can actually verify compatibility against Node 16.14, not just edit package metadata.

**Files:**
- No production file changes initially.
- Possible helper script if needed: `scripts/check-node-version.mjs` in each repo.

**Steps:**
1. Determine whether Node 16.14 is available locally via `node16`, `nvm`, `volta`, or downloaded tarball.
2. If local active Node is not 16.14, create a temporary local verification toolchain using an official Node 16.14.x tarball or available version manager.
3. Record the exact Node/npm versions used for verification.

**Verification:**

```bash
node --version
npm --version
```

Expected Node version: `v16.14.x`.

---

## Task 2: Downgrade `bluenote-core` Metadata and Tooling

**Objective:** Make core package metadata and dev tooling honest for Node 16.14.

**Files:**
- Modify: `/root/code/bluenote-core/package.json`
- Modify: `/root/code/bluenote-core/package-lock.json`
- Possibly modify: `/root/code/bluenote-core/tsconfig.json`
- Possibly modify: `/root/code/bluenote-core/tsconfig.build.json`

**Steps:**
1. Set `packageManager` to `npm@8.5.0` or compatible npm 8.
2. Set `engines.node` to `>=16.14 <17 || >=18`.
3. Keep runtime dependencies if compatible:
   - `js-yaml@4.1.1`
   - `minisearch@6.3.0`
   - `sql.js@1.10.3`
4. Verify dev dependencies support Node 16.14:
   - `typescript@5.x` is likely okay.
   - `tsx@4.x` must likely downgrade to `tsx@3.x`.
   - `@types/node` can remain at Node 18 types only if APIs are not Node 18-only, but prefer Node 16 types for accuracy.
5. Regenerate lockfile under Node/npm compatible with Node 16.14.

**Verification:**

```bash
cd /root/code/bluenote-core
npm ci
npm run typecheck
npm run build
npm run test
npm run check
```

Run under Node 16.14 if available.

---

## Task 3: Fix `bluenote-core` Runtime Compatibility Issues

**Objective:** Remove or downlevel source/runtime features that fail on Node 16.14.

**Files:**
- Modify only files surfaced by actual Node 16.14 failures or audit.
- Likely candidates:
  - `src/storage/note-repository.ts`
  - `src/platform/ids.ts`
  - `src/index/index-store.ts`

**TDD Steps:**
1. Run the failing core command under Node 16.14.
2. Add or identify a focused test that fails for the compatibility issue.
3. Patch source minimally.
4. Rerun targeted test.
5. Rerun `npm run check`.

**Examples:**

If `.at(-1)` causes an issue or is deemed too risky, replace with an explicit helper:

```ts
function last<T>(items: T[]): T | undefined {
  return items.length === 0 ? undefined : items[items.length - 1]
}
```

If `crypto.randomUUID()` is unavailable in the exact runtime, add a Node 16-safe fallback using `randomBytes`.

---

## Task 4: Downgrade `bluenote-webui` Metadata and Tooling

**Objective:** Make the web UI install/build/test under Node 16.14.

**Files:**
- Modify: `/root/code/bluenote-webui/package.json`
- Modify: `/root/code/bluenote-webui/package-lock.json`
- Modify: `/root/code/bluenote-webui/tsconfig.json`
- Modify: `/root/code/bluenote-webui/tsconfig.node.json`
- Modify: `/root/code/bluenote-webui/vite.config.ts` if needed
- Modify: `/root/code/bluenote-webui/vitest.config.ts` if needed

**Package changes:**

Set:

```json
"packageManager": "npm@8.5.0",
"engines": {
  "node": ">=16.14 <17 || >=18"
}
```

Use Node 16-compatible tooling:

```json
"devDependencies": {
  "vite": "4.5.x",
  "vitest": "0.34.x",
  "jsdom": "21.x or 22.x",
  "tsx": "3.x",
  "eslint": "8.x",
  "typescript": "5.x"
}
```

Keep React 18.

**Verification:**

```bash
cd /root/code/bluenote-webui
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

---

## Task 5: Make Production Start Serve API and Built Client

**Objective:** Restricted users should run one local Node 16 process after build.

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/server/services/http.ts` or add static asset serving helper
- Modify: `README.md`
- Test: add/modify server smoke tests

**Behavior:**

After:

```bash
npm ci
npm run build
npm run start
```

User opens:

```text
http://127.0.0.1:4174
```

The same server should serve:

- API routes under `/api/*`
- built client assets from `dist/client`
- SPA fallback to `dist/client/index.html` for non-API routes

**Security:**

- Never serve files from the BlueNote workspace.
- Never serve `.data` from a workspace.
- Only serve static assets from the build output directory.
- Preserve localhost bind by default.

**Verification:**

```bash
npm run build
PORT=4191 npm run start
curl http://127.0.0.1:4191/api/health
curl http://127.0.0.1:4191/
```

Expected:

- `/api/health` returns JSON health.
- `/` returns built HTML.

---

## Task 6: Update CI to Prove Node 16.14 Compatibility

**Objective:** CI must enforce the restricted runtime target.

**Files:**
- Modify: `/root/code/bluenote-webui/.github/workflows/check.yml`
- If core has CI, modify core workflow too or document separate core verification.

**Workflow:**

Use Node `16.14.x` explicitly. Optionally matrix with Node 18 as a non-blocking or second required version.

```yaml
strategy:
  matrix:
    node-version: [16.14.2]
```

CI steps:

1. Check out `bluenote-core` sibling.
2. Set up Node 16.14.2.
3. Build/check core.
4. Install/check web UI.
5. Run `npm run check`.

---

## Task 7: Documentation Update

**Objective:** Keep README concise and honest for restricted Node 16 users.

**Files:**
- Modify: `/root/code/bluenote-webui/README.md`
- Possibly modify: `/root/code/bluenote-core/README.md`

**README should say:**

- Node `16.14+` supported for restricted environments.
- Node 18+ still recommended when available.
- No Docker required.
- Build/start commands.
- Local server serves API and UI.
- Browser opens localhost URL.
- Storage remains local and compatible with `bluenote-term`.

---

## Task 8: Final Verification, Review, Commit, Push

**Objective:** Land verified compatibility changes cleanly.

**Commands:**

Core:

```bash
cd /root/code/bluenote-core
npm run check
```

Web UI:

```bash
cd /root/code/bluenote-webui
npm run check
npm run build
PORT=4191 npm run start
```

Smoke:

```bash
curl http://127.0.0.1:4191/api/health
curl http://127.0.0.1:4191/
```

Review:

```bash
git status --short --branch
git diff --stat
git diff --check
```

Commit messages:

For core, if changed:

```text
chore: support node 16.14
```

For web UI:

```text
chore: support node 16.14
```

Push to `main` after all checks pass.

---

## Open Questions Before Implementation

1. Should the engine allow newer Node too (`>=16.14 <17 || >=18`) or strictly require only Node 16 (`>=16.14 <17`)? Recommendation: allow newer Node too.
2. Should CI test only Node 16.14.2 or both 16.14.2 and 18.x? Recommendation: both, with 16.14.2 mandatory.
3. Should we commit the previous static File System Access plan? Recommendation: no; it was removed from the working tree because the selected direction changed.

---

## Approval Gate

This plan is ready for approval. After approval, start with Task 1: obtain/verify a Node 16.14 runtime, then proceed repo-by-repo with checks under that runtime.
