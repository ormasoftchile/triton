---
name: "dead-code-audit"
description: "Systematic dead-code and unused-export audit for pnpm + TypeScript + ESM monorepos"
domain: "code-quality, maintenance"
confidence: "high"
source: "earned — applied 2026-06-17 on timeline monorepo (packages/core, cli, schema)"
---

## Context

Apply when you need to find unused code, exports, or dependencies in a TypeScript monorepo.
Especially valuable before major refactors or when the codebase has grown quickly (many grammars/modules added in parallel by multiple agents).

Key challenge: distinguishing *true* dead code from *intentional public API* (exported but not internally consumed).

## Patterns

### Step 1 — Establish baseline (don't audit broken code)
```bash
pnpm -C packages/core build       # confirm TypeScript compiles
pnpm -C packages/core typecheck   # confirm no type errors
```

### Step 2 — Run knip (best for monorepos)
```bash
pnpm dlx knip   # from repo root — auto-discovers workspaces, entry points, package.json
```
Knip reports:
- **Unused files** — files not reachable from any entry point
- **Unused exports** — named exports nothing imports
- **Unused exported types** — type-level same
- **Unused dependencies** — package.json deps not imported

No `knip.json` config needed for pnpm workspaces with standard `exports` field.

### Step 3 — Run ESLint for local unused vars
```bash
pnpm -C packages/core lint   # catches unused imports, locals, unreachable args
pnpm -C packages/cli lint
pnpm -C packages/schema lint
```
Key ESLint rules in this project: `@typescript-eslint/no-unused-vars` (errors), `prefer-const`.

### Step 4 — Critical filtering (avoid false positives)

**Public API vs. internal:** The package entry point is `src/index.ts`. Anything exported from a
sub-module but NOT re-exported from `src/index.ts` is NOT public. Check which knip "unused exports"
are actually just internal barrel re-exports.

**Dynamic requires:** `require('pkg')` via `createRequire` is invisible to knip. Always grep for
dynamic usage before declaring a dependency unused.
```bash
grep -rn "createRequire\|require(" packages/core/src/ --include="*.ts"
```

**Used in registry:** A symbol may appear in a theme registry (`'dark-flow': darkFlowTheme`)
and be accessed only via string key at runtime. It's not "dead" even if no import references it.

**Test vs. production:** Knip covers test files. Distinguish unused *test helpers* from unused
*production code* — test cleanup is lower priority.

### Step 5 — Verify each finding with grep
```bash
grep -rn "symbolName" packages/ --include="*.ts" | grep -v "dist/"
```
A symbol is truly dead only if grep returns only its definition line.

## Examples

From the 2026-06-17 audit of this repo:

**True dead — local computation:**
```typescript
// packages/core/src/grammars/architecture/layout.ts:235
const groupById = new Map(doc.groups.map((group) => [group.id, group]));
// groupById is never read after this line — dead computation
```

**True dead — duplicate import:**
```typescript
// architecture/index.ts — these imports are redundant because the re-export
// at lines 26-36 goes directly from ./types.js without needing local bindings
import type { ArchGroup, ArchJunction, ArchService, ArrowType, PortSide } from './types.js';
// ...
export type { ArchGroup, ArchJunction, ... } from './types.js';  // doesn't use the import above
```

**False positive — dynamic require:**
```typescript
// render/skia.ts — knip flags canvaskit-wasm as unused dep, but it's loaded here:
const CanvasKitInit = _require('canvaskit-wasm') as (opts?: any) => Promise<any>;
```

**Intentional public API — not dead:**
Any export from `packages/core/src/index.ts` regardless of internal usage.

## Anti-Patterns

- **Don't remove `canvaskit-wasm` or similar** based solely on knip output — always grep for `createRequire`/dynamic `require` first.
- **Don't remove `*RenderFormat`/`*RenderBackend` types** in bulk — they may be needed by consumers importing sub-paths directly (`@timeline-compiler/core/src/grammars/flow/index.js`).
- **Don't confuse barrel re-exports** (geometry/index.ts re-exporting from primitives.ts) with dead code — the primitives are used; only the barrel re-export is unused.
- **Don't equate "not in core/src/index.ts" with "dead"** — some symbols are intentionally exposed for advanced users or future API surface. Mark as "likely dead / confirm" rather than auto-delete.
- **Do prefix truly-unused callback params with `_`** rather than removing them — parameter position matters in callbacks.
