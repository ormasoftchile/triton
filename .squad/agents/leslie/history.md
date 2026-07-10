# Leslie — Spec Architect

## [ARCHIVED HISTORY]

Previously completed work:
- Current Role
- Strategic Context
- Grammar Status (2026-06-14)
- Recent: Theming Architecture Confirmed (2026-06-14)
- Archive & Historical Notes (2026-06-15)
- Learnings
- Learnings

---

## Learnings

### Diagram-Options Reference Format — Spec (2026-07-06)

Produced spec `.squad/decisions/inbox/leslie-diagram-options-format.md` and verified exemplar files.

**Key decisions made:**

- **Fragment-first, concat-last** — each agent writes `docs/diagram-options/_fragments/<family>.md`; a final `cat` step produces `docs/diagram-options.md`. This allows 5 agents to run in parallel without merge conflicts.

- **`%%` placement: after header keyword line, within Statements** — the flowchart grammar's `BlankLine = _ Comment? NL` rule only fires inside `Statements` (after the first `flowchart LR` line), not before the header. Any `%%` block must go AFTER the header keyword line.

- **Comment safety is per-grammar** — agents must `grep -c '%%' src/diagrams/<ns>/<family>/grammar.peggy` before inserting any header. Only 4 families confirmed to support `%%` as of this date: flowchart, sankey, timeline, poster. All others: skip header, add fallback note in fragment.

- **SVG noise is acceptable** — `pnpm install` restored missing `@types/d3-shape` / `@types/d3-path` deps needed for TypeScript compilation. After the header addition, all 3 flowchart SVGs regenerated; diff showed only a 2-line background rect change (pre-existing rendering change, not caused by headers). This is not a regression.

- **Options are grammar-derived only** — no invented syntax; every listed option must exist in `grammar.peggy` (or the hand-written `index.ts` for DS subkinds).

**Key file paths:**
- Spec: `.squad/decisions/inbox/leslie-diagram-options-format.md`
- Exemplar fragment: `docs/diagram-options/_fragments/flowchart.md`
- Exemplar with header: `examples/mermaid/flowchart/flowchart.mmd` (and ci-pipeline.mmd, order-processing.mmd)
- Fragment dir: `docs/diagram-options/_fragments/`
- Final doc (to concatenate): `docs/diagram-options.md`

---

### Layout Algorithm Improvement Initiative — Phase Plan (2026-06-27)

Produced formal phase plan `.squad/decisions/inbox/leslie-layout-phases.md` governing all layout algorithm work.

**Key decisions made:**

- **Static dispatch is the selection method** — algorithm selection is a semantic property of each diagram kind, hardcoded in that kind's `layout.ts`. No dynamic/adaptive switching. Rationale: violates determinism contract (same source must produce same layout); adds combinatorial test burden; creates invisible thresholds that confuse authors. Performance fallbacks (approximate heuristics for huge graphs) are explicitly deferred.

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
