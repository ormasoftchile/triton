# Leslie — Spec Architect

## [ARCHIVE GATE SUMMARY — 2026-07-12]

Recent work (2026-06-14 to 2026-07-12):
1. Diagram-options reference format (2026-07-06): Fragment-first spec. `%%` placement after header keyword line, per-grammar support check.
2. Layout algorithm initiative phase plan (2026-06-27): Static dispatch for algorithm selection (no adaptive). Performance fallbacks deferred.
3. Connector syntax redesign analysis (2026-07-12): Strict Mermaid superset (REVISED v2 — user corrected "no divergence" to "extensions allowed"). 15-token matrix (9 Mermaid-honored, 6 Triton extensions: -_-> for dashed, -~-> for wavy). Cristian approved all recommendations (2026-07-12T09:40-04:00).
4. Live-poster scope ruling (2026-07-12): PROCEED with hard boundary. Compiler stays pure. One-way dependency (runtime → compiler). Defer `repeat:` to Phase 2. Binding-map as JSON sidecar.

**Key learnings:** Fragment parallelization avoids merge conflicts. Static dispatch keeps determinism. Compiler purity non-negotiable. Cosmetic bindings in v1; structural deferred.

- **Five phases:** (0) Research & catalog (David/Scribe), (1) Flowchart full Sugiyama upgrade (Barbara), (2) Shared layered.ts kernel upgrade (Barbara), (3) Simple diagrams audit (Barbara), (4) Poster cross-diagram routing deep work (Barbara + Leslie review), (5) Design doc consolidation (Scribe/Leslie).

