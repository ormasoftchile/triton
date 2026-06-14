# Squad Decisions — Recent & Current (2026-06-13)

---

## 🎊 TIER 1 COMPLETE — UML/Software-Line Shipped (2026-06-14)

**Status:** CONFIRMED COMMITTED  
**Commit(s):** f4b945e (class), 9c2d9b3 (state+er), 5b49d8c (c4)  
**Test Status:** 1281 tests passing, zero golden regressions

All four UML/Software-line diagram types now shipped end-to-end: **classDiagram**, **stateDiagram**, **erDiagram**, **C4**.

- **C4 Support:** Context/Container/Component/Dynamic all operational; Deployment gracefully degrades.
- **Layout Polish:** Orthogonal edge routing, boundary-aware placement, edge labels clear of all boxes, port distribution for edge fans, collision-avoidant routing around inner boundaries.
- **Determinism:** All coordinates deterministic via `rhuInt()`, grid layout fixed-column, declaration-order stable.
- **Gallery:** `mermaid-c4.{svg,png}` at 1189×744 px; Internet Banking System C4Context canonical example.

**Pattern Proven:** Bjarne builds grammar+parser vertical (real-crawl-hardened), Coordinator visually reviews, Barbara polishes layout/routing, Scribe archives decisions, then commit. All 1235 pre-existing tests remain byte-identical across Tier 1 (class/state/er/c4).

**Next:** Tier 2 = Charts family (pie, xychart, quadrant, radar) via grammar-of-graphics layer.

---

# Decision: Tier 1 COMPLETE — C4 Diagram Grammar

**Agent:** Bjarne (Ingestion Design)
**Date:** 2026-06-14
**Status:** ADOPTED

---

## Summary

The `C4` grammar is the fourth and final Tier 1 UML/Software-line type. Full vertical shipped end-to-end: Domain IR → deterministic layout → Scene IR → SVG/PNG, wired into the Mermaid front-end detect/parse/render pipeline.

Gallery: `mermaid-c4.png` at **1445×728** px — canonical "Internet Banking System" C4Context with nested Enterprise_Boundary + inner Boundary, Person/Person_Ext/System/System_Ext elements, labeled directed Rels.

Full suite: **1281 tests passing**. Zero golden regressions. All previously passing 1235 tests remain byte-identical.

---

## C4 IR Shape

### `C4Document` (packages/core/src/grammars/c4/types.ts)

```
C4Document {
  version: string
  metadata: { title?, theme?, diagramKind: C4DiagramKind }
  elements: C4Element[]         // top-level (outside any boundary)
  boundaries: C4Boundary[]      // top-level dashed container boxes
  rels: C4Rel[]
}
```

### Element kinds (`C4ElementKind`)
All 20 constructors: Person, Person_Ext, System, System_Ext, SystemDb, SystemDb_Ext, SystemQueue, SystemQueue_Ext, Container, Container_Ext, ContainerDb, ContainerDb_Ext, ContainerQueue, ContainerQueue_Ext, Component, Component_Ext, ComponentDb, ComponentDb_Ext, ComponentQueue, ComponentQueue_Ext.

