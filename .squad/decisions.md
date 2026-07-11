# Phase 2: Theming Fixes Shipped (Primitives Dropped)

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-10T19:29-04:00  
**Branch:** `ormasoftchile/poster-phase2`  
**Decision:** Primitives (intervals, hashring) dropped per Cristian; only two visual-consistency fixes shipped.

---

## Summary

The Phase 2 branch initially implemented two new `ds` subkind primitives (`intervals` and `hashring`) to unblock poster cards identified in Leslie's gap analysis. However, per Cristian's decision (2026-07-10), these primitives were **removed entirely**. The branch now carries only two focused visual-consistency fixes:

1. **Tree Default Node Border** — plain/default nodes now use `palette.primary` (blue) borders, matching nodegraph styling
2. **Arrowhead Size Uniformity** — fixed `arrowDef()` with `markerUnits="userSpaceOnUse"` so active edges maintain uniform arrowhead sizes regardless of stroke width

---

## The Two Shipped Fixes

### Fix 1: Tree Default Node Border

**File:** `src/diagrams/triton/ds/tree/layout.ts`

**Problem:** `tree` primitive default/plain nodes rendered with near-black borders, visually inconsistent with `nodegraph` default nodes (blue `palette.primary`).

**Solution:** Changed fallback case in `nodeStyle()` to use `palette.primary` for plain nodes:
```diff
- return { shape, fill, stroke: outlineStroke(fill, theme), text: palette.text };
+ return { shape, fill, stroke: palette.primary, text: palette.text };
```

**Scope:** Only plain/default nodes. Semantic kinds (RB red, RB black, active, scan, join, build/muted) unchanged.

**Test updated:** `test/tree-builders.test.ts` — plain/AVL node assertions updated to expect `palette.primary`.

---

### Fix 2: Arrowhead Size Uniformity

**File:** `src/diagrams/triton/ds/struct/shared.ts`

**Problem:** `nodegraph` active edges (stroke=2.5) had arrowheads ~1.67× larger than normal edges (stroke=1.5) because `arrowDef()` omitted `markerUnits`, causing arrowheads to scale with the line's stroke width.

**Solution:** Switched to `markerUnits="userSpaceOnUse"` with fixed geometry:
```diff
- markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"
- path: M0 0 L8 4 L0 8 z
+ markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse"
+ path: M0 0 L12 6 L0 12 z
```

**Impact:** Affects all diagrams using shared `ARROW_ID` marker: nodegraph, linkedlist, hashmap, array, page, memory. Queue diagrams have separate markers (unaffected).

---

## Dropped Work

The following was **removed entirely**:
- `src/diagrams/triton/ds/intervals/` (whole directory)
- `src/diagrams/triton/ds/hashring/` (whole directory)  
- `test/intervals.test.ts`, `test/hashring.test.ts`
- `examples/triton/poster/phase2/` (whole directory)
- `DiagramKind` union entries `'intervals' | 'hashring'`
- `detect.ts` patterns for intervals/hashring
- `frontend/index.ts` imports + `registerDiagram()` calls
- `poster/index.ts` `inferCellKind()` checks

---

## Verification

