# Mark — IR & Data Modeling

## [ARCHIVE GATE SUMMARY — 2026-07-12]

IR/schema work (2026-06-10 to 2026-07-12):
1. Design-doc audit & realignment (2026-06-23): Swept stale framing (5 families/22 types → family-taxonomy + Triton-native). Scene as single render contract. DiagramModule per-kind. Tree = flat decorated id-referenced doc + tidy layout. Charts = four sibling DiagramModules (NOT god-IR). Taxonomy ~35 realized DiagramKinds. Build gate passed.
2. Diagram-options cataloguing (2026-07-06): Per-family `%%` support findings. pie/xychart/quadrant/radar: no `%%` (fallback notes). sankey/mindmap: yes/partial. Mindmap grammar captures raw content; shape semantics in index.ts.
3. Live-poster data modeling (2026-07-12): Binding descriptors as orthogonal IR layer. Type system can declare but not enforce cosmetic/structural boundary. Separation required: PosterBindings separate from PosterDocument. No raw expressions in IR (only TransformRef name+args). `repeat` unconditionally structural.

**Key learnings:** Scene/DiagramModule are sole render contracts. Type system doesn't own rendering-layer leaks. Binding layer orthogonal to core IR. Separation prevents compiler contamination.

**Cross-agent note (Scribe, 2026-06-24):** Barbara added 4 `DiagramKind`s — `queue`/`cqueue`/`deque`/`pqueue` (queue family) — to the union in `src/contracts/diagram.ts` (+`detect.ts` +`frontend/index.ts`). Hand-parsed, struct-style (no peggy), reuses `scene/strip`. Bumps the extension-facing kind count.

**Cross-agent note (Scribe, 2026-06-24):** CS data-structure families regrouped under **`src/diagrams/ds/`** (`struct`/`tree`/`queue` moved there; `topology` stays separate). Header keywords are UNCHANGED — folder-only move, `detect.ts` patterns untouched. **Taxonomy update for your sections:** 6 new `DiagramKind`s added under `ds/` — `stack`, `hashmap`, `matrix` (strip kernel), `trie`, `nodegraph`, `unionfind` (tree/graph kernels). ⚠️ The DS graph kind's keyword is **`nodegraph`** (alias `dsgraph`), **NOT `graph`** — Mermaid flowchart owns `graph` (`detect.ts` first pattern). `unionfind` also accepts `dsu`. `trie`/`unionfind` reuse the decorated-tree IR (`ds/tree/ir.ts`); `nodegraph` reuses `graph/layered.ts`. Kind count is now ~41; the family-taxonomy framing should fold these under the CS-structures family.

