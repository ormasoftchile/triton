# Edsger — History & Learnings

## [ARCHIVED HISTORY]

Previously completed work:
- Project Context
- My Role
- Learnings
- 2026-06-27 — Bypass Right-Side Fix
- 2026-06-27 — Post-balance dummy snap (commit d15b9b9)
- 2026-06-27: Dagre-faithful port (normalize + order + BK)

---

## 2026-06-28 — Multi-Wall Skip-Edge Routing Spec

**Task:** Spec all-wall-pair candidate pool for skip-edge routing optimizer  
**Requested by:** ormasoftchile  
**Output:** `.squad/decisions/inbox/edsger-multiwall-routing.md`

**Summary:**

Produced a complete implementation-ready spec extending the skip-edge routing candidate
pool from Strategy A only (Bottom→Top) to six wall-pair strategies (A–F).

**Key decisions:**

1. **`RouteCandidate` interface** replaces `candidates: number[]`. Each candidate carries
   `strategy`, `laneX`, `segments`, `labelMid`, and `isMixed`. All strategies produce
   candidates into a single flat array; the optimizer scores uniformly.

2. **Six strategies:**
   - A: Bottom→Top (existing, 5 segments, cascade ports unchanged)
   - B: Left→Left (3 segments H→V→H, mid-wall ports, laneX < min(srcLeft, tgtLeft))
   - C: Right→Right (3 segments H→V→H, mid-wall ports, laneX > max(srcRight, tgtRight))
   - D: Left→Top (4 segments H→V→H→V, mixed ports, isMixed=true)
   - E: Right→Top (4 segments H→V→H→V, mixed ports, isMixed=true)
   - F: Bottom→Left (4 segments V→H→V→H, mixed ports, isMixed=true)

3. **`wallPairPenalty`** — new parameter to `scoreLane` (default 0). Mixed strategies
   (D/E/F) carry +2.0. Keeps same-wall routes preferred in tie situations.

4. **Port override block** between optimizer and render: selects `effectiveFromPt`,
   `effectiveToPt`, `effectiveFromWall`, `effectiveToWall` based on winning strategy.
   Strategy A uses cascade-assigned ports; B–F use mid-wall geometric ports.

5. **SVG path rendered directly from `bestCandidate.segments`** — replaces hardcoded
   Strategy-A-specific path template.

6. **Only `src/diagrams/class/layout.ts` changes.** No changes to `layered.ts`.

---


## 2026-06-28 — Skip-Edge Routing Optimizer Spec

**Task:** Spec multi-candidate skip-edge routing optimizer  
**Requested by:** ormasoftchile  
**Output:** `.squad/decisions/inbox/edsger-skip-routing-optimizer.md`

**Summary:**

Produced a complete implementation-ready spec for replacing the ad-hoc right-only obstacle snap (lines 881–934 `layered.ts`) with a principled multi-candidate optimizer.

**Key decisions:**
- Expose 4 BK sweep x values per dummy node via new `LayeredResult.dummySweepXs: Map<string, number[]>` — free because sweeps are already computed, just previously discarded after balance
- Expose `LayeredResult.dummyChainIds: Map<number, string[]>` to let `layout.ts` resolve which dummy id maps to which original edge
- Candidate pool: 4 sweeps + left margin + right margin + sourceX + inter-column midpoints (7–10 total)
- Weighted scoring: box-intersection (1000×), edge-overlap (50×), segment-count (10×), path-length (0.3×), direction-preference (5×); left-margin preferred for TB
- Segment registry updated after each skip edge so later edges avoid earlier lanes
- Processing order: skip edges sorted by descending span (longest first)
- Left/right margin candidates are always unblocked → optimizer always terminates with a finite winner
- LR layout excluded from scope; existing snap in `layered.ts` retained for LR

**Files specified to change:** `src/graph/layered.ts` (LayeredResult, assignCoordinatesBK4, layeredLayout) and `src/diagrams/class/layout.ts` (skip-edge rendering block + helper functions)