- **Build:** `pnpm build` clean
- **Tests:** 499/499 (Phase-1 baseline, primitives removed)
- **Visual QA:** Edge-highlight.png confirms blue tree borders + uniform arrowheads (Ken's full pass in separate decision)
- **Files on branch:** 3 files modified:
  1. `src/diagrams/triton/ds/tree/layout.ts` (plain node border)
  2. `src/diagrams/triton/ds/struct/shared.ts` (arrowDef markerUnits)
  3. `test/tree-builders.test.ts` (updated assertions)

---

## Decision Rationale

Dropping the primitives allows the branch to ship quickly with focused, low-risk improvements to existing diagram families. The primitives can be revisited in a future phase if poster card requirements evolve.


---

# Visual QA: Phase 2 Theming Fixes — PASS

**Reviewer:** Ken (Visual QA)  
**Date:** 2026-07-10T19:17:00-04:00  
**Branch:** `ormasoftchile/poster-phase2`  
**Decision:** Primitives dropped; QA verdict on shipped fixes: PASS

---

## Scope

Reviewed two visual-consistency fixes shipped in Phase 2:
1. Tree default node borders (blue `palette.primary`)
2. Arrowhead size uniformity (fixed `markerUnits="userSpaceOnUse"`)

**Note:** Primitive implementations (intervals, hashring) were under review but subsequently removed per Cristian's decision before merge.

---

## Verification Results

### 1. Tree Theming (edge-highlight.svg)

**What I verified:**
- **Binary Tree DFS panel:** Plain nodes B, C, D now have blue (`palette.primary`) borders matching the highlighted node style
- **Backtracking panel:** All nodes (Root, Choice1, Choice2, Good, Bad, Answer) have consistent blue borders — NOT near-black
- **Semantic nodes unchanged:** RB-tree `rbtree.png` — black and red nodes retain their semantic colors

**Verdict:** ✅ **PASS** — Tree theming fix confirmed; no regressions in semantic node colors.

---

### 2. Arrowhead Uniformity (edge-highlight.svg)

**What I verified:**
- **DFS Graph panel:** Active edges (parse→scan, thicker stroke) and normal edges (gray/muted) have visibly **uniform arrowhead sizes**
- **BFS Graph panel:** Active→scan and scan→build edges — arrowheads all proportional, no scaling artifacts
- **linkedlist/labels.svg:** Struct pointer arrows render correctly with consistent arrowhead geometry

**Verdict:** ✅ **PASS** — Arrowhead uniformity confirmed; `markerUnits="userSpaceOnUse"` working correctly.

---

## Overall Verdict: **PASS**

Both shipped fixes render correctly with no visual regressions.

---

## Note on Dropped Primitives

The `intervals` and `hashring` implementations that were initially under QA review were dropped before merge per Cristian's decision. No cosmetic issues from dropped work affect the final branch.

**Signed:** Ken, Visual QA Reviewer  
**Timestamp:** 2026-07-10T19:17:43-04:00


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

# Decision: Diagram-Options Reference Format

**Author:** Leslie (Lead / Spec Architect)  
**Date:** 2026-07-06  
**Status:** READY — downstream agents must implement exactly as specified below  
**Requested by:** ormasoftchile  

---

## Context

The user needs a quick, convenient way to see the OPTIONS available for each diagram type.
We are delivering two artifacts:

1. **`docs/diagram-options.md`** — a single central markdown reference concatenated from per-family fragments.
2. **`%%` comment header blocks** at the top of each example `.mmd` file — visible to anyone opening the file.

The flowchart family has been implemented as the verified exemplar. All downstream agents must follow this specification exactly and point at the exemplar before starting.

**Exemplar files (READ THESE FIRST):**
- Fragment: `docs/diagram-options/_fragments/flowchart.md`
- Example with header: `examples/mermaid/flowchart/flowchart.mmd`

---

## Part 1 — Fragment Template

Each agent writes one file per family to `docs/diagram-options/_fragments/<family>.md`.
The file MUST follow this verbatim template structure (section headings, table format, snippet fence):

```markdown
## <Family name, title-case>

<One sentence: what this diagram type draws. Derived from grammar.peggy file header comment.>

**Header keyword(s):** `<token1>` · `<token2>`

---

### <Category A heading — use only categories that apply>

| <col1> | <col2> |
|--------|--------|
| ...    | ...    |

---

### <Category B heading>

...

---

### Minimal snippet

```
<diagram header>
  <2–4 lines showing the most common syntax>
```
```

**Mandatory sections** (include all that the grammar supports; omit those it doesn't):

| Section heading      | When to include                                     |
|----------------------|-----------------------------------------------------|
| Directions           | Grammar has a Direction rule                        |
| Node shapes          | Grammar defines multiple shape variants             |
| Edge types           | Grammar has multiple EdgeArrow/RelOp variants       |
| Relationship types   | For ER, class, requirement, C4 — relation keywords  |
| Entry / Event syntax | For timeline, journey, gantt — per-entry syntax     |
| Block keywords       | subgraph, section, group, etc.                      |
| Config keywords      | Grammar-level directives (title, tickInterval, etc.)|
| Overlays             | note, legend (shared overlay directives)            |
| Directives           | style, classDef, click — captured-not-interpreted   |
| Frontmatter          | Only if grammar has Frontmatter rule                |
| Comments             | ONLY if grammar has `%%` Comment rule (see Part 3)  |
| Minimal snippet      | ALWAYS required                                     |

**Table format rules:**
- Use `·` (middle dot U+00B7) to separate alternatives on a single cell.
- Literal syntax tokens go in backticks.
- Keep table rows to a single line; wrap into a second row only if > 120 chars.
- No lorem-ipsum descriptions — every cell is derived from the grammar source.

**Source discipline:** Every option listed MUST exist in the family's `grammar.peggy` (or its `index.ts` hand-parser). If uncertain, grep the grammar. Do NOT invent options.

---

## Part 2 — Example `%%` Header Convention

### Format (verbatim)

The `%%` header block is inserted AFTER the diagram's first line (the header keyword line)
and BEFORE any content lines. Every line MUST start with `%%`.

```
<header keyword> <direction or first token>
%% ────────────────────────────────────────────────────────────────────────────
%% <FAMILY NAME UPPER-CASE> — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:      <keyword1> | <keyword2>
%% <Category>:  <value1> · <value2> · <value3>
%% <Category>:  <value1> · <value2>
%% ...
%% ────────────────────────────────────────────────────────────────────────────
  <first content line of the diagram>
```

**Rules:**
- Separator line is exactly 76 `─` characters (U+2500) after `%% `.
- Category labels are right-padded with spaces so colons align (use 13-char label field).
- Summarise options compactly — one line per category. If a category's values overflow 78 chars, wrap to a second `%%` line with the same indentation.
- Copy the block verbatim across all `.mmd` files in the same family directory — do not customise per file.
- The block is purely informational: it must NOT alter the rendered SVG in any way other than trivial re-render noise (e.g., background rect coordinate style).

### Verified exemplar

See `examples/mermaid/flowchart/flowchart.mmd` for the canonical reference.
Confirmed: `node scripts/preview.mjs examples/mermaid/flowchart/` exits 0, all 3 SVGs regenerate, diagram layout is unchanged.

---

## Part 3 — Comment Safety Detection Rule

### Detection method

Before adding ANY `%%` header, the agent MUST check whether the family's grammar supports `%%` comments:

```bash
grep -c '%%' src/diagrams/<mermaid|triton>/<family>/grammar.peggy
```

- Output **> 0**: `%%` is supported — proceed with header insertion.
- Output **0** (or grammar.peggy does not exist): `%%` is NOT supported — see fallback below.

For families with a hand-written parser (`index.ts`) and no `grammar.peggy`, grep the `index.ts` instead:

```bash
grep -c '%%' src/diagrams/<mermaid|triton>/<family>/index.ts
```

### Families confirmed to support `%%` (as of 2026-07-06)

| Family      | Location             | `%%` in grammar |
|-------------|----------------------|-----------------|
| flowchart   | mermaid/flowchart    | ✓ YES           |
| sankey      | mermaid/sankey       | ✓ YES           |
| timeline    | mermaid/timeline     | ✓ YES           |
| poster      | triton/poster        | ✓ YES           |

All other 18+ families currently have NO `%%` rule in their grammar — confirmed by grep.

### Fallback for families WITHOUT `%%` support

1. **Do NOT add** the `%%` header block to any `.mmd` example files for that family.
2. **Do add** the following note to the family's fragment, at the bottom BEFORE the "Minimal snippet" section:

```markdown
> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.
```

3. The "Comments" section is **omitted** from the fragment for that family.

---

## Part 4 — Commands

All commands are run from the repo root (`/Users/cristianormazabal/Projects/triton`).

| Step | Command | Pass condition |
|------|---------|----------------|
| Build grammars only | `node scripts/build-grammars.mjs` | Exits 0, 23 grammars compiled |
| Full build | `pnpm build` | Exits 0 |
| Render one example dir | `node scripts/preview.mjs examples/<path>/` | Exits 0, prints `✓ <name>.svg` for each file |
| Type check | `pnpm typecheck` | Exits 0, 0 errors |
| Verify SVG unchanged (layout) | `git diff --stat examples/<path>/*.svg` | 0 additions/deletions OR only trivial 2-line background rect changes |

**After adding `%%` headers to a family's examples, the agent MUST:**
1. Run `node scripts/preview.mjs examples/<mermaid|triton>/<family>/`
2. Confirm exit code 0 and `✓ <name>.svg` for every file.
3. If any file errors: remove the header block from that file, note the failure in the fragment (same fallback note as Part 3).

---

## Part 5 — Family Groups and Assignment

Agents are assigned families by group. Each group writes its fragments to
`docs/diagram-options/_fragments/<family>.md`.

**Group A** — class, state, er, c4, requirement  
**Group B** — sequence, timeline, journey, gantt, gitgraph, kanban  
**Group C** — pie, xychart, quadrant, radar, sankey, mindmap  
**Group D** — architecture, block, packet, topology, poster  
**Group E** — all `ds` subkinds: array, linkedlist, memory, page, tree, plan, avl, rbtree, btree, radix, segtree, heap, queue, cqueue, deque, pqueue, stack, hashmap, matrix, trie, nodegraph, unionfind

**flowchart** is DONE — do not reassign.

### Fragment filename convention

- Mermaid families: `docs/diagram-options/_fragments/<family>.md`  
  e.g., `class.md`, `state.md`, `er.md`
- Triton families: `docs/diagram-options/_fragments/triton-<family>.md`  
  e.g., `triton-architecture.md`, `triton-block.md`
- DS subkinds: `docs/diagram-options/_fragments/ds-<subkind>.md`  
  e.g., `ds-array.md`, `ds-trie.md`

### Concatenation (done last, by Leslie or orchestrator)

Once all fragments are written:
```bash
cat docs/diagram-options/_fragments/*.md > docs/diagram-options.md
```
Order: flowchart first, then groups A–E alphabetically within each group.

---

## Part 6 — Grammar Source Locations

All grammar files follow the pattern:
- `src/diagrams/mermaid/<family>/grammar.peggy` (18 Mermaid families)
- `src/diagrams/triton/<family>/grammar.peggy` (Triton families with PEG grammar)
- `src/diagrams/ds/<subkind>/index.ts` (DS subkinds — hand-written parsers, no .peggy)
- `src/diagrams/triton/ds/` may also have hand-parsers per subkind

Examples live under:
- `examples/mermaid/<family>/` for Mermaid families
- `examples/triton/<family>/` for Triton families  
- `examples/ds/<subkind>/` for DS subkinds

---

## Decisions recorded

1. **Fragment-first, concat-last** — per-family fragments avoid merge conflicts when 5 agents run in parallel.
2. **`%%` only after header keyword line** — the flowchart grammar's `BlankLine = _ Comment? NL` rule only matches within `Statements` (after the header), not before it. All verified-supporting grammars follow the same pattern.
3. **Comment safety is per-grammar, not global** — agents must grep each grammar individually. 14 of 18 Mermaid grammars currently have NO `%%` rule.
4. **SVG noise is acceptable** — trivial background-rect style changes (2 lines) are not a regression. What matters is exit 0 and layout/content identity.
5. **Options are grammar-derived only** — no invented syntax. If a feature isn't in the grammar, it isn't listed.


---

# Decision Record: Diagram-Options Reference Assembled

**Author:** Leslie (Lead / Spec Architect)  
**Date:** 2026-07-06  
**Status:** Done

---

## Summary

All 45 diagram-family option fragments were assembled into the final central reference document and the full test suite verified clean.

---

## Final Artifact Paths

| Artifact | Path |
|----------|------|
| Central reference doc | `docs/diagram-options.md` |
| Fragment directory | `docs/diagram-options/_fragments/` (45 `.md` files) |
| Format spec | `.squad/decisions/inbox/leslie-diagram-options-format.md` |

---

## Document Structure

`docs/diagram-options.md` contains 45 family sections in three groups:

1. **Mermaid Diagrams (18)** — flowchart first, then c4 · class · er · gantt · gitgraph · journey · kanban · mindmap · pie · quadrant · radar · requirement · sankey · sequence · state · timeline · xychart
2. **Triton Diagrams (5)** — architecture · block · packet · poster · topology
3. **Data-Structure / DS Diagrams (22)** — array · avl · btree · cqueue · deque · hashmap · heap · linkedlist · matrix · memory · nodegraph · page · plan · pqueue · queue · radix · rbtree · segtree · stack · tree · trie · unionfind

---

## Families with Inline `%%` Example Headers

The following four families have parsers that strip `%%` comment lines before evaluation. Their example `.mmd` files carry a `%%`-prefixed options block at the top of each file, making the available syntax visible alongside the diagram source:

| Family | Example files with inline header |
|--------|----------------------------------|
| `flowchart` | `ci-pipeline.mmd`, `flowchart.mmd`, `order-processing.mmd` |
| `sankey` | `sankey.mmd` |
| `timeline` | `ai-timeline.mmd`, `company-history.mmd`, `customer-journey.mmd`, `our-timeline.mmd`, `product-roadmap.mmd`, `release-roadmap.mmd`, `sections.mmd`, `timeline.mmd`, `vertical-journey.mmd` |
| `poster` | `ds-poster.mmd`, `engineering-dashboard.mmd`, `launch-readiness.mmd`, `poster.mmd`, `row-spanning.mmd`, `spanning.mmd`, `sql-engine.mmd` |

All other families carry a fallback note in their fragment explaining that `%%` headers are not supported and referring readers to `docs/diagram-options.md`.

---

## Test Result

`pnpm test` (from repo root, 2026-07-06):

```
Test Files  30 passed (30)
     Tests  384 passed (384)
  Duration  3.94s
```

**Result: PASS.** No `%%` header broke any family's render. The 69-example corpus in `test/examples.test.ts` rendered cleanly.

---

## Unexpected Git Changes

Two untracked files appeared that are not part of this deliverable:

- `fix_poster_headers.py` — scratch script left by a sub-agent; not committed.
- `examples/triton/ds/array/array.svg` — new untracked SVG render; not committed.

Neither affects the test corpus or the assembled reference doc.


---

# Decision: Diagram-Options Group A — class, state, er, c4, requirement

**Author:** Bjarne (Ingestion Design)  
**Date:** 2026-07-06  
**Status:** DONE — all 5 fragments written; no `%%` headers added  

---

## Summary

Five grammar-derived option fragments have been written for Group A families,
following Leslie's spec (`leslie-diagram-options-format.md`) and the flowchart exemplar.

Fragment paths:
- `docs/diagram-options/_fragments/class.md`
- `docs/diagram-options/_fragments/state.md`
- `docs/diagram-options/_fragments/er.md`
- `docs/diagram-options/_fragments/c4.md`
- `docs/diagram-options/_fragments/requirement.md`

---

## Per-family `%%` comment support

| Family      | Grammar path                                    | `%%` count | Headers added | Fallback note |
|-------------|-------------------------------------------------|------------|---------------|---------------|
| class       | `src/diagrams/mermaid/class/grammar.peggy`      | 0          | NO            | YES           |
| state       | `src/diagrams/mermaid/state/grammar.peggy`      | 0          | NO            | YES           |
| er          | `src/diagrams/mermaid/er/grammar.peggy`         | 0          | NO            | YES           |
| c4          | `src/diagrams/mermaid/c4/grammar.peggy`         | 0          | NO            | YES           |
| requirement | `src/diagrams/mermaid/requirement/grammar.peggy`| 0          | NO            | YES           |

All five Group A families lack a `%%` Comment rule. No example `.mmd` files were
modified. All five fragments include the fallback note and omit the Comments section.
Preview (`node scripts/preview.mjs`) was not run — no headers to validate.

---

## Families that needed the fallback

All five: **class, state, er, c4, requirement**.

---

## Key grammar notes

- **class**: 14 RelTok alternatives; cardinality via quoted strings; `note` accepted-discarded;
  no direction rule.
- **state**: Single `-->` transition arrow; `<<choice|fork|join>>` pseudo-states; `direction`
  accepted by DirectiveLine but discarded (not applied by Triton layout).
- **er**: Crow's-foot ErTok pattern `[|}{o][|}{o](--|..)[|}{o][|}{o]`; attribute keys PK/FK/UK;
  label required on every relation.
- **c4**: 5 header variants; `kindOf()` maps freeform NodeKind identifiers to 8 IR kinds;
  4 boundary types; 3 relation keywords (Rel/Rel_Ext/BiRel).
- **requirement**: 7 ReqKind alternatives (case-insensitive); NO Frontmatter rule (unique in
  Group A); relationship type is unconstrained Ident (conventional: satisfies/contains/refines/derives).


---

# Decision: Group B Diagram-Options — Comment Support and Fallbacks

**Author:** David (Research Lead)
**Date:** 2026-07-06
**Status:** COMPLETE
**Families:** sequence, timeline, journey, gantt, gitgraph, kanban

---

## Summary

Fragment files have been written for all 6 Group B families under
`docs/diagram-options/_fragments/<family>.md`. All options are grammar-derived
(sources: `src/diagrams/mermaid/<family>/grammar.peggy` and, for gantt, also
`src/diagrams/mermaid/gantt/index.ts`).

---

## Per-Family `%%` Comment Support

### `grep -c '%%' src/diagrams/mermaid/<family>/grammar.peggy` results

| Family   | Count | `%%` supported? | Action taken                                  |
|----------|-------|-----------------|-----------------------------------------------|
| sequence | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| timeline | 1     | ✓ YES           | Headers added to all 9 `.mmd` examples (see constraint below) |
| journey  | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| gantt    | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| gitgraph | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| kanban   | 0     | ✗ NO            | Fallback note added to fragment; no headers   |

---

## Timeline `%%` Placement Constraint (NEW FINDING)

**Finding:** Although timeline's grammar defines `Comment = "%%" [^\n]*`, this
rule is only reachable via `BlankLine = _ Comment? NL` inside the `Body`
alternative. The grammar's `Document` rule is:

```
Document = ExtFrontmatter? _ Header _ Directive* _ Body _
```

`Directive*` matches `title`, `subtitle`, `theme`, `layout`, `axisUnit` before
`Body` begins. Inserting `%%` lines between the `timeline` keyword and the
directive lines causes a parse error because `%%` is not a valid token in the
`Directive*` context.

**Rule for timeline `%%` headers:**
> `%%` comment lines MUST appear after all directive lines and before the first
> Body item (section / entry). Placing them immediately after `timeline\n`
> (as the spec's flowchart model suggests) causes a PARSE_ERROR.

**Verification:** After repositioning the header block to after the last
directive in each of the 9 timeline example files, `node scripts/preview.mjs
examples/mermaid/timeline/` exited 0 with `✓ <name>.svg` for all 9 files.

**Recommendation for spec update:** Leslie's Part 2 placement rule ("after the
diagram's first line") should be annotated with a grammar-class exception: for
families whose grammars have `Directive*` between the header keyword and the
body, `%%` headers belong after the last directive, not after the keyword line.

---

## Fallback Note Text (applied to all families with no `%%` support)

```markdown
> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.
```

Applied to: `sequence.md`, `journey.md`, `gantt.md`, `gitgraph.md`, `kanban.md`.

---

## Fragment File Inventory

| Fragment path                                         | `%%` headers in examples? | Preview |
|-------------------------------------------------------|---------------------------|---------|
| `docs/diagram-options/_fragments/sequence.md`        | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/timeline.md`        | Yes — 9 files             | ✓ exit 0, 9 SVGs |
| `docs/diagram-options/_fragments/journey.md`         | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/gantt.md`           | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/gitgraph.md`        | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/kanban.md`          | No (fallback)             | N/A     |

---

## Key Grammar Findings (source discipline)

**sequence** (`grammar.peggy`):
- Arrow rule (8 variants): `->>`, `-->>` (solid/dashed arrow); `->`, `-->` (open); `-x`, `--x` (cross); `-)`, `--)` (async).
- Activation inline: `+` activates target, `-` deactivates source (suffix on arrow).
- Note placements: `over`, `left of`, `right of`.
- Fragments: `alt` (else), `opt`, `loop`, `par` (and), `critical`, `break` — all closed with `end`.
- Explicit `activate`/`deactivate` statements: parsed but return `{ t: 'ignore' }` — no effect.

**timeline** (`grammar.peggy`):
- L1 directives (Mermaid): `title`, `subtitle`, `theme`.
- L2 directives (Triton ext): `layout`, `axisUnit`.
- L1 entry: `date : Event text`.
- L2 range: `start -- end : Label : status @track | desc`.
- L2 point: `date : Label : milestone|active|done|blocked @track | desc`.
- Statuses: `active`, `done`, `blocked`, `default`.

**journey** (`grammar.peggy`):
- Task: `label : score : Actor1, Actor2`. Score is numeric; grammar pattern: `"-"? [0-9]+ ("." [0-9]+)?`.
- No frontmatter, no `%%`.

**gantt** (`grammar.peggy` + `index.ts`):
- `ExcludesLine` accepts: `excludes`, `axisFormat`, `todayMarker`, `tickInterval` — parsed, returned null.
- Task meta resolved by `index.ts`: `STATUS_FLAGS = new Set(['done','active','crit','milestone'])`.
- `after id` dependency: `re.test(startTok, /^after\s+/i)`.
- Duration: regex `(\d+(?:\.\d+)?)\s*([dwhm]?)` — `d`/`w`/`h` have explicit cases.

**gitgraph** (`grammar.peggy`):
- No `cherry-pick` statement — not in grammar.
- `switch` is a grammar-level alias for `checkout`.
- `order: N` on `branch` is parsed but value not captured in IR.
- `Opt` rule covers `id`/`tag`/`type` for both `commit` and `merge`.

**kanban** (`grammar.peggy`):
- Column: any unindented text line (`$[^\n]+`).
- Card: `id?` (`$[a-zA-Z0-9_-]+`) + `"[" text:$[^\]\n]+ "]"`.
- No priorities, assignees, metadata — grammar only tracks `id` and `text`.


---

# Decision: Group C Diagram Options — Comment Support & Fragment Summary

**Author:** Mark (IR & Data Modeling)  
**Date:** 2026-07-06  
**Status:** DONE — all 6 Group C fragments written; sankey `%%` header verified

---

## Summary

Per-family `%%` comment support and fragment delivery for Group C: pie, xychart, quadrant, radar, sankey, mindmap.

---

## Per-family findings

| Family    | `%%` in grammar.peggy | Action                             | Preview result         | Fragment path                                          |
|-----------|----------------------|------------------------------------|------------------------|--------------------------------------------------------|
| pie       | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/pie.md`               |
| xychart   | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/xychart.md`           |
| quadrant  | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/quadrant.md`          |
| radar     | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/radar.md`             |
| sankey    | 2 — SUPPORTED        | Header block added to sankey.mmd   | exit 0 · sankey.svg ✓  | `docs/diagram-options/_fragments/sankey.md`            |
| mindmap   | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/mindmap.md`           |

---

## Fallback note (applied to pie, xychart, quadrant, radar, mindmap)

Each fragment without `%%` support carries this note (per Leslie's Part 3 spec) above the Minimal snippet section:

> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.

---

## Sankey `%%` header block

Inserted after `sankey-beta` (header keyword line) in `examples/mermaid/sankey/sankey.mmd`:

```
sankey-beta
%% ────────────────────────────────────────────────────────────────────────────
%% SANKEY — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:      sankey-beta
%% Links:       Source,Target,Value  (one CSV row per link)
%% Comments:    %% text  (stripped before parse)
%% ────────────────────────────────────────────────────────────────────────────
```

Verified: `node scripts/preview.mjs examples/mermaid/sankey/` → exit 0, `✓ sankey.svg`.

---

## Key grammar facts (options-catalogue)

- **pie**: `showData` flag + `title <text>` both on header line; slices as `"Label" : <num>` rows.
- **xychart**: Header `xychart-beta [horizontal|vertical]`; `title`, `x-axis [cats]`, `y-axis "label" min --> max`; series `bar [v,…]` and `line [v,…]`.
- **quadrant**: `quadrantChart`; `title`, `x-axis left --> right`, `y-axis bottom --> top`, `quadrant-1..4 label`; points `Label: [x, y]` (x,y ∈ 0–1).
- **radar**: `radar-beta`; `title`, `max`, `min`; `axis id["Label"],…`; `curve id["Label"]{v,…}`.
- **sankey**: `sankey-beta`; CSV rows `Source,Target,Value`; `%%` comments stripped by grammar.
- **mindmap**: `mindmap`; YAML frontmatter; indentation = hierarchy depth; shape wrappers `((…))` `(…)` `[…]` `{{…}}` stripped by `index.ts:cleanLabel`; `::icon(name)` directive attaches icon to preceding node.


---

# Decision: Group D Diagram-Options — Comment Support & Fallbacks

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-06  
**Status:** COMPLETE  

---

## Summary

All five Group D (Triton) families have been processed: fragments written, `%%` support
verified per grammar, headers added where safe, previews confirmed.

---

## Per-Family Results

### architecture

- **Source:** `src/diagrams/triton/architecture/grammar.peggy`
- **`%%` count:** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/architecture/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-architecture.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-architecture.md` ✓

### block

- **Source:** `src/diagrams/triton/block/grammar.peggy`
- **`%%` count:** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/block/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-block.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-block.md` ✓

### packet

- **Source:** `src/diagrams/triton/packet/grammar.peggy`
- **`%%` count:** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/packet/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-packet.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-packet.md` ✓

### topology

- **Source:** No `grammar.peggy`; hand-parser `src/diagrams/triton/topology/topology.ts`
- **`%%` count (in topology.ts):** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/topology/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-topology.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-topology.md` ✓

### poster

- **Source:** `src/diagrams/triton/poster/grammar.peggy`
- **`%%` count:** 1 — SUPPORTED
- **Action:** `%%` header block added to all 7 `.mmd` files in `examples/triton/poster/`.
- **Placement quirk:** The poster grammar parses `%%` comments only within `BodyItems`
  (via `BlankLine = _ Comment? NL`). The `GridDirective*` phase (between `poster "Title"` and
  the first `cell`) does NOT allow comments. Inserting the block immediately after the
  `poster` keyword line causes a PARSE_ERROR. **Correct placement: after the `columns N`
  (or last grid directive) line and before the first `cell` block.**
- **Preview:** `node scripts/preview.mjs examples/triton/poster/` → exit 0, all 7 SVGs ✓
  (`ds-poster.svg`, `engineering-dashboard.svg`, `launch-readiness.svg`, `poster.svg`,
  `row-spanning.svg`, `spanning.svg`, `sql-engine.svg`)
- **Fragment:** `docs/diagram-options/_fragments/triton-poster.md` ✓ (includes Comments section)

---

## Fragments Written

| Fragment path | Family | Comments section |
|---|---|---|
| `docs/diagram-options/_fragments/triton-architecture.md` | architecture | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-block.md` | block | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-packet.md` | packet | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-topology.md` | topology | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-poster.md` | poster | ✓ included |

---

## Notes for Orchestrator / Leslie

1. **poster `%%` placement rule is non-standard.** For all other grammars that support `%%`,
   the comment rule is available immediately after the header keyword line. For poster, it is
   only available in `BodyItems` (after grid directives). This is a grammar-level constraint;
   fixing it would require adding a `BlankLine` alternative to the `GridDirective*` loop.

2. **topology has no grammar.peggy.** It is fully hand-parsed in `topology.ts`. No Peggy
   compilation step for this family.

3. **architecture indentation-based group membership.** Services indented under a `group` line
   are implicitly assigned to that group (via `indent > curIndent && curGroup` in the action),
   in addition to the explicit `in <group>` syntax. Both are grammar-supported.


---

# Decision: Group E — DS Diagram-Options Fragments

**Author:** Edsger (Layout Algorithms)  
**Date:** 2026-07-06  
**Status:** COMPLETE  
**Task:** Write `docs/diagram-options/_fragments/ds-<subkind>.md` for all ds subkinds per Leslie's spec.

---

## Full subkind list (22 subkinds)

Source layout under `src/diagrams/triton/ds/`:

| Subkind | Source file | Header keyword(s) | Has examples |
|---------|-------------|-------------------|--------------|
| array | `struct/array.ts` | `array` | ✓ |
| linkedlist | `struct/linkedlist.ts` | `linkedlist` | — |
| memory | `struct/memory.ts` | `memory` | — |
| page | `struct/page.ts` | `page` | — |
| queue | `queue/queue.ts` | `queue` | ✓ |
| cqueue | `queue/cqueue.ts` | `cqueue` | ✓ |
| deque | `queue/deque.ts` | `deque` | ✓ |
| pqueue | `queue/pqueue.ts` | `pqueue` | ✓ |
| stack | `stack/stack.ts` | `stack` | ✓ |
| hashmap | `hashmap/hashmap.ts` | `hashmap` | ✓ |
| matrix | `matrix/matrix.ts` | `matrix` | ✓ |
| trie | `trie/trie.ts` | `trie` | ✓ |
| unionfind | `unionfind/unionfind.ts` | `unionfind` · `dsu` | ✓ |
| nodegraph | `graph/graph.ts` | `nodegraph` · `dsgraph` | ✓ |
| tree | `tree/index.ts` (grammar.peggy) | `tree` | ✓ |
| plan | `tree/plan.ts` (grammar.peggy) | `plan` | ✓ |
| avl | `tree/avl.ts` | `avl` | ✓ |
| rbtree | `tree/rbtree.ts` | `rbtree` | ✓ |
| btree | `tree/btree.ts` | `btree` | ✓ |
| radix | `tree/radix.ts` | `radix` | ✓ |
| segtree | `tree/segtree.ts` | `segtree` | ✓ |
| heap | `tree/heap.ts` | `heap` | ✓ |

---

## `%%` comment support: ALL use fallback

**Detection method:** `grep -c '%%' <parser-file>` for every subkind.

**Result:**

| Check | Finding |
|-------|---------|
| All hand-written parsers (`struct/`, `queue/`, `stack/`, `hashmap/`, `matrix/`, `trie/`, `unionfind/`, `graph/`) | 0 occurrences — use shared `lines()` helper which does NOT filter `%%` |
| `tree/grammar.peggy` (used by `tree` and `plan`) | 0 occurrences — no `%%` comment rule |

**All 22 subkinds: NO `%%` support.** No `%%` header blocks were added to any `.mmd` example files.

---

## Fallback note (applied to all 22 fragments)

All fragments include:

> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.

The "Comments" section is omitted from all ds fragments.

---

## Fragment files written

All 22 fragments written to `docs/diagram-options/_fragments/`:

```
ds-array.md
ds-linkedlist.md
ds-memory.md
ds-page.md
ds-queue.md
ds-cqueue.md
ds-deque.md
ds-pqueue.md
ds-stack.md
ds-hashmap.md
ds-matrix.md
ds-trie.md
ds-unionfind.md
ds-nodegraph.md
ds-tree.md
ds-plan.md
ds-avl.md
ds-rbtree.md
ds-btree.md
ds-radix.md
ds-segtree.md
ds-heap.md
```

---

## Render verification

Command: `node scripts/preview.mjs examples/triton/ds/<subkind>/` for each example directory.

| Directory | Files rendered | Exit code |
|-----------|---------------|-----------|
| `ds/array/` | array.svg | 0 ✓ |
| `ds/graph/` | graph.svg | 0 ✓ |
| `ds/hashmap/` | hashmap.svg | 0 ✓ |
| `ds/matrix/` | matrix.svg | 0 ✓ |
| `ds/queue/` | circular.svg · deque.svg · linear.svg · priority.svg | 0 ✓ |
| `ds/stack/` | stack.svg | 0 ✓ |
| `ds/trie/` | trie.svg | 0 ✓ |
| `ds/unionfind/` | unionfind.svg | 0 ✓ |
| `ds/tree/` | avl.svg · btree.svg · decision.svg · heap.svg · plan.svg · query-plan.svg · radix.svg · rbtree.svg · segtree.svg | 0 ✓ |

**Total: 21 SVGs regenerated, all exit 0.** No `.mmd` files were modified (no `%%` headers added), so SVG layout is unchanged from baseline.

---

## Notes

- The `preview.mjs` script does NOT recursively walk `examples/triton/ds/` — it must be invoked per subkind directory. Running it at `examples/triton/ds/` gives "No .mmd files found".
- Three subkinds have no example files: `linkedlist`, `memory`, `page`. Their fragments were derived entirely from parser source (`struct/linkedlist.ts`, `struct/memory.ts`, `struct/page.ts`).
- The tree family's `grammar.peggy` is the only `.peggy` file among ds subkinds (all others are pure hand-written `.ts` parsers).



---

# Decision: VS Code Extension Marketplace Icon

**Date:** 2026-07-09  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Decided  

## Context

The Triton VS Code extension (`focus-space.triton-vscode`) needed a Marketplace icon. Prior to this, only `preview.svg` existed — a 16×16 monochrome glyph for toolbar buttons.

## Decision

Created a full-color 256×256 icon with an unmistakable trident motif:

1. **Trident body:** Dominant vertical shaft, horizontal crossbar, three upward-pointing prongs (center tallest)
2. **Graph-node fusion:** Small glowing circles at prong tips connected by curved purple edges — the "diagram" layer
3. **High contrast:** Bright cyan→teal gradient (#67E8F9 → #14B8A6) against dark navy/purple background

### Design details

- **Background:** Navy→dark-purple diagonal gradient (#0D1B2A → #1a1040), rounded-square (rx=48)
- **Trident:** Filled rectangles with rounded corners (not strokes) — enables gradient rendering in rsvg-convert
- **Nodes:** Purple center (#7C3AED) + blue sides (#4A90D9), white cores (#F8FAFC), subtle glow filter
- **Bottom flourish:** Small wave curve at shaft base (blue #4A90D9)

### Files

- `extension/resources/icon.svg` — source vector (viewBox 0 0 256 256)
- `extension/resources/icon.png` — rasterized 256×256 PNG for Marketplace

### Wiring

`extension/package.json` has `"icon": "resources/icon.png"` between `categories` and `galleryBanner`.

## Rationale

- **Trident-first:** The trident shape is unmistakable at any size — reads as Poseidon's weapon, not a face
- **High contrast:** Bright cyan/teal against dark background ensures visibility at all sizes
- **Filled shapes:** Gradients on SVG strokes don't render in rsvg-convert; filled rects with rx work
- **Vertical composition:** Trident fills y=24 to y=222 — no large empty void
- **Straight crossbar:** Eliminates "frown" gestalt that caused sad-face misreading

## Technical learnings

- **rsvg-convert quirk:** `stroke="url(#grad)"` on `<line>` elements renders invisibly. Use `fill="url(#grad)"` on `<rect>` or `<path>` instead.
- **Gestalt awareness:** Two symmetric circles + downward arc = face. Break symmetry or use dominant visual elements to override.

## Alternatives considered

1. **Stroked lines with gradient** — failed due to rsvg-convert rendering bug
2. **Downward-curving crossbar** — created unintended "frown" face gestalt
3. **Dark trident colors** — invisible against dark background

## Impact

- Marketplace listing displays distinctive branded trident icon
- Extension sidebar shows recognizable icon at various sizes (128px, 32px)
- No runtime/code changes — purely visual/packaging


### 2026-07-08: Animated connector dots stop at arrowhead bases
**By:** Brian
**What:** Particle, comet, and stream connector animations now use a renderer-local motion path trimmed by `refX * strokeWidth + dotRadius` for default `markerUnits="strokeWidth"` markers, or `refX + dotRadius` for `markerUnits="userSpaceOnUse"`. The visible connector path and marker geometry remain unchanged; only each `<animateMotion path>` is shortened, with short final segments clamped to a non-inverted remaining segment.
**Why:** The marker's actual back edge is controlled by `refX`, not `markerWidth`. Stopping the dot center by the marker back-offset plus the dot radius makes the dot's leading edge kiss the arrowhead base without a visible gap or overlap.


### 2026-07-08: Connector animation set and static degradation
**By:** Brian
**What:** Connector animation is now a shared typed vocabulary: `march`, `particle`, `draw`, `pulse`, `glow`, `comet`, `stream`, `flow`, `colorcycle`, plus `none` as suppression. The routing engines pass any recognized animation name through to `ScenePath.animated`; unknown values still fall back to the existing dashed/dotted march default or render plainly for solid links. SVG rendering uses SMIL path animations, sibling `animateMotion` particles, and an inline user-space gradient for `flow`.
**Why:** Cristian needs to review every supported connector motion from one gallery while preserving static-export safety. Every animated connector keeps a visible base path; `draw` starts as a full line and then erases/redraws instead of starting invisible, and particle/comet/stream add motion elements alongside the normal stroke.


### 2026-07-08: Shared connector seam and cqueue wrap implementation
**By:** Brian
**What:** Added `src/crosslink/connectors.ts` as the diagram-agnostic post-layout connector seam over the existing v3 crosslink router. Poster now lowers normalized links into that seam, preserving its cardinal curve default in the poster adapter. Cqueue now lowers its implicit rear-to-front wrap to one generated orthogonal connector with N→N or W→W wall hints, a 36px outboard route padding derived from the old 44px arc band, `mod N` labeling, and front/rear anchor aliases.
**Why:** This keeps poster behavior on the existing engine path while making connector routing reusable by local DS diagrams without fabricating poster cell paths. The cqueue wrap is now an axis-aligned shared connector instead of bespoke cubic geometry, so horizontal/vertical and self-loop cases share the same routing/label/viewBox handling.




---

# Decision: d3-shape Integration — Phase 1 (Routing Path Emission)

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-05  
**Status:** Implemented ✓ — updated with curveStyle wiring

---

## Context

Phase 1 of the d3-shape integration plan adds `d3-shape` and `d3-path` as runtime dependencies and routes bezier path string construction through a dedicated adapter module, replacing a hand-crafted template literal in `BezierRouter`. A follow-up step added the optional `curveStyle` field to the routing contract so callers can opt into d3-shape curve interpolation per edge.

---

## Changes Made

### New dependency: `d3-shape@3.2.0` + `d3-path@3.1.0`
Added as runtime dependencies. `@types/d3-shape@3.1.8` and `@types/d3-path@3.1.1` added as dev dependencies (d3 v3 ships plain JS without bundled `.d.ts` files).

### New file: `src/routing/d3-curves.ts`
Thin adapter exposing three functions:
- `buildCubicBezierPath(from, cp1, cp2, to)` — uses `d3-path`'s `path()` object (`moveTo` + `bezierCurveTo`) to emit the SVG cubic bezier `C` command.
- `buildLinePath(points)` — uses `d3-shape`'s `line()` generator; available for future straight/polyline wiring.
- `buildCurvedLinePath(points, curveStyle)` — uses `d3-shape`'s `line()` generator with a named curve factory dispatched via `CURVE_FACTORIES` record.

### New type: `CurveStyle` in `src/contracts/routing.ts`
```
'catmull-rom' | 'cardinal' | 'basis' | 'natural' | 'monotone-x' | 'monotone-y'
```
Exported from the contracts barrel (`src/contracts/index.ts`).

### New field: `curveStyle?: CurveStyle` on `RouteRequest`
Optional. Bezier router only. When present, path emission delegates to `buildCurvedLinePath`; when absent, falls back to `buildCubicBezierPath` (existing behavior).

### Modified: `src/routing/router.ts`
- Imports `buildCurvedLinePath` alongside `buildCubicBezierPath`.
- `BezierRouter.route()` destructures `curveStyle` and uses a ternary on the `path` field: `curveStyle ? buildCurvedLinePath(...) : buildCubicBezierPath(...)`.
- The same `curveStyle` hook now also applies to straight and orthogonal routers so callers can opt into d3 interpolation without changing the underlying route geometry logic.
- All control-point computation and obstacle avoidance logic is unchanged.

### Modified: `src/diagrams/mermaid/flowchart/layout.ts`
- Forward-edge routing in flowcharts now passes `curveStyle: 'linear'`, preserving straight geometry while exercising the new path-emission hook.

### Modified: `test/routing.test.ts`
- Existing bezier suite kept intact (assertion updated to `toContain('C')` in Phase 1).
- New `bezier router — curveStyle` describe block adds 9 tests:
  - One per curve style (6) — each produces a non-empty path.
  - `curveStyle` preserves the four control points.
  - `curveStyle` path differs from the default cubic-bezier path.
  - Omitting `curveStyle` still emits the compact `M{x},{y}C{...}` format from `buildCubicBezierPath`.

---

## Deviations / Disclosures

- `buildLinePath` is provided in the adapter for future use but is **not yet wired** into `StraightRouter`, `OrthogonalRouter`, or `PolylineRouter`.
- The path string format from d3-path uses commas between coordinates (e.g., `M0,0C10,20,30,40,100,100`) rather than spaces. This is valid SVG. No consumer of the `Route.path` field depends on the specific whitespace format.

---

## Build / Test

- `pnpm build` ✓ — 0 errors, 0 warnings  
- `pnpm test` ✓ — 392/392 tests passed (21 routing tests: 12 original + 9 new)




---

# Decision: Poster Phase 1 — New Syntax

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-10T14:16-04:00
**Branch:** `ormasoftchile/poster-phase1`
**Implements:** Leslie's Phase 1 gap analysis (`.squad/decisions/inbox/leslie-poster-capability-analysis.md`)

---

## Summary

Four features added to the Triton poster/DS system, enabling ~80% coverage of the DSA-15-Patterns poster.

---

## New Syntax Reference

### Feature 1 — Per-cell highlight (array + matrix)

**Array — individual cells:**
```
array
  cells 2 1 5 2 3 4
  highlight 2 4        ← logical indices (0-based)
  index
```

**Array — contiguous window:**
```
array
  cells 2 1 5 2 3 4
  window 2-4           ← inclusive range: highlight cells 2, 3, 4
  index
  ptr L -> 2 "L"
  ptr R -> 4 "R"
```

**Matrix — specific cells:**
```
matrix
  row 0 0 0 0
  row 0 1 1 1
  row 0 1 2 2
  highlight 1,1 2,2    ← r,c pairs (space-separated)
```

**Rendering:** Highlighted cells use `palette.primary` fill at `fillOpacity: 0.22`, primary stroke, primary text. Non-highlighted cells are unchanged (`palette.surface`/`palette.border`).

---

### Feature 2 — Caption slot (poster cells)

```
cell sw "Sliding Window"
    array
        cells 1 3 -1 -3 5 3 6 7
        window 1-3
    caption "window size k=3"    ← muted text below sub-diagram
end
```

- `caption "text"` must be on its own line inside the `cell … end` block.
- Rendered as `palette.textMuted` centered text at the bottom of the cell card.
- Reserves space in the cell height — adjacent cells in the same row also grow.
- Fully optional; cells without a caption render exactly as before.

---

### Feature 3 — Freeform annotation overlay (note)

```
cell heap "Top K Elements"
    heap max insert 50 30 70 20 40
    note "k=3" at top-right       ← anchored to content area
    note "size=3"                 ← defaults to top-right
    caption "heap size = k"
end
```

**Position values:** `top-left` | `top-right` | `bottom-left` | `bottom-right` | `center`
**Default:** `top-right`

- Rendered as a semi-transparent pill (surface fill, primary border, primary bold text) overlaid on the sub-diagram content area.
- Multiple notes per cell are supported.
- `at` keyword and position are optional; default position is `top-right`.

---

### Feature 4 — Edge/path highlight (tree + nodegraph)

**Tree — traversal path:**
```
tree
  Root
    Left
      LeftLeft
    Right
path Root -> Left -> LeftLeft    ← top-level directive, label-based
```

- `path` lines are extracted BEFORE grammar parsing; labels look up the first matching node.
- Active edges render at `palette.primary`, strokeWidth 2.5.

**Nodegraph — per-edge kind:**
```
nodegraph
  directed
  A -> B : active     ← primary color, 2.5px stroke
  B -> C : dashed     ← textMuted, dash="6 3"
  C -> D : result     ← normal label, muted color
```

- `active` and `dashed` are reserved edge modifier keywords. If a label EXACTLY matches, it becomes a kind (not a label). All other labels are unchanged.
- No grammar change needed — parsed in `graph.ts` via string comparison.

---

## Files Changed

| File | Change |
|------|--------|
| `src/diagrams/triton/ds/struct/array.ts` | Added `highlights`, `window` to `ArrayDoc`; parse + render |
| `src/scene/strip.ts` | Added `fillOpacity?`, `stroke?` to `StripCell` |
| `src/diagrams/triton/ds/matrix/matrix.ts` | Added `highlights` to `MatrixDoc`; parse + render |
| `src/diagrams/triton/poster/ir.ts` | Added `PosterNote`, `NotePosition`, `caption?`, `notes?` to `PosterCell` |
| `src/diagrams/triton/poster/index.ts` | `extractCellAnnotations()`, `inferCellKind` + `tree` keyword |
| `src/diagrams/triton/poster/layout.ts` | Caption height reservation + render; note overlay render; `reservedCaptionHeight()`, `buildNoteOverlay()` |
| `src/diagrams/triton/ds/tree/ir.ts` | Added `activePaths?` to `TreeDocument` |
| `src/diagrams/triton/ds/tree/index.ts` | `extractPathDirectives()` pre-processes `path` lines |
| `src/diagrams/triton/ds/tree/layout.ts` | Active edge rendering in `layoutTree` |
| `src/diagrams/triton/ds/graph/graph.ts` | `GEdge.kind`, parse `active`/`dashed`, render with color/dash |
| `test/struct.test.ts` | 4 new array highlight tests |
| `test/ds-b1.test.ts` | 3 new matrix highlight tests |
| `test/poster.test.ts` | 6 new caption/note tests |
| `test/tree-semantic.test.ts` | 3 new tree path tests |
| `test/ds-b2.test.ts` | 4 new nodegraph edge kind tests |
| `examples/triton/poster/phase1/cell-highlight.mmd` | Feature 1 demo |
| `examples/triton/poster/phase1/caption.mmd` | Feature 2 demo |
| `examples/triton/poster/phase1/note.mmd` | Feature 3 demo |
| `examples/triton/poster/phase1/edge-highlight.mmd` | Feature 4 demo |
| `examples/triton/poster/phase1/two-pointers.mmd` | Combined DSA cards 1+2+11+13 demo |

---

## Bonus Fix

`inferCellKind()` in `poster/index.ts` was missing the `tree` keyword — tree content inside poster cells was falling through to `text` and rendering raw. Added `if (keyword.startsWith('tree')) return 'tree'`.

---

## Deferred (Phase 2)

- Numbered-title chrome (circled number before cell title) — requires poster layout change
- Interval/range bar chart primitive — new diagram type
- Hash ring primitive — new diagram type
- `dashed` modifier on tree path edges (currently only `active`)
- Edge animation for intra-diagram edges (e.g. rotating active edge in load balancing)


### 2026-07-08: Red/black tree node colours are semantic but palette-aware
**By:** Brian
**What:** Red-black tree nodes keep recognizable red/black semantics, but tree layout now derives dark-theme detection from palette background/surface luminance, tunes black fills away from dark canvases, and chooses strokes/text by contrast against the resolved theme palette.
**Why:** The old fixed black fill blended into dark canvases. Theme-aware fills and palette-derived outlines preserve red-black meaning while making rb tree nodes and shared tree decorations readable in both light and dark renders.


### 2026-07-08: Preview theme dropdown override precedence
**By:** Brian
**What:** The VS Code preview webview now stores `triton.previewTheme` in workspace state, treats an empty selection as Auto, and passes named selections as a forced base preset through `render()`/`renderSync()`.
**Why:** Auto must preserve editor/diagram-driven behavior, while explicit user selections need to override diagram `theme:` metadata and still blend with the editor by clearing only the SVG background.


### 2026-07-09T23-41-00: npm release automation for triton-core and triton-latex: lockstep versioning + OIDC trusted publishing
**By:** coordinator
**What:** npm release automation for triton-core and triton-latex: lockstep versioning + OIDC trusted publishing
**Why:** Requested by ormasoftchile (2026-07-09). Automate publishing of @cristianormazabal/triton-core (packages/core) and @cristianormazabal/triton-latex (latex/) to npm.

DECISIONS:
1. Lockstep versioning — one `[version:patch|minor|major]` tag in a commit message on main bumps BOTH packages to the SAME version and publishes both. Root package.json is single source of truth. Baseline unified to 0.1.1; first release will be 0.1.2.
2. Auth = OIDC Trusted Publishing (no stored NPM_TOKEN). One-time per-package config on npmjs.com. Adds provenance.
3. Mirrors owner's `[version:patch]` style. No tag = no-op.

Deliverables: .github/workflows/publish-npm.yml, version sync script, docs/RELEASING.md.



---

# Decision: Poster Replication Capability Analysis

**Author:** Leslie (Spec Architect)  
**Date:** 2026-07-10T14:06-04:00  
**Type:** Gap Assessment / Design Analysis

---

## Context

Cristian requested a rigorous analysis of two reference posters from algomaster.io:
1. **"DSA — 15 Patterns"** — a 5×3 grid of algorithm visualization cards
2. **"Load Balancing Algorithms"** — a 3×2 grid of network topology cards (animated GIF)

The question: **For each poster, what can Triton replicate TODAY, and what needs ADDING or CHANGING?**

This is a design/scoping deliverable — no implementation.

---

## 1. Overall Framing: Grid-of-Cards Composition

### What the posters require
Both posters share an identical **compositional structure**:
- A **titled grid of cards** (5×3 = 15 cards, 3×2 = 6 cards)
- Each card = **bordered panel** with:
  - A **numbered title** (e.g., "1. Two Pointers")
  - One or more **sub-diagrams** (array, tree, graph, etc.)
  - **Textual captions/annotations** (e.g., "slide →", "k=3")
  - **Per-element highlights** (coloured cells, active edges, glowing nodes)

### Triton's current capability
**YES** — `poster` keyword (src/diagrams/triton/poster/grammar.peggy, layout.ts) already supports:
- `poster "Title" columns N` — titled grid
- `cell [id] ["Title"] [span] … end` — titled cells with arbitrary sub-diagrams
- Span syntax `[N]` (col) or `[NxM]` (col × row)
- Cross-cell links with animation (march, particle, pulse, glow, etc.)
- Per-cell theme overrides (`@theme executive`)

**Existing example:** `examples/triton/poster/ds-poster.mmd` already demonstrates a titled grid containing array, stack, queue, matrix, heap, trie, nodegraph, hashmap, unionfind.

### What's missing for poster-perfect replication
| Gap | Severity |
|-----|----------|
| **No numbered-title chrome** — DSA poster has "1. Two Pointers" with number in coloured circle | Medium |
| **No footer/caption slot** — each card needs a caption line below the diagram | Small |
| **No per-cell cell highlighting** — arrays/matrices need individually-coloured cells | Medium |
| **No in-cell pointer overlays** — DSA poster shows L/R/M markers, "k=3" labels | Medium |

---

## 2. Per-Card Analysis: DSA — 15 Patterns

| # | Card | Closest Triton Feature | Replicable? | What's Missing |
|---|------|------------------------|-------------|----------------|
| 1 | Two Pointers | `array` (src/diagrams/triton/ds/struct/array.ts) + `ptr` | **Partial** | Array has `ptr i -> N "label"` but no coloured cell highlight to show "current element"; L/R pointer arrows exist but styling is fixed |
| 2 | Sliding Window | `array` + `ptr` | **Partial** | No window-region highlight (contiguous cell range fill); no "k=3" inset annotation; no "slide →" caption slot |
| 3 | Binary Search | `array` + `ptr` | **Partial** | L/M/R pointers work; missing: middle-element highlight colour, "target=11" overlay label |
| 4 | Frequency Counting | `array` + `hashmap` or `matrix` | **Partial** | Array renders fine; Key/Count table needs 2-column matrix with header row — matrix exists but no header row styling |
| 5 | Matrix Traversal | `matrix` (src/diagrams/triton/ds/matrix/matrix.ts) | **Partial** | Grid renders fine; missing: spiral-order path overlay (would need overlay arrow/path primitive), per-cell visit-order highlight |
| 6 | Monotonic Stack | `array` + `stack` | **Partial** | Both primitives exist; missing: "top→" label outside stack, "pop" action annotation, vertical pointer into stack |
| 7 | Prefix Sum | `array` × 2 + arrow between | **Partial** | Two arrays render fine; missing: "build" arrow label between arrays (cross-link exists but arrays must be in separate cells) |
| 8 | Overlapping Intervals | — | **No** | **No interval/range-bar primitive**; would need a horizontal bar chart with overlap visualisation |
| 9 | Greedy | `array` + text | **Partial** | Coin cells as array work; missing: "amount=5" annotation, "pick largest that fits" caption, "used:" result row |
| 10 | Top K Elements | `heap` (src/diagrams/triton/ds/tree/heap.ts) | **Partial** | Heap tree renders correctly; missing: "k=3" annotation, "top K:" result row below tree |
| 11 | Backtracking | `tree` (src/diagrams/triton/ds/tree/layout.ts) | **Partial** | Tree renders; missing: **path-highlight** (explore/backtrack edge colouring), dashed "backtrack" edges |
| 12 | Binary Tree Traversal | `tree` | **Partial** | Tree renders; missing: "out: 1 2 3" caption below tree, node visit-order highlighting |
| 13 | DFS | `nodegraph` (src/diagrams/triton/ds/graph/graph.ts) | **Partial** | Graph renders; missing: "stack · go deep" annotation, per-node visit-order label, edge highlight |
| 14 | BFS | `nodegraph` | **Partial** | Graph renders; missing: "queue · by level" annotation, BFS order label |
| 15 | Dynamic Programming | `matrix` with values | **Partial** | Grid renders; missing: per-cell formula overlay ("1+1=2"), cell-highlight for "current" cell, dp[i][j] label |

### DSA Poster Summary
- **Fully replicable today:** 0/15
- **Partially replicable (structure OK, annotations/highlights missing):** 14/15
- **Not replicable (no primitive):** 1/15 (Overlapping Intervals)

---

## 3. Per-Card Analysis: Load Balancing Algorithms

| # | Card | Closest Triton Feature | Replicable? | What's Missing |
|---|------|------------------------|-------------|----------------|
| 1 | Round Robin | `nodegraph` or `flowchart` | **Partial** | LB → Server A/B/C structure works; missing: **active-edge animation cycle** (edge glow rotates), stacked-box server layout |
| 2 | Weighted Round Robin | `nodegraph` | **Partial** | Same structure; missing: per-node weight annotation (×3, ×2, ×1), edge-weight styling |
| 3 | Least Connections | `nodegraph` | **Partial** | Same structure; missing: "3 conns" annotation per server node |
| 4 | Least Response Time | `nodegraph` | **Partial** | Same structure; missing: "90 ms" annotation per server node |
| 5 | IP Hash | `nodegraph` | **Partial** | Same structure; missing: IP label on LB node, sticky-highlight on one edge |
| 6 | Consistent Hashing | — | **No** | **No hash-ring primitive**; requires circular layout with nodes around circumference + key mapping |

### Load Balancing Poster Summary
- **Fully replicable today:** 0/6
- **Partially replicable:** 5/6
- **Not replicable (no primitive):** 1/6 (Consistent Hashing ring)

---

## 4. Gap Summary: Deduplicated Capability Gaps

### A. Composition / Layout Gaps

| Gap | Scope | Extends | Notes |
|-----|-------|---------|-------|
| **Numbered-title chrome** | Small | poster/layout.ts | Add optional `numbered: true` to cell; render circled number before title |
| **Caption/footer slot per cell** | Small | poster grammar + layout | `caption "text"` directive inside cell block |

### B. In-Diagram Annotation/Highlight Gaps

| Gap | Scope | Extends | Notes |
|-----|-------|---------|-------|
| **Per-cell highlight (array/matrix)** | Medium | struct/array.ts, matrix.ts | `cells 5 8* 13 21 34` where `*` marks highlighted; or `highlight 1 2 3` directive |
| **Window/range highlight** | Medium | struct/array.ts | `window 1-3` directive to shade a contiguous range |
| **Pointer overlay labels** | Small | struct/array.ts | Already has `ptr i -> N "label"`; needs label positioning refinement |
| **Annotation/caption box** | Medium | overlay system | `note "k=3" at top-right` — freeform text anchored relative to diagram |
| **Path/traversal highlight on tree** | Medium | tree/layout.ts | `path A -> B -> C : dashed` to colour specific edges |
| **Edge highlight/active state on graph** | Medium | graph/graph.ts, nodegraph | `edge A -> B : active` modifier |
| **Node visit-order badge** | Small | tree, graph | Show step number inside or beside node |

### C. Missing Primitives

| Gap | Scope | Notes |
|-----|-------|-------|
| **Interval/range bar chart** | Large | New DS primitive: `intervals [1,4] [2,5] [3,6]` renders horizontal bars with overlap visualisation |
| **Hash ring** | Large | New DS primitive: `hashring A B C key:cart:7` renders circle with nodes on circumference + key mapping |
| **Table with header row** | Medium | Extend `matrix` with `header a 2 b 1` or create lightweight `table` primitive |

### D. Animation / Step-Sequence Gaps

| Gap | Scope | Notes |
|-----|-------|-------|
| **Multi-state / frame animation** | Large | Load balancing poster rotates active edge; requires frame-sequence or CSS animation states |
| **Edge glow/pulse per-edge** | Small | Cross-link already has `{ anim: glow }`; internal graph edges need same |

---

## 5. Recommendations: Prioritised Roadmap

### Phase 1: Quick Wins (unlock ~80% visual coverage)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | **Per-cell highlight for array/matrix** | Small | Unlocks cards 1-7, 9-10, 12-15 of DSA poster |
| 2 | **Caption slot per cell** | Small | Adds "slide →", "pick largest", "out: 1 2 3" captions |
| 3 | **Annotation overlay (`note`)** | Medium | Adds "k=3", "amount=5", "dp[i][j]" labels |
| 4 | **Tree/graph edge highlight** | Medium | Backtracking, DFS, BFS path visualisation |

### Phase 2: New Primitives (unlock remaining cards)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 5 | **Interval/range bar** | Medium-Large | Unlocks "Overlapping Intervals" card |
| 6 | **Hash ring** | Large | Unlocks "Consistent Hashing" card |

### Phase 3: Advanced Animation (animated GIF fidelity)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 7 | **Frame-sequence animation** | Large | Rotating active-edge in load balancing |
| 8 | **Intra-diagram edge animation** | Small | Extend cross-link `anim:` to internal edges |

### Advised AGAINST (Scope Traps)

1. **Pixel-perfect poster replication** — The algomaster posters are hand-designed marketing graphics. Achieving identical aesthetics (gradients, drop shadows, glow halos) would require extensive CSS/filter work with diminishing returns. Triton's strength is semantic correctness and determinism, not pixel art.

2. **Multi-frame animation for deterministic SVG** — Triton's contract is "same source → same SVG". True frame-by-frame animation (like the GIF) breaks this. Consider: optional CSS animation classes applied post-render, but don't bake non-determinism into the IR.

3. **Table primitive as separate kind** — Avoid proliferating primitives. Extend `matrix` with a `header` directive instead of creating a new `table` keyword.

---

## 6. Evidence / File Citations

| Component | File Path | Notes |
|-----------|-----------|-------|
| poster grammar | src/diagrams/triton/poster/grammar.peggy:1-180 | Cell, link, span, theme syntax |
| poster layout | src/diagrams/triton/poster/layout.ts:1-120 | Grid placement, cell chrome |
| array | src/diagrams/triton/ds/struct/array.ts:1-300 | ptr, index, cells; no highlight |
| matrix | src/diagrams/triton/ds/matrix/matrix.ts:1-100 | row, noindex; no highlight |
| stack | src/diagrams/triton/ds/stack/stack.ts:1-100 | cells, capacity |
| heap | src/diagrams/triton/ds/tree/heap.ts:1-60 | max/min, builds tree |
| tree | src/diagrams/triton/ds/tree/layout.ts:140-180 | kinds: active, red, black, scan |
| nodegraph | src/diagrams/triton/ds/graph/graph.ts:1-100 | directed, edges |
| hashmap | src/diagrams/triton/ds/hashmap/hashmap.ts:1-100 | buckets, chains |
| cross-link anim | src/contracts/animations.ts:1-20 | march, particle, glow, etc. |
| poster example | examples/triton/poster/ds-poster.mmd | Working DS grid |

---

## Decision

**Recommendation:** Proceed with Phase 1 (per-cell highlight, caption slot, annotation overlay, edge highlight) to unlock the majority of DSA poster cards with minimal scope creep. Defer new primitives (interval bar, hash ring) to a dedicated follow-up if there's user demand.

**Rationale:** The compositional skeleton (titled grid of cards with sub-diagrams) already works. The gaps are mostly **annotation and highlight modifiers** within existing primitives — a surgical enhancement rather than architectural change.

**Rejected alternatives:**
- **Build a "poster template" system** — Over-engineering; the current cell-based model is flexible enough.
- **Implement frame-sequence animation** — Violates deterministic SVG contract; out of scope.

---

*Filed: .squad/decisions/inbox/leslie-poster-capability-analysis.md*

---

# Brian — AVL Badge Circle Solid Fill Fix

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-10T20:20-04:00
**Branch:** `ormasoftchile/refresh-ds-renders`

## Problem

Badge circles on tree nodes (AVL balance-factor counts, etc.) had `fill=palette.background`. In the VS Code preview, `palette.background` is `''` (empty string); `svg.ts` normalises empty fill to `fill="none"`, making the badge circle transparent. The node body showed through and the count text was hard to read.

## Fix

**File:** `src/diagrams/triton/ds/tree/layout.ts` (~line 287)

```diff
- elements.push(p.circle({ x: b.x + b.width - 3, y: b.y + 3 }, 9, palette.background, bc, 1.5));
+ elements.push(p.circle({ x: b.x + b.width - 3, y: b.y + 3 }, 9, palette.surface, bc, 1.5));
```

`palette.surface` is always a solid, opaque, theme-aware colour (e.g. `#F8FAFC` on the default theme). Badge text, stroke colour (`badgeColor`), radius, and position are unchanged.

## Validation

- `pnpm build`: ✓ clean
- `pnpm test`: 499/499 ✓ (no test asserted the old `palette.background` fill)
- `avl.png`: Badge circles are solid white/surface with green stroke (balance=0) and blue stroke (balance=±1). Count text is legible against the opaque background. No node body bleeds through.

---

# Brian — Circle Tree Node Connector Fix

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-10T20:29-04:00
**Branch:** `ormasoftchile/refresh-ds-renders`

## Problem

Tree edges to circle-shaped nodes were clipped to the bounding **box** border via `connectSlots → borderPoint`, not to the **circle** perimeter. On diagonal edges (widest spread = root level) the box-border point lies outside the circle arc, producing a visible gap of ~5–7 px. Near-vertical edges (deeper levels) show ~1 px discrepancy, invisible at normal scale.

## Fix

**File:** `src/diagrams/triton/ds/tree/layout.ts` — edge-drawing loop

Added a local `circleBorder` helper that, given a node center, radius, and unit direction, returns the exact perimeter point. In the edge loop, each endpoint is now resolved per the **node's own shape**:

- `shape === 'circle'` → perimeter point via `circleBorder`
- `shape === 'rect' | 'pill' | 'strip'` → existing `connectSlots` box clip (unchanged)

Mixed trees (circle parent + rect child, etc.) clip each end independently.

```diff
- const { start, end } = connectSlots(pb, cb);
+ const start = parentShape === 'circle'
+   ? circleBorder(pc, pb.width / 2, dir, 1)
+   : boxStart;
+ const end = childShape === 'circle'
+   ? circleBorder(cc, cb.width / 2, dir, -1)
+   : boxEnd;
```

No changes to edge color, width, labels, or any other layout logic.

## Validation

- `pnpm build`: ✓ clean
- `pnpm test`: 499/499 ✓ (no test asserted old edge coordinates)
- `avl.png` (1000 px wide): Root node (50) connectors touch the circle perimeter exactly at both sides — no gap. All other nodes similarly clean. Badge solid fill retained.
- `heap.png` (all-circle tree): Every edge meets every circle flush, including the wide root spread and the deep near-vertical edge to node 10.
- `nodegraph` unaffected — only `tree/layout.ts` was edited.

---

# Visual QA: Tree Rendering Fixes (PR #57)

**Reviewer:** Ken (Visual QA)
**Date:** 2026-07-10
**Branch:** ormasoftchile/refresh-ds-renders

---

## Test 1: avl.svg

**Command:** `rsvg-convert -f png -w 1000 -o avl-test.png examples/triton/ds/tree/avl.svg`

**What I see:**
- Root node "50" with two diagonal edges going to "30" (left) and "70" (right)
- Both edges from root touch the circle perimeter exactly — no gap, no overshoot
- Small badge circles visible at top-right of each node (balance factors: "1" on root and node 30; "0" on leaves)
- Badge circles have OPAQUE solid fill (light gray/white background) — digits clearly legible
- All other edges (30→10, 30→40, 10→5, 10→20, 70→60, 70→80) touch their respective circle perimeters cleanly

**Result:** ✅ **PASS**

---

## Test 2: heap.svg

**Command:** `rsvg-convert -f png -w 1000 -o heap-test.png examples/triton/ds/tree/heap.svg`

**What I see:**
- Root node "80" with two edges to "40" and "70"
- Root edges touch circle perimeter cleanly — no floating gap
- All-circle tree with 7 nodes (80, 40, 70, 20, 30, 50, 60, 10)
- Every edge endpoint touches its respective circle exactly
- No badges present (heap doesn't use balance factors) — correct behavior
- Edge from "20" to "10" is nearly vertical, touches both circles flush

**Result:** ✅ **PASS**

---

## Test 3: trie.svg

**Command:** `rsvg-convert -f png -w 1000 -o trie-test.png examples/triton/ds/trie/trie.svg`

**What I see:**
- Root is a large empty circle (no label) at top
- Internal "dot" circle nodes (empty circles representing prefixes c, d, a)
- Terminal pill-shaped nodes: "cat", "car", "card", "do", "dog" — solid blue fill with black text
- Edges from root circle to child circles: touch circle perimeter cleanly
- Edges from circles to pills: touch pill borders cleanly at top center
- Edge from "car" pill to "card" pill: vertical edge touches both pill tops/bottoms flush
- Edge labels (c, d, a, t, r, o, g) positioned correctly on edges
- No regression — pill edges still clip to pill borders, not to bounding boxes

**Result:** ✅ **PASS**

---

## Test 4: rbtree.svg

**Command:** `rsvg-convert -f png -w 1000 -o rbtree-test.png examples/triton/ds/tree/rbtree.svg`

**What I see:**
- Root node "13" (dark/black fill) with white text
- Black nodes: 13, 8, 17, 6, 11, 15, 25 — all dark gray/charcoal fill
- Red node: "1" — clearly red/coral fill, distinct from black nodes
- Root edges (13→8, 13→17) touch circle perimeters flush — no gap
- All other edges touch their circles exactly
- Edge from "6" to "1" (red node) touches both circles cleanly
- Color semantics preserved: red/black distinction clearly visible

**Result:** ✅ **PASS**

---

## Overall Verdict

### ✅ **OVERALL PASS**

Both fixes verified working correctly:

| Fix | Status | Evidence |
|-----|--------|----------|
| FIX 1: Solid badge fill | ✅ PASS | AVL badges have opaque white/gray fill; digits "0" and "1" fully legible |
| FIX 2: Circle edge clipping | ✅ PASS | All 4 diagrams show edges touching circle perimeters exactly; no floating gaps at root or anywhere |

### Defects Found

**None.**

All edge endpoints touch their target shapes (circles and pills) flush. Badge circles are opaque with legible digits. No regressions in trie pill-edge clipping.

---

*QA completed 2026-07-10 20:32 EDT*

---

# Node-Ref Tooltip: Feasibility Analysis + Implementation Plan

**Author:** Leslie (Lead / Spec Architect)
**Date:** 2026-07-10
**Status:** PROPOSED — awaiting review; feature queued for implementation
**Requested by:** Cristian (@ormasoftchile)

---

## Feature Request (verbatim)

> "I'd like a way to interactively discover the id of any node on a poster. For instance, how to reference a node on an AVL tree — it's not obvious. Could the user hover the desired node and, holding the Alt key, get a tooltip showing the reference? That way the user knows the endpoint to use in a crosslink."

---

## Executive Summary

**Recommended approach:** Embed a deterministic JSON anchor manifest inside the SVG (`<script type="application/json">`); webview extracts it and performs bounds hit-testing on Alt+hover. This unlocks interactive node discovery with minimal code footprint.

**Implementation scope (MVP):** Poster cells + standalone DS diagrams. Phase 1 effort: 3–4 hours.

---

## B. File-by-File Changes (Checklist)

### Core Package

| File | Change |
|------|--------|
| `src/frontend/index.ts` | Add new export `compileAndRenderSync(input, themeInput?, rendererName?, forcedThemeName?): Result<{ svg: string; anchors: NodeAnchorRegistry }>` that returns both the rendered SVG string AND the anchor registry. |
| `src/render/svg.ts` | Add helper `embedAnchorManifest(svg: string, anchors: NodeAnchorRegistry): string` that inserts `<script type="application/json" id="triton-anchors">…</script>` immediately before `</svg>`. |
| `src/contracts/index.ts` | Re-export any new type (e.g. `RenderWithAnchors<T>`). |

### Extension

| File | Change |
|------|--------|
| `extension/src/extension.ts` | Call the new `compileAndRenderSync` in `renderInto()` and `renderMarkdownInto()`. |
| `extension/src/preview-html.ts` | Add ~80 lines of tooltip logic: parse manifest, hit-test on Alt+hover, show/dismiss tooltip. |

### Tests

| File | Change |
|------|--------|
| `test/svg-embed-anchors.test.ts` (new) | Unit test `embedAnchorManifest`. |

---

## Note on Implementation Status

This decision records a complete implementation plan. **The feature is NOT yet built** — it is queued for future work. All technical details, coordinate mapping, UX behaviour, and risk mitigation are documented above for the implementer.

**Keep this decision in decisions.md** for reference when the tooltip feature is scheduled.

---

# Brian: Node-Ref Tooltip MVP — Decision Drop

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-11T00:45:00Z  
**Branch:** `ormasoftchile/node-ref-tooltip`  
**Status:** Implementation complete — tests green, build clean

---

## What Was Built (Phase 1 MVP)

Interactive node-reference discovery in the VS Code Triton preview: when the user holds **Alt** and hovers over a node in any diagram, a tooltip shows the exact crosslink endpoint string (e.g. `mytree.n0` in a poster, or bare `n0` in a standalone diagram). Clicking the tooltip copies the string to the clipboard.

---

## Files Changed

| File | Change |
|------|--------|
| `src/render/svg.ts` | Added `embedAnchorManifest(svg, anchors)` — inserts sorted JSON manifest before `</svg>` |
| `src/frontend/index.ts` | Added `compileAndRenderSync(...)` — compile + render + embed manifest, returns `{ svg, anchors }` |
| `extension/src/extension.ts` | `renderInto()` now calls `compileAndRenderSync` instead of `render()`; posts `result.value.svg` |
| `extension/src/preview-html.ts` | Added ~80 lines of tooltip JS to the inline nonce-gated `<script>` |
| `test/svg-embed-anchors.test.ts` | New: 13 unit tests for `embedAnchorManifest` and `compileAndRenderSync` |

---

## Architecture Decisions

### Manifest travels in the SVG (single payload)
The anchor JSON rides inside the SVG as `<script type="application/json" id="triton-anchors">`. No separate postMessage field needed. The `<script>` tag is inert data (no `src`, no executable type) — no CSP change required.

### `renderSync` stays anchor-free
`renderSync` is intentionally unchanged. All golden SVG tests call `renderSync`; adding the manifest there would invalidate every snapshot. `compileAndRenderSync` is the only path that embeds.

### Markdown preview path left unchanged
`renderMarkdownInto` still calls `renderFencedBlock` (which uses `renderSync`) — out of MVP scope. The tooltip will not appear in the built-in Markdown preview, only in the dedicated Triton side panel.

---

## Test Results

- **Baseline:** 499 tests (32 files)  
- **After:** 512 tests (33 files) — 13 new tests in `test/svg-embed-anchors.test.ts`  
- **Build:** `pnpm build` clean (tsc + esbuild extension bundle)

---

## Manual Verification in VS Code

1. **Open VS Code** in the Triton repo root.
2. Open any `.triton` file — for example, create one:
   ```
   tree
     Root
       Left
       Right
   ```
3. Run `Triton: Open Preview to the Side` (command palette or keybinding).
4. The preview panel renders the diagram.
5. **Hold the Alt key** and move the mouse over a node in the diagram.
   - A dark tooltip appears near the cursor showing the node's reference string (e.g. `n0`, `n1`, `n2`).
   - The tooltip shows `click to copy` hint.
6. **Click the tooltip** — the string is copied to the clipboard and the tooltip briefly shows `copied!`.
7. **Release Alt** — the tooltip disappears.
8. To verify a poster crosslink path: open a `.triton` file with a `poster` diagram containing a named `tree` cell. Alt-hover a node in that cell — the tooltip should show `<cellKey>.n0` style refs.

---

## Scope Boundaries (not in Phase 1)

- Markdown built-in preview (no tooltip — `renderSync` path unchanged)
- Custom tooltip styling beyond the dark-backdrop defaults
- Anchor hit-test for non-rectangular node shapes (port-level precision)

---

## Design Change — 2026-07-11: Anchors as Separate postMessage Payload

**Problem discovered:** Embedding `<script type="application/json" id="triton-anchors">` inside the SVG string and injecting it via `content.innerHTML = msg.svg` caused the webview to render black/blank. The VS Code webview CSP interferes with any `<script>` encountered during innerHTML parsing — even inert data scripts.

**Solution:** `compileAndRenderSync` now returns a **clean** SVG (byte-identical to `renderSync`) plus the raw `anchors` registry. The extension serialises anchors separately:
```
this.post({ type: 'svg', svg: result.value.svg, anchors: JSON.stringify(result.value.anchors), ... })
```
The webview script stores them in a module-scope `let currentAnchors = {}` variable, parsed from `msg.anchors` on each render, and persisted in `vscodeApi.setState` for reload recovery.

`embedAnchorManifest` remains exported from `src/render/svg.ts` and tested — it is available for future static-export or server-side use cases where no CSP applies.

**Impact:** No SVG content is changed. All 512 tests pass. Build clean.
---
