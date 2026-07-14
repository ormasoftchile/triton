# Decisions Archive — entries older than 7 days

**Archived by:** Scribe  
**Archived at:** 2026-07-14T19:16:40-04:00  
**Source:** `.squad/decisions.md`  
**Reason:** `decisions.md` exceeded 51200 bytes; entries dated 2026-07-07 were older than 7 days.

---

# Decision: Group A — Inline `%%` Options Headers Added (2026-07-07)

**Author:** Bjarne (Ingestion Design)  
**Date:** 2026-07-07  
**Follow-up to:** Group A diagram-options fragments (2026-07-06)

---

## Context

`stripComments()` in `src/frontend/preprocess.ts` now strips full-line `%%` comment lines
before any parser sees them, across all diagram families (404 tests pass). The fallback
note in Group A fragments ("This grammar does not define a `%%` comment rule") is obsolete.

---

## Files Changed

### `.mmd` examples — `%%` header block added

Each block is placed immediately after the diagram header keyword line, following the
`flowchart.mmd` exemplar convention (Leslie's format). Block content is strictly
grammar-derived — no invented tokens.

| File | Header keyword | Lines added |
|------|---------------|-------------|
| `examples/mermaid/class/class.mmd` | `classDiagram` | 10 |
| `examples/mermaid/state/state.mmd` | `stateDiagram-v2` | 12 |
| `examples/mermaid/er/er.mmd` | `erDiagram` | 10 |
| `examples/mermaid/c4/c4.mmd` | `C4Context` | 13 |
| `examples/mermaid/requirement/requirement.mmd` | `requirementDiagram` | 10 |

### Fragments — fallback note removed, `### Comments` section added

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/class.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/state.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/er.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/c4.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/requirement.md` | Replaced fallback note → `### Comments` |

`### Comments` text (uniform across all five):
> Lines starting with `%%` are stripped before parsing:
> ```
> %% This is a comment
> ```

---

## Render Results

All verified via `node scripts/preview.mjs examples/mermaid/<family>/` from repo root:

| Family | Exit code | SVG output |
|--------|-----------|------------|
| class | 0 | `class.svg` ✓ |
| state | 0 | `state.svg` ✓ |
| er | 0 | `er.svg` ✓ |
| c4 | 0 | `c4.svg` ✓ |
| requirement | 0 | `requirement.svg` ✓ |

SVG layout unchanged — `%%` lines stripped before parse, no parser impact.

---

## Note on Theme Subdirectories

No `.mmd` files exist under `examples/mermaid/<family>/themes/` for any of the 5 families
(directories are present but contain no `.mmd` sources). Only the single top-level file per
family required updating.


---



---

# Group D `%%` Header Blocks — Follow-up Complete

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-07T00:05:21-04:00  
**Relates to:** Group D diagram-options work; `stripComments()` central implementation in `src/frontend/preprocess.ts`

---

## Context

`stripComments()` in `src/frontend/preprocess.ts` strips all full-line `%%` comments before any parser sees the input. This supersedes the earlier per-grammar approach (only poster had `%%` support natively). All families — including architecture, block, packet, and topology — now accept `%%` header blocks without grammar changes.

---

## Files Changed

### `.mmd` examples — `%%` options header added

| File | Header keyword | SVG output |
|------|---------------|------------|
| `examples/triton/architecture/architecture.mmd` | `architecture-beta` | `architecture.svg` ✓ |
| `examples/triton/block/block.mmd` | `block-beta` | `block.svg` ✓ |
| `examples/triton/packet/packet.mmd` | `packet-beta` | `packet.svg` ✓ |
| `examples/triton/topology/numa.mmd` | `topology` | `numa.svg` ✓ |
| `examples/triton/topology/numa-detail.mmd` | `topology` | `numa-detail.svg` ✓ |

Header block format (per Leslie's convention, after the keyword line):
```
%% ────────────────────────────────────────────────────────────────────────────
%% FAMILY — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:   ...
%% ...options (compact per-category lines from fragment)...
%% Comments: %% text  (stripped before parse — safe on any line)
%% ────────────────────────────────────────────────────────────────────────────
```

### Fragments — fallback note removed, `### Comments` section added

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/triton-architecture.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/triton-block.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/triton-packet.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/triton-topology.md` | Removed fallback note; added `### Comments` |

Each `### Comments` section reads:
> Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`).

---

## Render Results

All previews ran at exit 0 with layout unchanged:

```
node scripts/preview.mjs examples/triton/architecture/  → architecture.svg   EXIT:0
node scripts/preview.mjs examples/triton/block/         → block.svg          EXIT:0
node scripts/preview.mjs examples/triton/packet/        → packet.svg         EXIT:0
node scripts/preview.mjs examples/triton/topology/      → numa.svg           EXIT:0
                                                          numa-detail.svg     EXIT:0
```

No family misbehaved. Poster untouched (already complete).


---



---

# Group B `%%` Header Blocks — Follow-up (David, 2026-07-07)

## Context

`src/frontend/preprocess.ts` now strips full-line `%%` comments centrally before any grammar sees the input (404 tests passing). This supersedes the fallback notes I wrote in the Group B fragments during the 2026-07-06 diagram-options wave, which said "this grammar does not define a `%%` comment rule." Those notes are now incorrect. This document records the follow-up work that cleans them up and adds `%%` header blocks to all five Group B example files.

---

## Files Changed

### Example `.mmd` files — `%%` options header added after keyword line

| File | Header keyword | Header lines added |
|------|---------------|--------------------|
| `examples/mermaid/sequence/auth.mmd` | `sequenceDiagram` | 11 |
| `examples/mermaid/journey/journey.mmd` | `journey` | 8 |
| `examples/mermaid/gantt/gantt.mmd` | `gantt` | 10 |
| `examples/mermaid/gitgraph/gitgraph.mmd` | `gitGraph` | 9 |
| `examples/mermaid/kanban/kanban.mmd` | `kanban` | 8 |

Each block follows Leslie's convention (same format as `examples/mermaid/flowchart/flowchart.mmd`):
- Delimiter lines `%% ─────…`
- `%% FAMILY — options quick-ref` title
- Compact per-category lines covering all grammar-derived options
- Closes with `%% Comments:   %% text  (stripped before parse — safe on any line)`

### Fragment files — fallback note replaced with `### Comments` section

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/sequence.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/journey.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/gantt.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/gitgraph.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/kanban.md` | Removed fallback note; added `### Comments` |

`### Comments` section text (uniform across all five):
```
Lines starting with `%%` are stripped before parsing:
\`\`\`
%% This is a comment
\`\`\`
```

---

## Render Results

Each family previewed via `node scripts/preview.mjs examples/mermaid/<family>/` from repo root, run serially:

| Family   | SVGs regenerated | Exit code |
|----------|-----------------|-----------|
| sequence | auth.svg        | 0 ✓       |
| journey  | journey.svg     | 0 ✓       |
| gantt    | gantt.svg       | 0 ✓       |
| gitgraph | gitgraph.svg    | 0 ✓       |
| kanban   | kanban.svg      | 0 ✓       |

> **Note:** Running all previews in parallel triggers a race condition in the shared dist build step (pre-existing issue in `class/layout.js`). Previews must be run serially.

---

## No Tokens Invented

All options in the header blocks are derived strictly from fragment grammar tables already written during the 2026-07-06 wave. No new grammar tokens were introduced.

---

_David · Research Lead · 2026-07-07_


---



---

# Edsger — Group E (ds) %% Headers

**Date:** 2026-07-07  
**Agent:** Edsger (Layout Algorithms)  
**Follow-up to:** Group E ds diagram-options fragment work

---

## Summary

Added `%%` options quick-ref headers to all ds example files and updated all 22 ds fragment docs to replace the obsolete fallback note with a proper `### Comments` section.

---

## Scope

| Item | Count |
|------|-------|
| `.mmd` example files given `%%` headers | **20** |
| `ds-*.md` fragment files updated | **22** |
| Subkinds covered by examples | array, queue, cqueue, deque, pqueue, stack, hashmap, matrix, trie, unionfind, nodegraph, tree (decision + query-plan), plan, avl, rbtree, btree, heap, radix, segtree |
| Fragments without example files (docs only) | linkedlist, memory, page |

---

## What changed in .mmd files

Each of the 20 `.mmd` example files received a `%%`-prefixed options quick-ref block inserted immediately after the header keyword line, following the established convention from `examples/mermaid/flowchart/flowchart.mmd`. The block ends with:

```
%% Comments: %% text  (stripped before parse — safe on any line)
```

Header content is derived strictly from each subkind's fragment (no invented tokens).

---

## What changed in fragment files (all 22)

1. **Removed** the fallback blockquote note:  
   > This grammar does not define a `%%` comment rule …

2. **Added** a `### Comments` section (before `### Minimal snippet`):  
   ```markdown
   ### Comments
   
   Full-line `%%` comments are supported and stripped centrally before any parser runs:
   ```
   %% This is a comment
   ```
   ```

---

## Render result

All 20 SVGs regenerated successfully with exit 0 across all 9 ds subdirectories:

- `examples/triton/ds/array/` → `array.svg` ✓
- `examples/triton/ds/queue/` → `circular.svg`, `deque.svg`, `linear.svg`, `priority.svg` ✓
- `examples/triton/ds/stack/` → `stack.svg` ✓
- `examples/triton/ds/hashmap/` → `hashmap.svg` ✓
- `examples/triton/ds/matrix/` → `matrix.svg` ✓
- `examples/triton/ds/trie/` → `trie.svg` ✓
- `examples/triton/ds/unionfind/` → `unionfind.svg` ✓
- `examples/triton/ds/graph/` → `graph.svg` ✓
- `examples/triton/ds/tree/` → `avl.svg`, `btree.svg`, `decision.svg`, `heap.svg`, `plan.svg`, `query-plan.svg`, `radix.svg`, `rbtree.svg`, `segtree.svg` ✓

Layout is unchanged — `%%` lines are stripped before any parser sees the input.


---



---

# Decision Record: diagram-options feature — Final Assembly

**Date:** 2026-07-07  
**Author:** Leslie (Lead / Spec Architect)  
**Status:** Done

---

## Summary

The diagram-options feature is complete. All 45 diagram families now support `%%` comments unconditionally, every fragment documents this, the central reference doc is assembled and verified, and the full test suite passes with 0 failures.

---

## Final Artifact List

| Artifact | Status |
|---|---|
| `docs/diagram-options.md` | ✅ Assembled — 2879 lines, 45 family sections, updated intro |
| `docs/diagram-options/_fragments/*.md` (45 files) | ✅ All have `### Comments` section |
| `src/frontend/preprocess.ts` | ✅ New — `stripComments()` central preprocessor |
| `src/frontend/index.ts` | ✅ Updated — calls `stripComments()` before parse dispatch |
| `test/preprocess-comments.test.ts` | ✅ New — 20 tests for `stripComments()` |
| `examples/**/*.mmd` (60 of 68) | ✅ Carry inline `%%` options-header blocks |
| `examples/**/*.svg` (re-renders) | ✅ Re-rendered after header additions |
| `.squad/agents/*/history.md` (5 agents) | ✅ Updated by each agent's group work |

---

## Universal `%%` Comment Support

All 45 diagram families now support full-line `%%` comments. This is enforced by `src/frontend/preprocess.ts` (`stripComments()`), which strips every `%%`-prefixed line before the diagram source reaches any parser. Comments may appear anywhere in a file — including before the header keyword.

The 8 `.mmd` files without inline options-headers are intentionally left as-is: they are complex multi-diagram poster variants (cross-link, showcase, animated) where a per-family header block would be ambiguous inside nested cells.

---

## `pnpm test` Result

```
Test Files  31 passed (31)
     Tests  404 passed (404)
  Duration  3.76s
```

**0 failures. 0 typecheck errors.**

The 69-file examples render corpus (including all `.mmd` files with newly added `%%` headers) passed in full.

---

## Intro Paragraph (final)

> This document is the single central reference for every option, keyword, and syntax construct accepted by each diagram family in Triton. Options are grammar-derived: every entry was extracted from the family's `grammar.peggy` or parser source and verified against real examples. Full-line `%%` comment lines are supported in **every** family — they are stripped centrally by `src/frontend/preprocess.ts` before any parser runs, so they may appear anywhere in a diagram file, including before the header keyword. Nearly every example `.mmd` file carries an inline options-header block written as `%%` comments, making available options visible directly alongside the diagram source.


---



---

# Decision: Central %% Comment Stripping

**Author:** Mark (IR & Data Modeling)  
**Date:** 2026-07-07  
**Status:** Implemented — ready for Leslie review gate  
**Requested by:** Cristian (ormasoftchile)

---

## Problem

Only 4 diagram families (flowchart, sankey, timeline, poster) had a `%%` Comment
rule in their Peggy grammar. The remaining ~20 Mermaid families, 4 Triton-native
families (architecture/block/packet/topology), and 22 hand-parsed `ds` sub-kinds
had no comment support — a `%%` line would either trigger a parse error or be
silently misinterpreted as diagram content. This blocked adding `%%` options-header
blocks to every example file.

---

## Approach: Central pre-processing (chosen)

Strip `%%` comment lines **once**, at the top of `compileSync` in
`src/frontend/index.ts`, before `detect()` and the grammar/parser are invoked.
A new function `stripComments(input: string): string` in `src/frontend/preprocess.ts`
performs the strip and is exported for independent unit testing.

**Wire-up (one line added to compileSync):**
```typescript
const cleaned = stripComments(input);
const { format, diagramType } = detect(cleaned);
// … later …
const ir = format === 'yaml' ? module.parseYaml(cleaned) : module.parseMermaid(cleaned);
```

All four public entrypoints (`compileSync`, `renderSync`, `compile`, `render`)
benefit automatically because they all route through `compileSync`.

---

## Semantics

### Chosen: full-line `%%` only

A line is a comment iff its first non-whitespace characters are `%%`
(regex `/^\s*%%/`). Such lines are **removed entirely** (not blanked).

Rationale for "remove entirely" over "blank": every Peggy grammar has a
`BlankLine` rule; every hand-parsed `ds` family uses `lines()` from
`src/diagrams/triton/ds/struct/shared.ts` which already does `filter(Boolean)`.
Removing lines is therefore universally safe and does not shift meaningful
indentation (comment lines carry no structural meaning).

### Inline trailing comments: NOT supported centrally (by design)

`A --> B %% note` is **not stripped** by the central stripper. Reason:
distinguishing a real trailing comment from `%%` inside a quoted node label
(e.g. `A["Load at 50%% capacity"]`) is impossible without invoking the full
grammar. The 4 families that already handle their own Comment rules continue
to accept inline `%%` via their grammar rule, unchanged — the central
pre-stripper only removes full-line comments first, which those grammars would
have consumed anyway.

### Frontmatter preserved verbatim

If the input opens with a `---\n…\n---` YAML frontmatter block, that block is
passed through untouched. YAML values may legitimately contain `%%` (e.g.
`title: "Load at 90%% capacity"`). Stripping applies only to the Mermaid body
after the closing `---` fence.

### Pure-YAML inputs untouched

If the first non-whitespace token is `type:`, the input is returned unchanged.
The `parseYaml` path receives the original author text.

### Malformed frontmatter

If `---` is present but no closing `---` is found, the input is returned
conservatively unchanged (treated as YAML-ish).

---

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Per-grammar Comment rule in every .peggy | Requires editing 19+ grammars + re-generating parsers; hand-parsed families still need separate treatment; maintenance burden for future families |
| Inline trailing comment support centrally | Unsafe: `A["50%% off"]` would be mangled; requires tokeniser-level knowledge |
| Blank lines instead of remove | Functionally equivalent but preserves no benefit; "remove" is simpler output |

---

## Files changed

| File | Change |
|---|---|
| `src/frontend/preprocess.ts` | **New** — `stripComments()` (exported) + private `removeCommentLines()` |
| `src/frontend/index.ts` | Added `import { stripComments }` + `const cleaned = stripComments(input)` at top of `compileSync`; `detect` and `parse*` now receive `cleaned` |
| `test/preprocess-comments.test.ts` | **New** — 20 tests (unit + detect integration + end-to-end render for 5 families) |

---

## Test results

```
pnpm test:  404 pass, 0 fail  (baseline 384 + 20 new)
pnpm typecheck:  0 errors
```

### Previously-unsupported families verified (end-to-end render with `%%` header)

- `classDiagram` — Peggy grammar, no prior Comment rule → now accepts `%%`
- `packet-beta` — Peggy grammar, no prior Comment rule → now accepts `%%`
- `array` (ds hand-parsed) — `lines()`/`filter(Boolean)` path → now accepts `%%`
- `mindmap` — Peggy grammar, indentation-sensitive, no prior Comment rule → now accepts `%%`
- `pie` — Peggy grammar, no prior Comment rule → now accepts `%%`

---

## Readiness for coordinator

This task is complete. The coordinator can now fan out:
1. **Example-header additions** — add `%%` options-header blocks to every `.mmd`
   example file (all families now accept `%%`).
2. **Docs update** — remove "fallback note" caveats from the 4 fragment files
   (pie, xychart, quadrant, radar, mindmap, etc.) that were marked as lacking
   `%%` support.


---



---

# Group C — %% Header Blocks for pie / xychart / quadrant / radar / mindmap

**Author:** Mark (IR & Data Modeling)
**Date:** 2026-07-07
**Supersedes:** Group C fallback notes in five fragments

---

## Summary

Added Leslie-convention `%%` options-header blocks to all Group C example files and updated the corresponding fragments to reflect that `%%` comments are now fully supported via central stripping.

---

## Files Changed

### Example `.mmd` files — 1 per family (5 total)

| File | Header keyword | Block inserted after |
|------|---------------|---------------------|
| `examples/mermaid/pie/languages.mmd` | `pie` | `pie showData title …` line |
| `examples/mermaid/xychart/xychart.mmd` | `xychart-beta` | `xychart-beta` line |
| `examples/mermaid/quadrant/quadrant.mmd` | `quadrantChart` | `quadrantChart` line |
| `examples/mermaid/radar/radar.mmd` | `radar-beta` | `radar-beta` line |
| `examples/mermaid/mindmap/mindmap.mmd` | `mindmap` | `mindmap` line (col 0, after frontmatter) |

### Fragment documentation — 5 files

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/pie.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/xychart.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/quadrant.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/radar.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/mindmap.md` | Removed fallback blockquote; added `### Comments` section (with indentation note) |

---

## Why This Works Now

`stripComments()` in `src/frontend/preprocess.ts` removes every full-line `%%` comment before the diagram string reaches any parser. All four compile/render entrypoints in `src/frontend/index.ts` call it centrally. No per-grammar comment rule is needed — making `%%` headers universally safe.

---

## Mindmap Notes

Mindmap uses indentation depth as its parse signal for parent-child relationships. The `%%` block lines are placed at column 0 immediately after the `mindmap` keyword line. Because `stripComments()` removes them entirely before the indentation-sensitive parser sees the file, real node indentation is never disturbed.

---

## Preview Results

| Family | Command | Exit | SVG |
|--------|---------|------|-----|
| pie | `node scripts/preview.mjs examples/mermaid/pie/` | 0 | `languages.svg` regenerated |
| xychart | `node scripts/preview.mjs examples/mermaid/xychart/` | 0 | `xychart.svg` regenerated |
| quadrant | `node scripts/preview.mjs examples/mermaid/quadrant/` | 0 | `quadrant.svg` regenerated |
| radar | `node scripts/preview.mjs examples/mermaid/radar/` | 0 | `radar.svg` regenerated |
| mindmap | `node scripts/preview.mjs examples/mermaid/mindmap/` | 0 | `mindmap.svg` regenerated, hierarchy intact |

All five families exit 0. Mindmap indentation and tree layout confirmed unchanged.

---

## Sankey Status

Sankey was already completed in the previous session. Not touched.


---



---

# The scorecard is computed by src/geometry/aesthetics.ts and logged during poster render.


---

# Check the logged score; it must reach ≥ 0.75 before Phase 4 is considered complete.
node scripts/preview.mjs examples/poster/


---

# Inspect console output for the aesthetics score line.
```

---

## 4. Scope Decisions

### 4.1 Selection Method: Static Dispatch — DECIDED

**Decision: Static dispatch per diagram type. No dynamic or adaptive algorithm selection.**

The algorithm for a diagram kind is a *semantic* property of that kind, not a runtime property
of a specific instance. A flowchart is always a directed flow and always benefits from Sugiyama
layered layout, regardless of whether it has 3 nodes or 300. Switching algorithms based on
graph metrics (node count, density, cycle count) would:

1. Violate Triton's core determinism contract — the same source must produce the same layout.
   An algorithm switch at a threshold (e.g., n > 50 nodes → use force-directed) means that
   adding one node can produce a completely different visual arrangement.
2. Introduce combinatorial testing burden — every diagram type would need test coverage at both
   sides of each threshold.
3. Create author confusion — the user cannot predict what their diagram will look like until it
   crosses an invisible threshold.

**Implementation:** The selection is implemented as a static mapping in each diagram's
`layout.ts` (already the existing pattern). No registry or runtime selector is needed.

**Deferred (not in this initiative):** Performance fallbacks for pathologically large graphs
(e.g., thousands of nodes) may be addressed in a separate performance initiative. That work
would use the same algorithm but with approximation heuristics (e.g., fewer crossing-min
sweeps), not a different algorithm family — so it preserves visual continuity.

**Confirmed scope of static dispatch:**

| Diagram kind | Algorithm family | Selection |
|---|---|---|
| flowchart | Sugiyama 4-phase layered | Static (TB or LR from diagram direction) |
| class, state, er, c4, block, requirement | Sugiyama-lite layered (`layered.ts`) | Static |
| mindmap | B–J–L tidy tree (`tree.ts`) | Static |
| ds/tree, trie, unionfind | B–J–L tidy tree (`tree.ts`) | Static |
| ds/nodegraph | Sugiyama-lite layered (`layered.ts`) | Static |
| sequence, gantt, gitgraph, timeline | Positional by order/time | No algorithm; static positional |
| kanban, packet | Strip placement | Static strip |
| pie, radar, quadrant, xychart | Polar / Cartesian math | Static math |
| sankey | Flow-channel placement | Static custom |
| architecture, block (top-level), journey | Custom | Static custom |
| poster (cell placement) | Grid occupancy assignment | Static grid |
| poster (cross-link routing) | engine3 cost-function | Static engine selection |

### 4.2 Poster Treatment: Dedicated Phase — CONFIRMED

The poster is architecturally distinct from all other diagram types and must be treated in its
own dedicated phase (Phase 4) for the following reasons:

**The core problem:** Poster cross-diagram connectors must route through the inter-cell space of
a grid of independently-rendered diagram cells. Each cell has its own coordinate space and
internal layout; the cross-link router (engine3) operates in poster-global space after
transforming anchor points. The key difficulties are:

1. **Obstacle heterogeneity.** The obstacle set for a poster connector consists of the bounding
   boxes of ALL cells (not just the source and target cell). Routing cannot be solved per
   diagram — it requires global knowledge of all cell positions and sizes.
2. **Coordinate space transforms.** Each diagram cell produces anchors in its own local
   coordinate space. The engine must transform those anchors to poster-global space before
   routing, and the transform is non-trivial for row-span or column-span cells (the cell's
   origin shifts based on grid placement).
3. **Port clustering.** Multiple connectors may share the same cell wall. Port ordering on a
   wall must be globally coherent — a connector that enters the left wall of cell (2,1) must
   not cross a connector that enters the left wall of cell (2,1) at a different port if they
   connect to different directions.
4. **Scale independence.** Connectors should route cleanly regardless of how many cells are in
   the grid or how varied the cell sizes are.

This is a hard cross-diagram routing problem that is NOT solved by the intra-diagram layout
improvements in Phases 1–3. It requires deep engagement with engine3.ts (1073 lines) and the
poster layout kernel (548 lines). Attempting to interleave this work with the simpler diagram
upgrades would create a moving-target situation.

**Phase 4 is a mandatory gate for Phase 5** (design doc must describe the finalized
architecture).

### 4.3 What Is Out of Scope

The following are explicitly **deferred** and not part of this initiative:

- **External library integration (elk.js, dagre-D3, d3-force):** The catalog (Phase 0) will
  describe these as academic references and identify where their algorithms map to Triton kinds.
  Triton will NOT adopt them as runtime dependencies. The algorithms will be implemented in
  TypeScript in the existing kernel files. Rationale: Triton's determinism contract and
  zero-external-dependency rule for core conflict with these libraries' design.
- **Adaptive / runtime algorithm switching:** See §4.1.
- **3D or radial layout for general graphs:** Not a Triton use case in this initiative.
- **Animation/transition between layouts:** Out of scope for a compiler; belongs to a renderer.
- **Force-directed layouts for any current diagram kind:** No Triton diagram benefits from
  non-deterministic force convergence. Force-directed is documented in the catalog but not
  adopted.
- **New diagram kinds:** This initiative improves existing layouts only. New kinds go through the
  normal grammar spec process.

---

## 5. Risk Flags

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Brandes–Köpf introduces layout discontinuity** — existing goldens will change significantly for flowchart/class/state/er. Users relying on deterministic exact pixel positions will notice. | Medium | Golden updates are expected and permitted. Communicate to ormasoftchile before Phase 1 merge that golden SVGs will change. The new layout should be strictly better visually. |
| **Crossing minimization is NP-hard; barycenter is a heuristic** — results may differ from Mermaid's dagre output by large amounts on complex graphs. | Low–Medium | Acceptable: Triton is explicitly better-than-Mermaid. But run `examples/flowchart/` visual check on the most complex example before merge. |
| **engine3 cost weights are corpus-calibrated to current (suboptimal) layouts** — re-tuning the weights in Phase 4 may cause regressions in currently-passing poster examples. | High | Phase 4 must audit ALL poster examples in `examples/poster/` and `examples/showcases/`. Aesthetic score is the objective gate; do not merge if any existing poster degrades below its current score. |
| **Coordinate-space transform bugs in poster** — a cell at grid position (row=2, col=1) with a row-span may have an offset that differs from a simple `row × rowHeight` computation. Off-by-one in the transform would cause connectors to attach to the wrong wall point. | High | Phase 4B must add explicit unit tests for anchor→global coordinate transforms covering span cells. |

---

Added a **dummy-protection pass** after standard type-1 conflict detection (lines ~482–503 of `src/graph/layered.ts`):

> For each dummy `d` in a layer, for each real node `u` in the **same layer** that shares a direct predecessor `p` or successor `s` with `d`, call `addConflict(p, u)` and `addConflict(u, s)`.

This prevents `u` from claiming `p` or `s` as an alignment anchor in any of the four BK sweeps. The dummy aligns in all four sweeps; the real node (`ShoppingCart`) is orphaned at `sep(dummy, u) = 95.8px` from the Customer column.

## Result

- `bends[0].x` = **89** = `Customer.x` = `Order.x` ✓ (straight vertical edge)
- `ShoppingCart.x` = 185 (own column, cleanly separated from Customer/Order column)
- `pnpm build` exits 0 ✓
- `pnpm test` 387/387 ✓

## SVG "places" edge path (after fix)

```
d="M 89 184 L 89 216 L 89    216 L 89    387 L 89   387 L 89   419"
```

Perfectly straight vertical line at x=89.

---


---