### 2026-06-28 — Generalized Edge Routing Optimizer Spec

**Task:** Spec multi-candidate routing optimizer for ALL edges (not just skip edges)  
**Requested by:** ormasoftchile  
**Output:** `.squad/decisions/inbox/edsger-general-routing.md`

**Diagnosis of class2.mmd:**

Rendered `examples/class2/class2.png` (Online Learning Platform, 8 classes, 5 layers, 3 column groups) and identified:

1. **`Instructor --> Course` (teaches) — skip-cross-column, BROKEN:** Current Strategy A wins at laneX=353, placing the "teaches" label at (353, 290) — 23px from User's left wall — floating in the inter-column dead space. The `labelOverlapPenalty` addition to `scoreLane` would penalise this route, forcing a better lane selection.

2. **`User <|-- Student` (inheritance) — direct-cross-column, NO OPTIMIZATION:** `routeEdge()` produces a single L-shape at x=351.7 (same dead-zone corridor). No `routedSegments` check. In class2 the corridor is clear, but in denser diagrams this path would cut through intermediate boxes undetected.

3. **`Student --> Certificate` (earns) / `Certificate --> Course` (from) — direct-cross-column, NO OPTIMIZATION:** `routeEdge()` produces correct L-shapes by heuristic but with no candidate evaluation, no `routedSegments` registration, and no label placement check.

4. **`Enrollment --> Course` (for), `Course *-- Module`, `Module *-- Lesson` — direct-same-column, OK:** Near-straight verticals. Would trivially win via `straightBonus=40`.

**Key design decisions:**

- **Edge classification** into 4 types: `direct-same-column`, `direct-cross-column`, `skip-same-column`, `skip-cross-column`
- **Processing order:** skip-cross → skip-same → direct-cross → direct-same (most constrained first)
- **Route families X1 (V-then-H) and X2 (H-then-V)** for direct-cross-column, with multiple midY/midX candidates
- **`straightBonus=40`** added to `scoreLane` for direct-same-column straight vertical winners
- **`labelOverlapPenalty=200`** added to `scoreLane` — penalises any candidate whose `labelMid` falls inside any real box
- **New helper:** `labelInBox(lx, ly, boxes)` — geometry check for label placement
- **`RouteCandidate.strategy`** extended with `'X1'`, `'X2'`, `'V'`
- **`routeEdge()` retained** as fallback only when all candidates score Infinity
- **No changes** to `layered.ts`, `LayeredResult`, port assignment, or skip-edge strategies A–F

**Files to change:** `src/diagrams/class/layout.ts` only

### 2026-07-06 — Group E: DS Diagram-Options Fragments (diagram-options task)

