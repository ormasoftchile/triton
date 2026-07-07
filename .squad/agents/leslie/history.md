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