- `_Ext` suffix → `extFill` (gray/muted) via theme; internal variants → category color (Person/System=blue, Container=medium-blue, Component=light-blue)
- `Db` variants → `dbArcHeight` hint; layout adds an ellipse-top arc path above the element rect to suggest a cylinder
- `Queue` variants → same as base kind for MVP (shape hint deferred; warn not emitted since it's non-breaking)
- `technology` field used in stereotype line: `«Container: Spring Boot»`

### Boundary nesting
`C4Boundary.children: Array<C4Element | C4Boundary>` — recursive. Zod uses `z.lazy()` for the recursive schema. Layout uses recursive `measureBoundary()` → `placeBoundary()`. Reasonable depth ≤ 4; deeper nesting degrades gracefully (children placed, extra boundary levels collapse) with a warning.

Boundary kinds: `Boundary`, `Enterprise_Boundary`, `System_Boundary`, `Container_Boundary` — all render as dashed titled container box (same visual; label distinguishes the kind semantically).

### Rel handling
Seven kinds: `Rel`, `BiRel`, `Rel_U`, `Rel_D`, `Rel_L`, `Rel_R`, `Rel_Back`.
- `BiRel` → arrowheads at both ends in layout.
- `Rel_Back` → from/to swapped at parse time (alias IDs stored as written; the swap is semantic).
- `Rel_U/D/L/R` → treated as plain `Rel` with a layout-hint warning (spatial hints deferred; grid layout places elements deterministically regardless).
- `C4Dynamic` numbered rels → first arg is integer → stored in `rel.order`; label rendered with order prefix `"1: label"`.

---

## Determinism Notes

- All coordinates via `rhuInt(v) = Math.floor(v + 0.5)`.
- Grid layout: column count = `Math.min(3, Math.ceil(Math.sqrt(N)))` where N = number of top-level items (elements + boundaries).
- Declaration-order stable — no sorting by name; items placed in the order they appear in the source.
- Edge geometry is deterministic: straight line from nearest-edge center of `from` box to nearest-edge center of `to` box, arrowhead perpendicular, label at midpoint with white background rect.
- No randomness anywhere.

---

## Parser Strategy (frontend/mermaid/c4.ts)

- Preprocesses with `preprocessMermaid` (frontmatter/comment stripping, directive extraction).
- `tokenizeArgs(argStr)` — quoted-string-aware comma splitting; handles `"foo, bar"` as one token; strips `$tag`/`$key=value` named args silently.
- Boundary `{ }` block nesting via an explicit stack of `C4Boundary | C4Document` scopes.
- Unknown constructor names → parse warning, skip line.
- Styling directives (`UpdateElementStyle`, `UpdateRelStyle`, `UpdateLayoutConfig`, `UpdateBoundaryStyle`) → silently ignored (parse-and-drop).
- `title` line → `doc.metadata.title`.
- All parser errors are warnings, never throws.

---

## Layout Strategy (grammars/c4/layout.ts)

Two-pass: measure → place.

**Measure pass:**
- `measureElement(el, tk)` → `{ width, height, stereotypeLine, descLines[] }`; description text is word-wrapped at `tk.descMaxWidth` characters before measuring.
- `measureBoundary(b, tk)` → recurse children, compute interior grid, add header + padding.

**Place pass:**
- Top-level items arranged in grid (max 3 columns).
- Boundaries placed as single grid cells of their measured size.
- Internal children placed recursively within boundary bounds.
- `byAlias: Map<string, BBox>` built for all elements (including nested) for edge routing.

**Edge pass:**
- Straight-line edges. Nearest-face intersection (horizontal or vertical, whichever minimizes Euclidean distance between face midpoints).
- Arrowhead: open triangle via `path` primitive.
- Label: `text` primitive at midpoint, white background `rect`.
- Tech sub-label: `text` primitive 14px below main label, smaller, dimmer.

---

## Sub-kinds Support Status

| Sub-kind       | Status     | Notes |
|----------------|------------|-------|
| C4Context      | ✅ Full    | Complete element+boundary+rel support |
| C4Container    | ✅ Full    | Same vocabulary; `technology` field in stereotype |
| C4Component    | ✅ Full    | Same vocabulary |
| C4Dynamic      | ✅ Full    | Numbered rels stored as `order`; prefix in rendered label |
| C4Deployment   | ⚠️ Degraded | `Node`/`Deployment_Node` parsed as `Boundary`; children parse normally; full nesting support deferred with public warning |

---

## Deferred Items

- `Rel_U/D/L/R` spatial placement (treated as plain Rel + layout-hint warning; grid layout is fixed-column and ignores directional hints)
- C4Deployment full `Node`/`Deployment_Node` semantic rendering (parses but treated as plain Boundary)
- Person circle/stick-figure icon (stereotype text «Person» used instead; shape icon deferred)
- Queue shape (cylinder-side icon deferred; Db cylinder arc implemented)
- `$tags`, `$link`, `$techn` named args (silently ignored)
- Accessibility `accTitle`, `accDescr` lines (silently ignored)
- `click` / `href` interactivity (silently ignored)

---

## Tier 1: COMPLETE

All four UML/Software-line types are now shipped:
1. `classDiagram` (2026-06-13) — commit f4b945e
2. `stateDiagram` (2026-06-14) — commit 9c2d9b3
3. `erDiagram` (2026-06-14) — commit 9c2d9b3
4. `C4` (2026-06-14) — this commit (coordinator to assign SHA)

Full Mermaid front-end now covers 9 diagram types (5 Tier 0 + 4 Tier 1). Ready for Tier 2 (chart family: pie, xychart, quadrant, radar).
# Decision: C4 Layout Polish — Tier 1 (2026-06-14)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-14  
**Status:** READY FOR COORDINATOR COMMIT  
**Scope:** `packages/core/src/grammars/c4/layout.ts` only

---

## Summary

Complete rewrite of the C4 layout engine to fix three visual defects in the Internet Banking System C4Context example: (1) edge label overlapping the Email System element box, (2) long crossing diagonals from Banking Customers B/C/D, (3) edges clipping through boundary containers. All pre-existing goldens stay byte-identical; 1280/1281 tests pass; the 1 failure is a pre-existing Skia flake unrelated to C4.

---

## Defects Fixed

### 1. Edge Label Overlapping a Box
**Root cause:** Naive geometric midpoint of diagonal `LinePrimitive` edges falls inside element boxes (e.g., "Uses" label at SystemAA→EmailSystem midpoint landed inside EmailSystem's rect).  
**Fix:** Labels placed on the longest segment of the orthogonal path, offset perpendicularly by 22 px. `adjustLabelAnchor` checks all solid element boxes (boundaries excluded — dashed borders are transparent for routing); if overlap, moves label above the box.

### 2. Long Crossing Diagonals + Edge Fan
**Root cause:** Top-level grid placed all elements in declaration order regardless of boundary grouping; routing used direct diagonal `LinePrimitive`.  
**Fixes:**
- **Element placement:** `computeTopLevelGrid` puts boundaries in row 0 and top-level elements in row 1 (centered). Inside boundaries, `sortBoundaryChildren` ranks Person/Person_Ext first (0), sub-Boundary second (1), other elements last (2). This centers hub systems directly below the persons who connect to them, minimizing long-distance crossings.
- **Orthogonal routing:** All rels use `PathPrimitive` with HVH or VHV L-shaped paths. `buildOrthogonalPath` searches for a collision-free midX (HVH) or midY (VHV) via a stepped scan.
- **Port distribution:** Two-pass `computePortPairs` first records per-(alias, side) counts, then assigns distinct port coordinates (spacing 24 px, clamped to box bounds). Multiple edges into the same element fan along the perimeter.

### 3. Boundary/Edge Crossing
**Root cause:** VHV routes for SystemAA→EmailSystem needed to jump the inner BankBoundary.  
**Fix:** Only solid element boxes (not boundary boxes) are checked for routing collision. The `collectElementBoxes` function recursively excludes `PlacedBoundary` items. VHV search goes above both elements (goUp=true) to find a midY above the boundary header, entering EmailSystem cleanly from its top.

---

## Additional Bug Found & Fixed: HVH Proximity Grazing

**Problem:** For CustomerA→SystemAA, the initial midX=(sx+ex)/2=537 is blocked by MainframeSystem's x-range at that y. The rightward search finds midX=670, putting the first horizontal segment at y=164 just 3 px from CustomerB's left edge — visually indistinguishable from "CustomerA connects to CustomerB."

**Detection:** After the initial "first H segment" check passes, also check if the VERTICAL at midX is blocked. If blocked (meaning midX will be adjusted rightward into proximity of another box), immediately switch to VHV with `fromSide='bottom', toSide='top'` (since source y < target y).

**Result:** CustomerA→SystemAA routes `M 327 224 V 273 H 737 V 310` — from CustomerA's bottom, across in clear space at y=273, down into SystemAA's top. No visual ambiguity.

---

## Architecture Decisions

### Element-Only Collision Checking
Boundaries (dashed containers) are excluded from all routing and label collision checks. Only `PlacedElement` rects count as obstacles. Rationale: boundaries are visual groupings, not physical obstacles; routing through them is intentional and readable.

### Forced VHV Direction
When switching from HVH to VHV due to blocked vertical:
- `sy < ey` (source above target) → `fromSide='bottom', toSide='top'`  
- `sy > ey` (source below target) → `fromSide='top', toSide='bottom'`

The existing blocked-horizontal case keeps `fromSide='top', toSide='top'` (routes above the obstacle — correct for SystemAA→EmailSystem jumping above BankBoundary).

### Arrowhead Travel Direction
Path endpoint is `ep = tip − travelDir × arrowSize`, not `tip − sideNormal × arrowSize`. The outward normal and travel direction differ for entering edges: entering from the right has sideNormal=+x but travel direction=−x. Each routing branch computes `finalEndDirX/Y` independently from the actual last-segment direction.

---

## Files Changed

- `packages/core/src/grammars/c4/layout.ts` — sole modified file (~920 lines, complete rewrite from 730-line original)

## Files NOT Changed

- `packages/core/src/grammars/c4/{types,schema,theme,index}.ts`
- `packages/core/src/frontend/mermaid/c4.ts`
- All other grammar files
- All existing golden images

---

## Verification

- **Typecheck:** `pnpm -C packages/core typecheck` → ✓ zero errors
- **Build:** `pnpm -C packages/core build` → ✓ success
- **Tests:** 1280/1281 pass (1 pre-existing Skia showcase-golden flake confirmed unchanged in baseline)
- **Gallery:** `examples/gallery/mermaid-c4.{svg,png}` regenerated; viewBox 1189×744
- **Visual check:** No edge label on any element box; no long crossing diagonals; clean orthogonal paths; CustomerA/B/C all enter SystemAA from above with distributed ports; CustomerD→SystemF clean horizontal; Sends e-mails/SMTP label in clear space above boundary


---

## 🎯 STRATEGIC PIVOT: FULL MERMAID-SUPERSET POSITIONING (2026-06-13)

**MAJOR DIRECTION CHANGE** — Supersedes earlier "diagram compiler reframe"

### Core Positioning
- **Full Mermaid Superset:** All 22 Mermaid diagram types parse & render out of the box
- **Beautiful Output:** Explicitly beat Mermaid's aesthetics (first-class pillar)
- **UML/Software Line:** Dedicated Tier-1 priority for class, state, ER, C4 diagrams
- **Agent-Authorable IR:** Dual front-end (humans: Mermaid-superset DSL; agents: structured IR) → shared Domain IR → Scene IR → backends

### Five Diagram Families
1. **Node-Link/Graph** — flowchart, C4, architecture, block, requirement, gitGraph, sankey (Sugiyama kernel)
2. **UML/Software** — sequence, class, state, ER (grammar-specific layouts)
3. **Charts (Grammar-of-Graphics)** — pie, xychart, quadrant, radar (NEW kernel)
4. **Timeline/Project** — gantt, timeline, journey, kanban (track-based)
5. **Tree/Hierarchy** — mindmap, treemap (Buchheim–Jünger–Leipert)

### Coverage Roadmap
- **T0:** Wire existing (flowchart, sequence, gantt, timeline, mindmap) — kernels ready; need parsers
- **T1:** UML line (class, state, ER, C4) — new IRs + layouts
- **T2:** Charts (pie, xychart, quadrant, radar) — grammar-of-graphics
- **T3:** Remaining (sankey, requirement, gitGraph, block, etc.)

### Superset+ Extensions
- Composition/posters, rich theming, animation, structured IR-as-API, cross-refs, icons

**Design doc** restructured (Leslie) to center Mermaid compatibility, aesthetics pillar, UML line, and dual front-end. PDF builds. PDF structure: 8 parts, 8 new sections (05-comparison, 15-frontend, 16-mermaid-compat, 17-superset-extensions, 18-aesthetics, 28-family-taxonomy, 29-chart-family, 60-roadmap); retired 4 old; rewrote/recontextualized core.

---

> **Compaction Note (2026-06-13):** Detailed decision sections for all grammars (Timeline T1–T5 variants, Sequence Inc1-2, Tree Inc1, Flow Inc1, Composition Inc1, Animation, Dark themes, Design doc sync, Diamond shape, Schema validation) have been archived to decisions-archive.md. Focusing this file on:
> - Index of shipped milestones  
> - Pending items list (now EMPTY — all closed)
> - Barbara's composition ir_file refs (merged from inbox)
> - Leslie's Mermaid-superset strategic pivot (merged from inbox)

---

# Decision: Tier 1 PROGRESS — stateDiagram + erDiagram Shipped

**Agent:** Bjarne (Ingestion Design) & Barbara (Semantics & Rendering)  
**Date:** 2026-06-14T04:41:53Z  
**Status:** ADOPTED

## Summary

Two more Tier 1 UML/Software-line grammars shipped end-to-end: `stateDiagram` (v1 & v2) and `erDiagram`. Both follow the established class-diagram architecture (Mermaid parser → Domain IR → deterministic layout → Scene IR → SVG/PNG). 

**State diagram** uses single-column layout with **left-margin side-routing** for skip transitions (distance > 1 rank): L-shaped paths exit left to a 19 px track, travel vertically, then re-enter target box horizontally. Labels on skip transitions placed at track edge with white background rectangles. Adjacent transitions use 34% label placement to avoid target-box collision.

**ER diagram** uses 2-column grid with **degree-sorted + interleaved column assignment**: entities sorted by relationship count (descending) then name, assigned to columns alternating `col = index % 2`. Crow's-foot notation drawn entirely with `path` primitives at both ends. Column/row gaps increased to accommodate glyphs and reduce crowding.

Real-crawl hardened, layout-polished after coordinator visual review. Full suite: 1235 tests passing, determinism preserved, goldens byte-identical. Gallery examples state 670×942, ER 656×706.

## Consequences

Tier 1 now covers **three of four UML/Software types**: classDiagram (shipped 2026-06-13T22:59Z), stateDiagram & erDiagram (shipped 2026-06-14). Remaining: C4. State routing, ER label placement, and multi-rank skip transitions are fully deterministic and production-ready.

## Committed

Commit: **9c2d9b3** "feat(mermaid): Tier 1 — stateDiagram + erDiagram"

---

# Decision: Tier 1 STARTED — classDiagram Shipped as First UML/Software-Line Grammar

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T22:59:00Z  
**Status:** ADOPTED

## Summary

Tier 1 kickoff complete. The full `classDiagram` grammar shipped end-to-end: new `class` domain IR (packages/core/src/grammars/class/{types,schema,layout,theme,index}.ts), Mermaid parser frontend (packages/core/src/frontend/mermaid/class.ts), integrated into the pipeline. All 6 UML relationships (inheritance/realization/composition/aggregation/association/dependency) rendered as Scene path primitives. Real-crawl hardened with 56 corpus tests, light+dark themes, gallery example mermaid-class.{mmd,svg,png} (552x984) + card 29. Full suite: 1139 passing, goldens byte-identical. Determinism preserved.

## Design Decisions

- **Semantic IR only:** packages/core/src/grammars/class/ with Zod validation and theme registry; deterministic layout engine.
- **Simple stable layout:** Declaration-order 2-column grid; left column filled first; per-class compartment sizing from `measureText`; `rhuInt()` for all coordinates.
- **UML markers as Scene paths:** Six relationship kinds as `path` primitives, preserving SVG/PNG/Skia backend compatibility.
- **Graceful degradation:** direction TB/LR parsed and warned (layout remains 2-column grid); generics normalized to base class name; unsupported constructs emit warnings.
- **Parser fidelity:** Auto-creates referenced classes, flattens namespace wrappers, supports block and member-declaration syntax, collects warnings for deferred constructs.

## Verification

- Build: `pnpm -C packages/core build` ✓
- Typecheck: `pnpm -C packages/core typecheck` ✓
- Tests: `pnpm -C packages/core test` → **1139 passing**
- Gallery: mermaid-class.{mmd,svg,png} + card 29 verified byte-identical

## Committed

- Commit: **f4b945e** "feat(mermaid): Tier 1 kickoff — classDiagram (UML/software line)"

## Next: Remaining Tier 1

Ready to begin: stateDiagram, erDiagram, C4 parsers + layouts.

---

# Decision: Mermaid Flowchart Parser Hardening — Real-Mermaid Crawl Fidelity

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T20:26:37-04:00  
**Status:** ADOPTED

## Summary

Hardened the Mermaid flowchart parser (`packages/core/src/frontend/mermaid/flowchart.ts`) to real-Mermaid fidelity. Root cause: node ID scanner included `-` in char class, breaking compact syntax like `A-->B` (scanned `A--` instead of `A`). Full scope included 13 edge operators, shape extension, clean label extraction, and public warnings. 914 tests pass (+62); gallery byte-identical.

## Root Cause Fixed

**Node ID scanner included `-` in character class** (`[a-zA-Z0-9_-]*`). For `A-->B`, the scanner consumed `A--` (stopped at `>`), leaving `>B` which matched no edge operator. Result: node `A--` created, no edge, node `B` dropped. All compact Mermaid syntax was broken.

**Fix:** Change to `[a-zA-Z0-9_]*` (no hyphen). Correct per Mermaid's own grammar.

## Scope of Changes

### 1. `packages/core/src/frontend/mermaid/flowchart.ts`

| Area | Change |
|------|--------|
| `scanNodeToken` — ID regex | Removed `-` from char class |
| `scanNodeToken` — extended shapes | 5 shapes with clean label capture: `{{…}}` hexagon→diamond, `[(…)]` cylinder→rect, `[/…/]` para→rect, `[\…\]` para→rect, `>…]` asymmetric→rect |
| `scanEdgeToken` | Added 13 edge operators: `<-.->`, `-.-`, `<==>`, `===`, `<-->`, `o--o`, `--x`, `--o` (with and without `\|label\|`) |
| `normalizeLabeledEdges` | Extended inline label handling: `== text ==>` → `==> \|label\|`, `-. text .->` → `-.-> \|label\|` |
| `parseChain` | Collects shape warnings; warns on unrecognized chain content |
| Direction warning | Fixed TB/TD check |

### 2. `packages/core/src/frontend/mermaid/index.ts`

| Area | Change |
|------|--------|
| `MermaidParseResult` | Added `warnings: string[]` field |
| `parseMermaid` | Now surfaces warnings via new type |

### 3. Test Coverage

61-case real-Mermaid corpus test (`mermaid-flowchart-corpus.test.ts`). Validates 7 acceptance criteria + 9 complete patterns.

## Acceptance Criteria Results

| AC | Description | Before | After |
|----|-------------|--------|-------|
| AC1 | `A-->B` compact edges | 0 edges, node "A--" | 4 nodes, 4 edges ✓ |
| AC2 | `A == yes ==> B` inline thick label | B dropped | 2 nodes, 1 edge labeled "yes" ✓ |
| AC3 | Shape label clean (hex/para) | `"{Hex"`, `"/Para/"` | `"Hex"`, `"Para"` ✓ |
| AC4 | Graceful degradation | Silent drop | warn + partial doc ✓ |
| AC5 | `parseMermaid` exposes warnings | Not present | `warnings: string[]` ✓ |
| AC6 | Direction TD warns | No warning | TB/TD handled ✓ |
| AC7 | Subgraph/classDef warn | warn | warn ✓ |

## Design Principles

- **No throws:** Parser returns valid (possibly partial) doc. Callers decide how to surface diagnostics.
- **Deterministic:** Same input → same output.
- **Clean labels:** Shape delimiters stripped in capture groups; only quotes to `extractLabel`.
- **Graceful degradation:** Extended shapes degrade to rect/diamond; warnings emitted.

## Test Impact

- **Before:** 852 tests pass  
- **After:** 914 tests pass (+62)  
- **Regressions:** 0  
- **Gallery:** `mermaid-flowchart.{svg,png}` byte-identical

## Tokenizer / Fidelity Bar Established

This decision establishes the tokenizer fidelity bar for all remaining Mermaid parsers (sequence, gantt, timeline, mindmap). Each parser must:
1. Use real-data crawls to validate acceptance criteria
2. Parse whitespace-independently (compact + spaced syntax)
3. Handle all documented edge/node operators
4. Extract labels cleanly (no delimiter mangling)
5. Warn on graceful degradation, never silent-drop

---

# Decision: Mermaid sequenceDiagram Parser — Real-Mermaid Fidelity

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T20:45:28-04:00  
**Status:** ADOPTED

## Summary

Implemented `packages/core/src/frontend/mermaid/sequence.ts` — a full Mermaid `sequenceDiagram` parser that produces `SequenceDocument` IR. Follows the tokenizer fidelity bar established by the flowchart.ts hardening: whitespace-independent, all 8 arrow operators, explicit/shorthand activations, loop/alt/opt/par fragments with sections, graceful degradation with public warnings. Wired into `index.ts` so `parseMermaid` + `renderMermaid` dispatch to sequence. 971 tests pass (+57); all existing goldens byte-identical. Gallery: `mermaid-sequence.{svg,png}` emitted with bytebytego-sequence theme.

## Arrow → Kind Mapping

| Mermaid Arrow | Line style | Arrowhead | IR `kind` |
|---------------|-----------|-----------|-----------|
| `->>` | solid | filled triangle | `sync` |
| `-->>` | dashed | open V | `reply` |
| `->` | solid | open/none | `sync` |
| `-->` | dashed | open/none | `reply` |
| `-)` | solid | open circle | `async` |
| `--)` | dashed | open circle | `async` |
| `-x` | solid | cross | `async` |
| `--x` | dashed | cross | `async` |

All 8 parsed whitespace-independently via a single `SEQ_MSG_RE` regex with most-specific-first alternation (`-->>` before `-->` before `->`, etc.).

## Activation Shorthand Semantics

**`A->>+B: msg`** → activate B, `from_order = order of this message`.  
**`B-->>-A: msg`** → deactivate B (FROM, not TO), `to_order = order of this message`.

The `-` modifier on the TO participant position semantically deactivates the FROM participant. This matches the canonical Mermaid docs example. A per-participant stack of `from_order` values supports stacked activations (`+/+` then `-/-`).

**Explicit `activate A`** → `from_order = lastMessageOrder` (the last parsed message's order).  
**Explicit `deactivate A`** → `to_order = lastMessageOrder`.

## Fragment Sections

| Mermaid keyword | IR kind | Multi-section |
|----------------|---------|---------------|
| `loop` | `loop` | No |
| `opt` | `opt` | No |
| `alt … else … end` | `alt` | Yes (sections[]) |
| `par … and … end` | `par` | Yes (sections[]) |
| `critical` | `critical` | No (+ DEFERRED warning) |
| `break` | `break` | No (+ DEFERRED warning) |

`alt` and `par` produce `FragmentSection[]` when there are ≥ 2 compartments. The first section's `guard` equals the fragment's main label. `else`/`and` create new sections. A fragment with no messages is discarded with a warning (`from_order > lastOrder`).

## Graceful Degradation

| Construct | Behavior |
|-----------|----------|
| `autonumber` | Warning: DEFERRED (no IR flag for step numbering) |
| `Note left/right of A: …` | Warning: DEFERRED (no Note IR type — Mark's domain) |
| `Note over A,B: …` | Warning: DEFERRED (same) |
| `critical` / `break` | Warning: DEFERRED, fragment still produced with correct kind |
| Unrecognised line | Warning: SKIP |
| `deactivate A` without prior activate | Warning, no crash |
| Unclosed fragment at EOF | Warning, partial close attempted |
| Empty label on message | Warning, placeholder `(message)` used |
| No participants at all | Warning, synthetic `participant` placeholder added |

Warnings surface via `MermaidParseResult.warnings: string[]` (same as flowchart).

## Auto-Registration

Participants auto-register on first use in a message (`kind: 'object'`, label = raw ID). Explicit `participant`/`actor` declarations update label and kind in-place without changing insertion order. This preserves left-to-right layout order by first appearance.

## ID Sanitization

Same algorithm as `flowchart.ts`: camelCase→kebab, uppercase→lowercase, underscores→hyphens, strip non-[a-z0-9-], collapse hyphens, prefix 'n' if starts with digit. Per-session `idMap` ensures stability.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/frontend/mermaid/sequence.ts` | **NEW** — full sequenceDiagram parser |
| `packages/core/src/frontend/mermaid/index.ts` | Wire sequence into parseMermaid + renderMermaid; update MermaidParseResult.doc and MermaidRenderResult.doc to union types |
| `packages/core/test/mermaid-frontend.test.ts` | Update 2 tests that expected sequence to throw (now dispatches correctly) |
| `packages/core/test/mermaid-sequence-corpus.test.ts` | **NEW** — 57 corpus tests (AC1–AC10 + 10 complete patterns) |
| `examples/gallery/mermaid-sequence.mmd` | **NEW** — real Mermaid sequence gallery example |
| `examples/gallery/mermaid-sequence.svg` | **NEW** — rendered gallery SVG (bytebytego-sequence) |
| `examples/gallery/mermaid-sequence.png` | **NEW** — rendered gallery PNG (848×1010, dark theme) |

## Test Impact

- **Before:** 914 tests  
- **After:** 971 tests (+57)  
- **Regressions:** 0  
- **All existing goldens:** byte-identical (flowchart gallery unchanged)

## Self-Crawl Results (10 real patterns)

1. Basic two-party: P=2 M=2 kinds=[sync,reply] ✓  
2. All 8 arrows in one diagram: P=2 M=8 all correct ✓  
3. Actor + participant with alias: P=3 M=3 kinds=[sync,sync,reply] ✓  
4. Activation shorthand +/-: A=1 {from_order:0, to_order:1} ✓  
5. Alt with else: F=1(alt, 2 sections) ✓  
6. Self-message: from===to ✓  
7. Notes degrade: 2 note-warns, messages intact ✓  
8. autonumber degrade: 1 warn, messages intact ✓  
9. loop+par combined: F=2 [loop,par] ✓  
10. Frontmatter/theme + ID sanitization: AuthService→auth-service ✓  

## Gallery Self-Check

The rendered PNG (848×1010, bytebytego-sequence theme) shows:
- Dark navy background
- 4 participants: User (actor, blue card with stick figure), Web Client, Auth Service, Database (colored cards with icons)
- Numbered step badges (0–11) from `autonumber`
- Activation bars on Auth Service and Database
- `alt` fragment: "Valid credentials" / "Invalid credentials" with dashed divider
- `loop` fragment: "Token refresh (every 15 min)"
- `opt` fragment: "Access protected resource"
- All fragment boxes clean with no overlaps
- Visibly superior to Mermaid's default white-background UML output

## Deferred Items

1. `Note` construct → no IR type (Mark's call; DEFERRED per decisions.md)
2. `autonumber` display → no IR flag (theme/rendering concern; DEFERRED)
3. Quoted participant IDs in messages (`"Alice Smith"->>Bob: msg`) — rare; SKIP + warn
4. `links` / `color` attributes — warn + skip

---

## Tier-0 Milestone: flowchart + sequence now complete

**Status:** flowchart ✅ + sequence ✅ = Tier-0 baseline achieved  
**Next:** gantt + timeline + mindmap (Tier-0 completion)

---

## ALL PENDING ITEMS NOW CLOSED (2026-06-13)

| Item | Tracking | Status | Closed Date |
|------|----------|--------|-------------|
| Schema validation hardening | #design | ✅ CLOSED | 2026-06-13 |
| Composition ir_file refs | #composition | ✅ CLOSED | 2026-06-13 |
| Flow diamond shape | #flow | ✅ CLOSED | 2026-06-13 |
| Stale comment cleanup | #maintenance | ✅ CLOSED | 2026-06-13 |
| Design doc status sync | #documentation | ✅ CLOSED | 2026-06-13 |
| Mermaid sequenceDiagram parser | #sequence | ✅ CLOSED | 2026-06-13 |

---

## Shipped Milestones (2026-06-11 to 2026-06-13)

### All Five Timeline Targets Complete (2026-06-11)

| Target | Family | Layout | Theme | Status |
|--------|--------|--------|-------|--------|
| **T1** | Vertical central-spine | horizontal | our-timeline | ✅ CLOSED |
| **T2** | Vertical central-spine | vertical-spine | subject-timeline | ✅ CLOSED |
| **T3** | Vertical central-spine | vertical-spine | ai-timeline | ✅ CLOSED |
| **T4** | Serpentine winding path | serpentine | serpentine | ✅ CLOSED |
| **T5** | Vertical central-spine | vertical-spine | gitline | ✅ CLOSED |

**Test coverage:** 795 tests pass (551 core + 13 schema + 3 cli + 228 grammar-specific). All 551 existing core goldens byte-identical.

### Four Grammars + Composition Layer (2026-06-13)

| Deliverable | Grammar | Implementation | Theme Support | Tests | Status |
|-------------|---------|-----------------|----------------|-------|--------|
| **Timeline** | #1 | ✅ Inc1+ | 5 themes (std, dark, ByteByteGo) | 551 | SHIPPED |
| **Sequence** | #2 | ✅ Inc1-2 | 2 themes (UML, ByteByteGo) | 37+multi-compartments | SHIPPED |
| **Tree** | #3 | ✅ Inc1 | 2 themes (light, dark) | 26 | SHIPPED |
| **Flow** | #4 | ✅ Inc1 | 2 themes (light, dark) + animation | 33+diamond | SHIPPED |
| **Composition** | Layer | ✅ Inc1 | 2 themes (light, dark) + ir_file refs | 25+refs | SHIPPED |

---

# Decision: Composition ir_file External Reference Resolution (FINAL PENDING ITEM)

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T17:43:20-04:00  
**Status:** ADOPTED — MERGED FROM INBOX

## Summary

Implemented `ir_file` external URI references in Composition Grammar cells. CellContent gains `{ kind:'ref', grammar, ir_file }` variant. Resolver (`composition/resolve.ts`) is file-I/O seam; `buildCompositionScene` remains pure. Example gallery shows flow + tree from sibling files composed into 2×2 poster.

## IR Extensions

### New `RefCellContent` variant
```typescript
interface RefCellContent {
  kind: 'ref';
  grammar: 'flow' | 'tree' | 'sequence' | 'timeline';
  ir_file: string;  // relative path from baseDir
}
```

### New `TimelineCellContent` variant  
```typescript
interface TimelineCellContent {
  kind: 'timeline';
  doc: IRDocument;
}
```

Both added to `CellContent` union.

## Implementation

**File:** `packages/core/src/composition/resolve.ts` — `resolveCompositionRefs(doc, baseDir)`
- Walks cells; for each `kind:'ref'` cell: reads file, auto-detects YAML/JSON, validates via grammar schema, inlines as `{ kind:'flow'|'tree'|'sequence'|'timeline', doc }`
- Non-ref cells passed through unchanged
- Original document not mutated; returns new resolved instance

**Convenience API:** `renderCompositionDocumentFromRefs(doc, baseDir, options)` — resolves refs then renders.

**Layout Guard:** `compileCellContent` throws clear error if unresolved ref reaches layout phase.

## Example: `examples/gallery/poster-refs/`

Three sibling files:
- `poster-refs.composition.yaml` — 2×2 grid, cells [0,1] use `kind: ref`
- `pipeline.flow.yaml` — Flow diagram
- `taxonomy.tree.yaml` — Tree diagram

Resolved poster output: `poster-refs.{svg,png}` — byte-identical to equivalent fully-inlined poster.

## Test Coverage

| Test | Verifies |
|------|----------|
| E1 | Ref cells inlined; inline cells unchanged; original not mutated |
| E2 | Missing file → clear error |
| E3 | Resolved poster sceneHash stable (determinism) |
| E4 | Resolved poster hash ≡ inline poster hash (byte-identical) |
| E5 | Gallery emit works |

## Determinism

`resolveCompositionRefs` + `buildCompositionScene` produces byte-identical output to fully-inlined equivalent. Resolver is mechanical substitution; layout unchanged.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/composition/types.ts` | Added `TimelineCellContent`, `RefCellContent` |
| `packages/core/src/composition/schema.ts` | Added schema variants |
| `packages/core/src/composition/layout.ts` | Added `case 'timeline'` and `case 'ref'` guard |
| `packages/core/src/composition/resolve.ts` | **NEW** — resolveCompositionRefs |
| `packages/core/src/composition/index.ts` | Export new types, resolveCompositionRefs, renderCompositionDocumentFromRefs |
| `packages/core/test/composition.test.ts` | E1–E5 tests added |
| `examples/gallery/poster-refs/` | **NEW** example directory |
| `examples/gallery/poster-refs.{svg,png}` | **NEW** gallery outputs |

**Test result:** 795/795 tests pass. All existing goldens byte-identical.

---

---

# Decision: Mermaid-Superset Design Doc Restructure (MERGED FROM INBOX)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13T19:25:34-04:00  
**Status:** ADOPTED

## Summary

Restructured LaTeX design document (design/main.tex) around new Mermaid-superset positioning: beautiful/themeable output, dedicated UML/software line, dual front-end (Mermaid DSL + structured IR).

## New Document Structure (8 Parts)

| Part | Title | Key Sections |
|------|-------|--------------|
| I | Thesis & Positioning | 01-problem, 02-central-thesis, 03-principles, 04-scope, 05-comparison |
| II | Front-End | 15-frontend, 16-mermaid-compat, 17-superset-extensions |
| III | Kernel | 10-scene-ir, 11-backends, 13-determinism, 14-animation |
| IV | Families | 20-grammar, 28-family-taxonomy, 21-timeline, 22-rendering, 25-flow, 26-sequence, 27-tree, 29-chart-family |
| V | Aesthetics | 12-themes, 18-aesthetics |
| VI | Composition | 30-composition |
| VII | Architecture | 40-architecture, 41-packaging, 42-layout-engines, 50-agent-integration |
| VIII | Roadmap | 60-roadmap, 51-distribution, 53-oss-strategy, 55-target-outputs |

## Files Created
- `05-comparison.tex` — Mermaid/PlantUML/D2/Vega comparison
- `15-frontend.tex` — Dual front-end architecture
- `16-mermaid-compat.tex` — 22-type Mermaid coverage
- `17-superset-extensions.tex` — Composition, theming, animation, IR-as-API
- `18-aesthetics.tex` — Aesthetic bar as first-class pillar
- `28-family-taxonomy.tex` — Five families, 22-type taxonomy
- `29-chart-family.tex` — Grammar-of-graphics chart layer
- `60-roadmap.tex` — Tiered coverage roadmap

## Files Retired (Subsumed/Replaced)
- `23-corpus-taxonomy.tex`, `24-diagram-family.tex`, `52-comparison.tex`, `54-mvp.tex`

## Files Recontextualized
- `01-problem.tex`, `02-central-thesis.tex`, `04-scope.tex`, `14-animation.tex`, `20-grammar-concept.tex`, `25-flow-grammar.tex`, `50-agent-integration.tex`, `12-themes.tex` (cross-references fixed)

## Determinism & Delivery

PDF builds. All design sections coherent across new family taxonomy and aesthetic-first positioning.

---

## Earlier Milestones Archived

For full design details on grammars, themes, animation, schema hardening, and prior-art positioning, see:
- **decisions-archive.md** — Detailed decision records (256 KB):
  - Strategic Direction & Scope (2026-06-09/10)
  - IR Contract & Rendering Model
  - All grammar specs (Sequence, Tree, Flow, Composition)
  - Theme systems (Timeline, Flow, Sequence, Tree, Composition dark variants, ByteByteGo)
  - Animation (dashflow SMIL)
  - Schema validation invariants
  - Design document sync status