**Task:** Document all `ds` subkinds for the diagram-options reference (Leslie's spec). Write `docs/diagram-options/_fragments/ds-<subkind>.md` for every ds subkind.

**`%%` comment-safety check result:**

- All ds parsers (struct, queue, stack, hashmap, matrix, trie, unionfind, graph) use the shared `lines()` helper from `struct/shared.ts`, which is `input.split(/\r?\n/).map(l => l.trim()).filter(Boolean)` — **no `%%` filtering whatsoever**.
- The tree family's `grammar.peggy` (`src/diagrams/triton/ds/tree/grammar.peggy`) has **0 occurrences** of `%%` — no comment rule defined.
- `grep -rn '%%' src/diagrams/triton/ds/<all parsers>` returned **empty** for every subkind.
- **Conclusion:** ALL ds subkinds have NO `%%` support. No `%%` headers were added to any `.mmd` example files. All fragments carry the fallback note.

**Enumerated subkinds (22 fragments written):**

Source layout under `src/diagrams/triton/ds/`:
- `struct/`: `array`, `linkedlist`, `memory`, `page`
- `queue/`: `queue` (linear), `cqueue` (circular), `deque`, `pqueue` (priority)
- `stack/`: `stack`
- `hashmap/`: `hashmap`
- `matrix/`: `matrix`
- `trie/`: `trie`
- `unionfind/`: `unionfind`
- `graph/`: `nodegraph` (aliases: `dsgraph`)
- `tree/`: `tree` (generic), `plan` (auto-coloured query-plan), `avl`, `rbtree`, `btree`, `radix`, `segtree`, `heap`

**Subkinds WITH examples** (9 example dirs, 21 `.mmd` files):
array, graph/nodegraph, hashmap, matrix, queue (4 files), stack, tree (9 files: avl/btree/decision/heap/plan/query-plan/radix/rbtree/segtree), trie, unionfind.

**Subkinds WITHOUT examples** (documented from parser source): linkedlist, memory, page.

**Key per-subkind syntax facts:**

- **array**: `array <vals>` inline or block with `cells`, `index`, `ptr <name> -> <idx>`; anchors `c0..cn`
- **linkedlist**: `linkedlist <vals>` or `values`/`nodes` keywords; anchors `n0..nn`
- **memory**: `region NAME` → `var name [-> target]` / `object id : title : k=v,...`; cross-region pointer arrows
- **page**: `slots N` + `tuples <vals>`; anchors `slot0..`, `tuple0..`
- **queue**: `cells`/`items` + optional `capacity`; anchors `c0..cn`
- **cqueue**: adds `front`/`rear` indices + empty-slot tokens `_`, `.`, `-`
- **deque**: same as queue but no capacity; double-headed arrows at both ends
- **pqueue**: `item <label words> <priority>` (trailing number); sorted high→low
- **stack**: same as queue + optional `capacity`; last cell = top; `top` pointer on left
- **hashmap**: `buckets N` + `bucket <idx>: key->val, ...` (seps: `->`, `=>`, `:`, `=`); anchors `b0..`, `b0e0..`
- **matrix**: `matrix RxC` shorthand or `row v1 v2 ...`; `noindex` flag; anchors `r0c0..`
- **trie**: bare token list; only `[A-Za-z0-9]+` tokens inserted; uncompressed character trie
- **unionfind/dsu**: `parent` array or `union a b` ops; representative = parent[i]==i; anchors `e0..en`
- **nodegraph/dsgraph**: `directed`/`undirected`; `node id : label`; edges `->`, `--`, `<->`; optional `: label`
- **tree/plan**: PEG grammar; indentation hierarchy; `:kind` tags; `{attr: val}` blocks; `|edgeLabel|`; directions TB/LR
- **avl/rbtree**: integer token lists; real rotations at parse time; avl=balance badge, rbtree=red/black kinds
- **btree**: `order N` + integer list; multi-key strip nodes
- **radix**: alphabetic words only; prefix-compressed Patricia trie
- **segtree**: `over [n1,n2,...] reduce sum|min|max`; range sub-line on every node
- **heap**: `min`/`max` keyword + integer list; real sift-up; implicit complete binary tree

**Fragment files written:** `docs/diagram-options/_fragments/ds-{array,linkedlist,memory,page,queue,cqueue,deque,pqueue,stack,hashmap,matrix,trie,unionfind,nodegraph,tree,plan,avl,rbtree,btree,radix,segtree,heap}.md` (22 total)

**Preview verification:**
- `node scripts/preview.mjs examples/triton/ds/<subkind>/` run for all 9 example dirs
- All 21 SVGs regenerated with exit 0: array, graph, hashmap, matrix, circular, deque, linear, priority, stack, trie, unionfind, avl, btree, decision, heap, plan, query-plan, radix, rbtree, segtree
- No `.mmd` files were modified (no `%%` headers added), so SVG output is unchanged.


## 2026-07-06 — Diagram Options Reference (Team Delivery)

**Scribe note:** Diagram-options feature completed. All 45 fragments assembled into central reference; 4 families have inline `%%` headers in examples (flowchart/9, sankey/1, timeline/9, poster/7); pnpm test: 384 pass.