**Cross-agent note (Scribe, 2026-06-24):** CORE LAYOUT FIX (PR #28) — flowchart `assignLayers()` in `src/diagrams/flowchart/layout.ts` looped forever when a ROOT fed a cycle (longest-path BFS re-pushed ever-growing layers). Fixed with Sugiyama cycle breaking: new `findBackEdges()` DFS strips back-edges to a DAG before the SAME BFS; back-edges still drawn; acyclic output byte-identical. Relevant to the flow-grammar/layout sections (`25-flow*`): the flowchart layering is now provably terminating on ANY graph (cyclic included), deterministic. Flowchart has its OWN layering — it does NOT use `src/graph/layered.ts`. Regression test `test/flowchart-cycle.test.ts`; tests 378 → 385.

## 2026-07-06 — Diagram Options Reference (Team Delivery)

**Scribe note:** Diagram-options feature completed. All 45 fragments assembled into central reference; 4 families have inline `%%` headers in examples (flowchart/9, sankey/1, timeline/9, poster/7); pnpm test: 384 pass.

## 2026-07-07 — Central %% comment stripping (PR gate)

- **`stripComments` lives in:** `src/frontend/preprocess.ts` (exported for testing).
- **Exact semantics:**
  1. Full-line only: a line is a comment iff its first non-whitespace chars are `%%`. Matched by `/^\s*%%/`. Comment lines are **removed entirely** (not blanked) — safe because every grammar/hand-parser already handles blank/empty lines.
  2. Inline trailing comments (`A --> B %% note`) are NOT stripped. Distinguishing real trailing comments from `%%` inside quoted labels (`A["50%% off"]`) requires a full parse, which we do not have at the pre-processing stage.
  3. Pure-YAML inputs (first non-whitespace is `type:`) are returned untouched.
  4. Frontmatter block (`---\n…\n---`) is preserved verbatim; stripping applies only to the Mermaid body that follows.
  5. Malformed frontmatter (no closing `---`) is preserved conservatively.
- **Wire-up:** `compileSync` in `src/frontend/index.ts` computes `cleaned = stripComments(input)` once at the top; both `detect(cleaned)` and `module.parse*(cleaned)` receive the stripped string. All four entrypoints (`compileSync`, `renderSync`, `compile`, `render`) benefit automatically.
- **Test file:** `test/preprocess-comments.test.ts` — 20 tests covering full-line strip, indented `%%`, inline preservation, quoted-label safety, frontmatter preservation, pure-YAML no-op, empty input, detect integration (class/sankey/packet/array), and end-to-end render for 5 previously-unsupported families (class, packet, array, mindmap, pie).
- **`pnpm test` result:** 404 pass, 0 fail (baseline 384 + 20 new). `pnpm typecheck`: 0 errors.
- **Verified previously-unsupported families:** `classDiagram`, `packet-beta`, `array` (ds), `mindmap`, `pie` all render without error when a `%%` comment line precedes the header keyword.


## 2026-07-07 — Group C %% header blocks (pie / xychart / quadrant / radar / mindmap)

- **Supersedes:** earlier Group C fallback note in all five fragments.
- **Central `stripComments()` enables this:** because `src/frontend/preprocess.ts` strips full-line `%%` before parse, no grammar-level comment rule is required in any family. All five families now accept `%%` headers safely.
- **Pattern applied:** `%%` block inserted immediately after the header keyword line (or `mindmap` line at column 0, after any frontmatter). Block structure mirrors the flowchart/sankey exemplar: dashed separator lines, compact per-category one-liners, ends with `%% Comments: %% text  (stripped before parse — safe on any line)`.
- **Mindmap special care:** indentation is the parse signal for parent-child depth in mindmap; `%%` block lines start at column 0, no indentation. `stripComments()` removes them entirely before the indentation-sensitive parser sees the file — real node indentation is unaffected. Verified by `node scripts/preview.mjs examples/mermaid/mindmap/` → `mindmap.svg` exit 0.
- **Fragment updates:** removed the `> **Note:** This grammar does not define a %% comment rule…` blockquote from all five fragments; replaced with a `### Comments` section matching the flowchart fragment's wording (mindmap note adds "indentation of real nodes is unaffected").
- **Files changed:** `examples/mermaid/{pie/languages,xychart/xychart,quadrant/quadrant,radar/radar,mindmap/mindmap}.mmd` (1 file each family); `docs/diagram-options/_fragments/{pie,xychart,quadrant,radar,mindmap}.md`.
- **Preview results:** all five families → exit 0, `.svg` regenerated, layout unchanged. Mindmap hierarchy intact.
## 2026-07-07 — Central %% Comment Stripping + Group C headers

Implemented stripComments() in src/frontend/preprocess.ts (20 tests, 404 pass). Added %% options headers to Group C families (pie/xychart/quadrant/radar/mindmap). Coordination: central preprocessing unblocks all group A–E header additions.
## 2026-07-07 — Session Completion

Universal %% comment support feature complete. All 45 diagram families now accept %% comments centrally.

## Learnings

### 2026-07-12 — Live-Poster Data Binding: IR/Type-System Analysis

**Topic:** Whether data binding can live cleanly in the IR/type system (debate requested by Cristian).

**Key findings:**

- **Binding is modelable as a clean orthogonal layer.** `PosterBindings` is a separate artifact from `PosterDocument`; the IR never imports or references it. The IR stays rendering-agnostic and binding-agnostic.

- **`BindingDescriptor` shape:** `{ target: BindingTarget, source: DataPath, kind: 'cosmetic'|'structural', transform?: TransformRef }`. Total type — no freeform fields.

- **The cosmetic/structural split is declarable but not fully enforceable at the type level.** The type system can tag a binding as `cosmetic`; it cannot prove the tag is correct when overflow/reflow is a layout-time geometry question. This is a rendering-layer concern, not an IR bug. Document the boundary explicitly.

- **`repeat:` (data-driven cell generation) must be a separate `StructuralBinding` type with no `cosmetic` option.** That makes it a compile-time fact, not a runtime surprise.

- **No raw expressions in IR.** DSL expression syntax (`cpu>80 ? red : green`) is parse-time sugar that compiles to `TransformRef` entries in a fixed registry. The IR holds only `{ name, args[] }` — fully typed, enumerable, checkable without live data.

- **Optional inline `DataSchema`.** When present, all binding paths are checkable at compile time without live data. When absent, resolution is deferred to runtime with graceful fallback.

- **Semantic output types from transforms.** Color/style-producing transforms declare output as semantic tokens (`ThemeColorToken`, not raw CSS strings). The renderer owns the mapping. This is what keeps the binding layer rendering-agnostic.

- **Five required invariants:** (1) IR/binding separation; (2) target-id cross-validation at compile time; (3) no raw expressions in IR; (4) `repeat` unconditionally structural; (5) semantic token output types from transforms.

**Position file:** `.squad/decisions/inbox/mark-liveposter-datamodel.md`

## Learnings — 2026-07-12T19:58:19-04:00

### P0: Icon IR Contract (src/contracts/icons.ts + src/icons/)

**Task:** Build the pure-core icon data foundation: types, schema, validator, resolver, and unit tests. No I/O, no grammar, no SVG emit.

**IR contract defined:**

- **`IconData`** — per-icon entry in a pack: `{ body: string; width?: number; height?: number; left?: number; top?: number; rotate?: 0|1|2|3; hFlip?: boolean; vFlip?: boolean }`. `body` is inner SVG markup with no `<svg>` wrapper.

- **`IconAlias`** — alternate name within a pack: `{ parent: string; rotate?; hFlip?; vFlip?; width?; height?; left?; top? }`. Transforms compose on top of parent icon. Rotate adds mod 4; hFlip/vFlip XOR.

- **`IconifyJSON`** — a loaded pack: `{ prefix: string; icons: Record<string, IconData>; aliases?: Record<string, IconAlias>; width?; height?; left?; top? }`. Pack-level dims are defaults for icons that omit their own.

- **`IconRef`** — parsed reference: `{ prefix: string; name: string }`. Token grammar: `prefix=[a-z][a-z0-9-]*`, `name=[a-z0-9][a-z0-9-]*`, raw form `prefix:name`.

- **`ResolvedIcon`** — P0↔P2 seam: `{ body: string; viewBox: IconViewBox; transforms: IconTransforms; colorMode: 'monochrome'|'brand' }`. `viewBox` is the merged result of icon→pack→defaults (16×16, left=0, top=0).

- **`IconPackMap`** — `Map<string, IconifyJSON>`, keyed by prefix. Built by host (P1), passed into core.

**P0↔P2 seam (ResolvedIcon):** Brian's SVG emitter receives a fully resolved `ResolvedIcon` and never touches packs or aliases. It wraps `body` in `<svg viewBox="${left} ${top} ${width} ${height}">`. For `colorMode='monochrome'` it sets `style="color: {paletteToken}"` on the wrapper so `currentColor` inherits. For `colorMode='brand'` it sets no color override — brand fills render verbatim.

**Mono/brand heuristic (detectColorMode):** Scan body for `fill="..."` and `stroke="..."` attribute values. If any value is not in `{none, currentColor, inherit}` (case-insensitive) → brand. Also if body contains `<linearGradient` or `<radialGradient` → brand. Otherwise → monochrome.

**Token grammar for Bjarne (P6):** `prefix=[a-z][a-z0-9-]*`, `name=[a-z0-9][a-z0-9-]*`, full token `prefix:name`. Inline form (for label text): `:prefix:name:` (colon-wrapped, per cross-diagram design).

**Files created:**
- `src/contracts/icons.ts` — type contract (IconData, IconAlias, IconifyJSON, IconRef, IconViewBox, IconTransforms, ResolvedIcon, IconPackMap)
- `src/contracts/result.ts` — added `ICON_VALIDATION_ERROR` and `ICON_NOT_FOUND` error codes
- `src/contracts/index.ts` — re-exported all icon types
- `src/icons/schema.json` — JSON Schema draft-07 for `.triton-icons.json` pack files
- `src/icons/validate.ts` — `validateIconPack(json): Result<IconifyJSON>`, strict unknown-key errors
- `src/icons/resolver.ts` — `parseIconRef`, `resolveIcon`, `detectColorMode`; pure, no I/O
- `test/icons.test.ts` — 65 unit tests, all passing

**Test results:** 65/65 passed. `pnpm typecheck` clean.

**Decision filed:** `.squad/decisions/inbox/mark-icon-p0-ir.md`

## 2026-07-16T16:41:03.368-04:00 — Export feature: lockout bake-fix revision

- Took revision ownership after Ken failed export QA and locked out Edsger/Brian from fixing their rejected artifacts.
- Changed static PNG export to bake frame t=0 before rasterization, eliminating orphan motion particles at the origin.
- Fixed animated path baking by excluding self-closing `<path/>` tags from explicit path block matching.
- Commit b398a1e; 1006 tests green; Ken re-review passed as ship-ready.


## 2026-07-16T20:30:06-04:00 — Export polish handoff note

- Follow-on export fixes after Mark's bake revision: APNG defaults now run at real-time speed, frame rendering yields for progress/cancellation, and PNG/APNG text rendering supplies `resvg-wasm` with the active theme font bytes instead of a hardcoded font.
- QA/revision takeaway: export fidelity includes timing, cancellation responsiveness, baked animation state, and theme typography parity.