- **Flowchart needs Brandes–Köpf + barycenter** — the current implementation has its own layering (with cycle breaking from PR #28) but has no crossing minimization and no proper coordinate assignment. This is Phase 1's sole job. Phase 2 generalizes those gains into `src/graph/layered.ts` for class/state/er/c4/block/requirement/ds/nodegraph.

- **Poster gets its own dedicated phase (Phase 4)** because cross-diagram routing is fundamentally different: heterogeneous obstacle set, coordinate-space transforms per cell, global port-clustering on shared walls. engine3.ts (1073 lines) already sophisticated but aesthetic score is MEDIOCRE (0.649); Phase 4 targets GOOD (≥ 0.75).

- **Visual verification workflow defined:** `node scripts/preview.mjs examples/<type>/` → open SVGs; 7-point visual checklist (no overlaps, crossings minimized, labels readable, spacing consistent, direction respected, cycles clean, poster-specific connector separation). `pnpm test` green is a hard gate throughout.

- **Out of scope:** elk.js/dagre-D3/d3-force as runtime dependencies (catalog only, internal TS implementations); adaptive algorithm switching; force-directed layout; new diagram kinds.

- **Top risk:** engine3 cost weights are calibrated to current (suboptimal) layouts — Phase 4 must not allow any poster to degrade below its current aesthetic score while improving the overall target.

- **Design doc:** new `design/sections/10-layout-algorithms.tex` (Phase 0 draft → Phase 5 final); `design/sections/04-kernels.tex` updated for full Sugiyama after Phase 2; `design/sections/06-composition.tex` updated for engine3 architecture after Phase 4.

---

### Diagram-Options Assembly — P3 Complete (2026-07-06)

**Final deliverable assembled and verified.**


## Learnings

- **Final doc path:** `docs/diagram-options.md` — 69 749 bytes, 45 family sections.
- **Assembly order:**
  1. Top title + 3-sentence intro (what the doc is, grammar-derived options, which 4 families carry `%%` example headers).
  2. Grouped TOC (Mermaid / Triton / DS).
  3. Body under three `#`-level group headings:
     - **Mermaid Diagrams** — `flowchart` first, then 17 others alphabetically.
     - **Triton Diagrams** — architecture, block, packet, poster, topology.
     - **Data-Structure (DS) Diagrams** — 22 subkinds alphabetically.
  4. Fragment `##` headings kept as-is; group headings use `#` — no level clashes.
- **`pnpm test` result:** ✅ PASS — 384 tests, 30 test files, 0 failures. All 69 examples in the corpus rendered correctly; no `%%` header broke any family's parse.
- **Inline `%%` example headers present in:** flowchart (3 files), sankey (1 file), timeline (8 files), poster (6 files) — 18 `.mmd` files total plus their re-rendered `.svg` pairs.
- **Unexpected git change noted:** `fix_poster_headers.py` (leftover scratch script from a sub-agent) and `examples/triton/ds/array/array.svg` (new untracked SVG) appeared in `git status`; both are untracked, not committed, and do not affect the test corpus.


## 2026-07-06 — Diagram Options Reference (Team Delivery)

**Scribe note:** Diagram-options feature completed. All 45 fragments assembled into central reference; 4 families have inline `%%` headers in examples (flowchart/9, sankey/1, timeline/9, poster/7); pnpm test: 384 pass.

### Central-stripping + Universal Headers — Final Assembly (2026-07-07)

**Central `stripComments()` preprocessor shipped (`src/frontend/preprocess.ts`):** strips full-line `%%` comment lines before any parser runs, for every diagram family. This eliminated the per-family comment-safety check and made `%%` support unconditional and universal.

**All 45 fragments updated:** every fragment's former "fallback" note (warning that `%%` was unsupported) was replaced with a `### Comments` section documenting that `%%` lines are stripped centrally. No exceptions.

**60 of 68 `.mmd` example files** now carry inline options-header blocks. The 8 without are special complex poster variants (cross-link, showcase, animated) where the header would be ambiguous inside nested cells.

**`docs/diagram-options.md` re-assembled (2879 lines, 45 family sections):** intro rewritten to 4 sentences stating `%%` support is universal (central `src/frontend/preprocess.ts`), that comment lines may appear anywhere including before the header keyword, and that nearly every example carries a visible options-header block.

**Final `pnpm test` result:** ✅ 404 tests, 31 test files, 0 failures (includes 20 new `preprocess-comments` tests and 69-example render corpus). `pnpm typecheck` ✅ 0 errors.
## 2026-07-07 — diagram-options Final Assembly

Reassembled docs/diagram-options.md (2879 lines, 45 families). Updated intro to explain central comment support. Verified pnpm test (404 pass, 0 fail) + typecheck (0 errors). Feature complete: all 45 families support %% comments; 60/68 examples carry headers.

---

## 2026-07-10 — Poster Replication Capability Analysis

**Task:** Analyze two algomaster.io reference posters (DSA 15 Patterns, Load Balancing Algorithms) to assess what Triton can replicate today vs. what needs adding.

**Deliverable:** `.squad/decisions/inbox/leslie-poster-capability-analysis.md`

### Key Findings

1. **Composition skeleton is solid:** `poster` keyword already supports titled grid of cells with embedded sub-diagrams, per-cell themes, cross-links with animations. No architectural gap.

2. **DSA Poster (15 cards):**
   - 0 fully replicable, 14 partial, 1 impossible (Overlapping Intervals — no interval-bar primitive)
   - Main gaps: per-cell highlight in array/matrix, annotation overlays, path-highlight on trees, caption slot

3. **Load Balancing Poster (6 cards):**
   - 0 fully replicable, 5 partial, 1 impossible (Consistent Hashing — no hash-ring primitive)
   - Main gaps: per-node annotation labels, edge-active animation cycling, hash-ring layout

4. **Prioritised roadmap:**
   - Phase 1 (quick wins): per-cell highlight, caption slot, annotation overlay, edge highlight
   - Phase 2 (new primitives): interval bar, hash ring
   - Phase 3 (animation): frame-sequence (advised against for determinism reasons)

5. **Advised AGAINST:** pixel-perfect replication (diminishing returns), multi-frame animation (violates determinism contract), new `table` primitive (extend `matrix` instead).

### Learnings

- Triton's DS primitives (array, matrix, stack, heap, tree, nodegraph) cover ~90% of educational algorithm visualisation needs structurally. The gap is annotation/highlight modifiers, not missing shapes.
- Cross-link animation system (march, glow, particle, etc.) is already rich; extending it to intra-diagram edges is a small scope.
- Hash-ring is genuinely missing and would require a new layout algorithm (circular node placement around circumference).

---

## 2026-07-12 — Strict Mermaid Connector Syntax Analysis

**Task:** Analyze design implications of aligning all Triton connector syntax to upstream Mermaid, moving animation to decorators, and resolving the `-.->` dotted-vs-dashed incoherence.

**Deliverable:** `.squad/decisions/inbox/leslie-connector-strict-mermaid.md`

### Key Findings

1. **`-.->` conflict is the crux:** Poster grammar says dashed, Mermaid says dotted, flowchart grammar says dotted. Strict alignment means `-.->` = dotted everywhere. "Dashed" as a distinct style has no Mermaid token and either dies or becomes decorator-only (`{ style: dashed }`). Recommended Option A (drop dashed) unless visual need is demonstrated.

2. **Three invented tokens must retire:** `..>`, `...`, `<..>` have no Mermaid basis. Only one example file uses `<..>` in an actual link statement (`complex.mmd:31`). Migration is minimal.

3. **Auto-march coupling is a layer violation:** render.ts:136-140, engine3.ts:188-191, engine2.ts:274-277 all infer animation from line style. Fix is mechanical: remove the `dash ? 'march' : undefined` branch. ~8 example links lose animation; authors add `@anim:march` explicitly.

4. **`@anim:X` fits the existing `@` annotation namespace:** `@` already owns routing annotations. Adding `@anim:` as a second annotation family is clean. Recommended: `@` handles typed finite-vocabulary annotations (routing, animation); `{ }` PropBlock handles parameterized overrides (tension, color). `@` takes precedence on conflict.

5. **Thick (`==>`) should enter the IR as first-class style.** Rendering is mechanical (stroke-width change). Endpoint markers (`--o`/`--x`) should parse-and-collapse for now but the IR should carry intent.

6. **Two-grammar unification not recommended at grammar level.** PEG is monolithic. Better: shared TypeScript token→style mapping table validated by tests from both grammars.

7. **Six open questions flagged for Cristian's decision** — dashed survival, thick as IR value, endpoint marker scope, `@`+`{ }` merge rule, external user impact, flowchart sync/async kind fate.

### Learnings

- Mermaid's visual style vocabulary is exactly three: solid, dotted, thick. No dashed. Triton's four-style model (solid, dashed, dotted, thick) is a superset that must be justified or trimmed.
- The auto-march coupling (style→animation inference) exists in three independent render paths (render.ts, engine2.ts, engine3.ts). All three must be updated atomically.
- PEG grammars don't support cross-file rule imports; consistency between grammars must be enforced via shared test fixtures or TypeScript constants, not grammar-level sharing.
- The `@` annotation namespace is extensible by family prefix (e.g., `@anim:`, `@route:`). Current `@orthogonal` is implicitly `@route:orthogonal` — formalizing the prefix would make the grammar more regular.

## Learnings

### Connector Syntax — Superset Rule Revision (2026-07-12)

Revised the connector analysis under the corrected constraint: Triton is a STRICT SUPERSET of Mermaid (extending with new tokens is allowed and desired).

**Key corrections from v1:**
- "Dashed" is NOT dropped — it gets a new Triton-extension token `-_->` (underscore infix).
- "Wavy" is a new 5th style via `-~->` (tilde infix).
- The full orthogonal matrix is 15 tokens (5 styles × 3 directions): 9 Mermaid-honored + 6 Triton-extended.
- Both `_` and `~` have no collision with existing Mermaid tokens (verified against flowchart and classDiagram grammars).

**New findings:**
- Wavy rendering is feasible deterministically via sine-wave path displacement (W1 approach). ~100 LoC geometry. SVG filters (feTurbulence) are NOT viable — they violate determinism.
- The 5-style enum is TOTAL and mutually exclusive: no composite styles (thick-wavy etc.) in v1.
- Real migration blast radius is small: 1 parse break (`<..>`), 10 visual changes (`-.->` dashed→dotted), 8 animation losses (auto-march removal). All in `examples/triton/`.
- Flowchart grammar's `kind: sync|async` is a semantic overlay on style that should be dropped to unify the two grammars' output shape. ~3 downstream consumers to audit.
- The `connector-tokens.ts` shared constant approach (tested from both grammars) is the right consistency mechanism — PEG can't share rules across files.

---

### Live-Poster Scope Ruling (2026-07-12)

Issued scope/identity ruling on the live-data poster web component proposal. Decision filed at `.squad/decisions/inbox/leslie-liveposter-scope.md`.

**Verdict:** PROCEED with hard boundary.

**Key rulings:**

- Cosmetic bindings (text templates, color thresholds, animation speed) are clean — they operate on stable SVG output without affecting layout. The compiler emits a binding-map JSON sidecar; a separate runtime package consumes it.
- `repeat:` (structural data-driven cell generation) is **rejected as a compiler feature**. It requires runtime data to determine geometry, which violates the determinism contract. If pursued, it belongs in a pre-processor that expands DSL before compilation.
- The inviolable principle: **the compiler is a pure function of its text input alone. No runtime data enters the compilation pipeline.**
- Boundary: compiler owns DSL→IR→layout→SVG+binding-map. Runtime (`@triton/poster-runtime`) owns reactivity, DOM patching, transport, the web component. One-way dependency only (runtime→compiler).
- The compiler already emits stable per-cell IDs (hover/tooltip anchors). Formalizing these as a binding-map JSON is low-risk and architecturally sound.
