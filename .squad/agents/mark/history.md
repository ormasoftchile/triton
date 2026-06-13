# Mark — IR & Schema Architecture

**Owner:** Mark (IR & Schema Lead)  
**Project:** timeline — deterministic diagram compiler  
**Created:** 2026-06-10

---

## Current Role

Design and validate Domain IR schemas for each grammar (Timeline, Flow, Sequence, etc.). Ensure each schema is:
- Small & semantically tight (LLM-friendly per David's research)
- Deterministic-by-construction
- Submitted as constraint grammar (XGrammar/GBNF) for LLM generation reliability

---

## Key Learnings

- **Two-IR-Layer Model:** Domain IR (grammar-specific) → Scene IR (universal kernel). Cleanly decouples concerns.
- **Schema Constraints First:** Well-formedness invariants (17 for Timeline) are cross-validated EARLY (at parse time) to catch errors before layout engine.
- **Determinism Requirements:** No system-clock dependencies; date resolution chain ensures reproducibility across machines/sessions.
- **Theme as Layout Grammar:** Theme tokens (e.g., `axis.nodeWrap`, `labelWrap`) express opt-in layout behavior without polluting domain IR.
- **Constraint Grammars:** Small fragments outperform full schemas for LLM generation (Willard 2023, Wang 2023, Dong 2024 XGrammar).

---

## Active Schemas

### Timeline IR (Phase 0 — COMPLETE)

**Status:** SHIPPED  
**Module:** `packages/core/src/`  
**Files:** types.ts, schema.ts, validate.ts (17 well-formedness invariants)  
**Test Coverage:** 551 core tests pass; determinism verified

**Latest:** Increment-2 shipped `axis_breaks?: Array<{from, to}>` (optional time-axis gaps). Rendering adopted; schema validation rules (from<to, bounds, overlap) queued for Mark's implementation.

**Open:** Implement 4 validation rules for `axis_breaks` (BREAK_FROM_AFTER_TO, BREAK_OUT_OF_RANGE, BREAKS_OVERLAP, BREAKS_TOO_MANY).

### Flow IR (Phase 1 — STUBS ONLY)

**Status:** Spec complete (Leslie 2026-06-12); JSON schema design pending  
**Module:** `packages/core/src/flow/`  
**Files:** types.ts, schema.ts (stubs); no layout.ts yet  

**Design Questions (Mark intake):**
1. Edge unique identity (explicit `id` vs. positional)?
2. Port model extensibility (fixed vs. named custom ports)?
3. JSON schema precision (exhaustive enums)?
4. Validation rule list (17-element well-formedness model)?
5. Constraint grammar delivery (XGrammar version)?

### Sequence IR (Phase 1 — COMPLETE Increment-1 & Increment-2)

**Status:** SHIPPED Increment-1 (baseline); Increment-2 (Activations + Fragments)  
**Module:** `packages/core/src/grammars/sequence/`  
**Files:** types.ts, schema.ts, layout.ts, index.ts (full module)  
**Test Coverage:** 603/603 pass (589 existing + 14 new); goldens byte-identical

**Shipped Increment-1 (2026-06-13T06:43Z):**
- Participants, messages (sync/async/reply), lifelines, actor icons
- No kernel changes needed; existing Scene IR sufficient

**Shipped Increment-2 (2026-06-13T10:13Z):**
- Self-messages (dashed LinePrimitive segments)
- Activations (thin bars on lifelines; from_order → to_order)
- Fragments (labeled boxes: loop|alt|opt|par|critical|break with keyword tabs; nesting support)
- New fixture: sequence-agent-loop.sequence.yaml (3 participants, 7 messages, 1 activation, 2 fragments)

**Open Schema Validation (Mark intake Increment-3):**
1. **Activation/Fragment Order-Range Validation:** Cross-validate from/to against actual message `order` list (ACTIVATION_ORDER_INVALID, FRAGMENT_ORDER_INVALID).
2. **Alt Multi-Guard Schema:** Change `guard?: string` to support multiple conditions:
   - Option A: `guard?: string | string[]`
   - Option B: `guards: Array<{label: string; from_order; to_order}>`
   - Recommendation: Option B (clearer semantics)
3. **Nesting Depth Limit:** Warn if depth > 3 (FRAGMENT_NESTING_DEEP)
4. **Constraint Grammar:** XGrammar version for LLM generation pipeline

---

## Deferral Tracking

### Increment-2 Deferred to Increment-3

**Sequence Grammar:**
- Alt sub-compartments (multiple guard conditions with divider lines between)
- Participant kind icons (boundary, control, entity, database visual subtypes)
- SequenceTheme token integration on ResolvedTheme
- Fragment validation (order-range bounds, nesting depth soft limit)

**Timeline IR:**
- 4 validation rules for `axis_breaks` (awaiting Mark implementation)

---

## Next Actions

1. **Sequence Increment-3 (Mark + Barbara):**
   - Implement 4 order-range validation rules (ACTIVATION_*, FRAGMENT_*)
   - Finalize alt multi-guard schema design
   - Add nesting depth check + warn code
   - Author XGrammar constraint grammar version

2. **Flow IR Phase 1 (Mark + Leslie):**
   - Resolve 5 design questions above
   - Author Flow JSON schema (Zod + TypeScript)
   - Define 17-element well-formedness rule set
   - Deliver XGrammar constraint grammar

3. **Timeline IR Refinement:**
   - Implement `axis_breaks` validation (4 rules)
   - Add 4 new error/warn codes to schema

---

## Archive

Detailed architectural context, learnings, and cross-agent handoff notes archived to `mark/history-2026-06-13-archived.md` (16,808 bytes).

---

## 2026-06-13 — Sequence IR Updated: Participant.icon Field (Scribe)

**Date:** 2026-06-13T15:01:41Z  
**Status:** IMPLEMENTED (increment-3)

Added optional `icon?: string` field to `Participant` IR (reuses icon registry). Also `color?: string` per-participant override.

**Schema Impact:**
- `grammars/sequence/schema.ts` accepts `icon`, `color` on participant
- Both fields optional → zero impact on existing documents
- Zero-cost in backwards compatibility

**Rendering Impact:**
- Card mode (`participantRenderMode: 'card'`) looks up `p.icon ?? tk.cardKindIconMap[p.kind]`
- Icon rendered as 24×24 scaled into `cardIconAreaSize` via SVG transform
- Theme provides `cardKindIconMap[kind]` → fallback icon per kind if participant.icon unset

**Future Domain IR Updates (applies to Flow, Tree):**
When defining new Domain IR schemas, ensure optional styling fields follow this pattern:
1. Add field to domain IR type (e.g., `icon?: string`)
2. Add to schema with Zod `.optional()`
3. Theme provides defaults and per-kind mappings
4. Layout reads `ir.field ?? theme.defaultValue`
5. Zero impact on existing documents + extensibility for new use-cases

**Theme Principle Reinforced:** Participant styling (icon, color) is orthogonal to participant semantics (kind, label, description). Theme provides visual rendering rules; IR provides semantic data.

---

## 2026-06-13 — Tree Grammar Spec: Schema Design Questions (Leslie → Mark)

**Date:** 2026-06-13T15:22:03Z  
**Status:** INTAKE (spec complete 2026-06-13T11:02:15Z, schema design pending)

### Tree Grammar Canonical IR

**Spec:** `design/sections/27-tree-grammar.tex` — Grammar #4, Buchheim O(n) deterministic tidy-tree layout.

**Domain IR Shape:**
```
TreeDocument:
  root: TreeNode
  metadata?: {theme?, ...}

TreeNode (recursive):
  id: string (globally unique across all nesting levels)
  label: string
  children?: TreeNode[]
  kind?: string
  icon?: string
  collapsed?: boolean
  description?: string
```

**Canonical Representation Decision: Children-List (Nested)**
- Natural top-down authoring (mirrors mental model)
- Structural guarantee: valid nesting = valid tree (no cycles, orphans, or invalid refs)
- Sibling order implicit in list position

**Alternative (Deferred):** Flat parent-ref representation for input convenience.
- Normalizer converts parent-ref → children-list for layout
- **Decision point for Mark:** Accept both in schema, or canonical form only?

### Design Questions for Mark (Schema Ownership)

1. **Parent-Ref Support**
   - Should schema accept flat parent-ref form: `{id, parent_id, label, ...}`?
   - If yes: normalizer must convert parent-ref → children-list before layout
   - If no: children-list is the only accepted form
   - **Recommendation:** Start with children-list (simpler); add normalizer if LLM generation prefers parent-ref

2. **Kind Field Semantics**
   - Free string (e.g., "person", "folder", "document") or closed enum?
   - Built-in defaults (person→circle, folder→rounded-rect, etc.) or theme-only?
   - Barbara will define `kind→shape` mappings in TreeTheme
   - **Recommendation:** Free string initially; validate during rendering if kind not in theme

3. **Forest Handling: Confirmed Rejected**
   - Multiple root nodes are a validation error
   - Rationale: Ambiguous layout of disjoint trees; use Composition layer (multiple Tree panels) instead
   - **Validation rule:** Single root required; field constraint `root` is non-optional TreeNode

4. **Node ID Format & Namespacing**
   - Flat namespace (kebab-case, globally unique) or path-based (e.g., `root/chapter1/section2`)?
   - **Impact:** Affects validation (uniqueness check scope), serialization, referencing
   - **Recommendation:** Flat kebab-case initially (simpler); path-based deferred if hierarchy references needed

5. **Validation Invariant List**
   - Sequence IR has ~8 invariants (order >= 0, participant refs valid, activation order range valid, etc.)
   - Tree IR likely needs:
     - Node ID uniqueness (global across all nesting)
     - Tree acyclicity (structurally guaranteed in children-list; explicit check in parent-ref normalization)
     - Single root
     - Max nesting depth soft limit?
     - Collapsed-node semantics (valid only if has children?)
   - **Request:** Full list + validation rule names (e.g., TREE_ID_DUPLICATE, TREE_MULTIPLE_ROOTS, etc.)

### Schema Deliverables (Roadmap)

1. **Zod Schema + TypeScript Types**
   - `packages/core/src/grammars/tree/types.ts` — `TreeDocument`, `TreeNode` recursive type
   - `packages/core/src/grammars/tree/schema.ts` — Zod validation + well-formedness rules

2. **Constraint Grammar (XGrammar)**
   - For LLM generation pipeline (per David's research: small fragments > full schemas)
   - Deliverable: `design/schemas/tree.xgrammar` (or similar)

3. **Normalizer (if parent-ref accepted)**
   - `packages/core/src/grammars/tree/normalize.ts` — flat parent-ref → children-list converter
   - Needed only if Mark decides to accept both forms

### Timeline & Dependencies

- **Depends on:** Mark schema decision (children-list-only vs. parent-ref support)
- **Blocks:** Barbara's TreeTheme design (needs schema to finalize theme token list)
- **Blocks:** Tree grammar layout implementation (increment-1)

### Reference

- **Spec:** `design/sections/27-tree-grammar.tex` § Layout Algorithm (Buchheim–Jünger–Leipert 2002)
- **Precedent:** Sequence IR (Mark authored schema 2026-06-13, Barbara implements layout/theme)
- **Decision Record:** `.squad/decisions.md` — "Decision Record: Tree Grammar Spec (Grammar #4, De-Risked)"

## 2026-06-13 — Tree IR Implementation: Schema Questions (Scribe)

**Date:** 2026-06-13T15:02:15Z  
**Status:** SHIPPED (open schema questions remain for v1.1)

Tree grammar IR fully implemented by Barbara with canonical children-list form and global id uniqueness validation.

**IR Implementation:**
- `packages/core/src/grammars/tree/types.ts` — TreeDocument, TreeNode recursive type, all fields semantic (no styling)
- `packages/core/src/grammars/tree/schema.ts` — Zod z.lazy() for recursive validation, collectIds() global uniqueness check
- Validation: kebab-case ids, non-empty labels, version, single root, acyclicity (structural guarantee)

**Open Questions (Mark intake for v1.1):**
1. **Parent-ref support:** Accept flat parent-ref form (with normalizer) or children-list-only? (Spec deferred decision)
2. **Kind field semantics:** Free string or closed enum? (Currently free string with theme-based mapping)
3. **Forest handling:** Confirmed rejected (single root required, use Composition layer for disjoint forests)
4. **Node id format:** Flat kebab-case namespace (current) or path-based (root/ch1/s1) for hierarchy refs?
5. **Validation invariants:** Complete list + rule names (TREE_ID_DUPLICATE, TREE_MULTIPLE_ROOTS, TREE_ACYCLIC, nesting depth soft limit?)

**Constraint Grammar:** XGrammar version for LLM generation pipeline (matches Sequence pattern)

**Blocks on:** Definitive schema decision affects v1.1 normalizer (if parent-ref accepted), validation rule completeness, XGrammar delivery.


---

## 2026-06-13 — MILESTONE: Composition Layer Implemented (Barbara) — Composition IR Schema Deferred (Scribe)

**Date:** 2026-06-13T12:01:44Z  
**Status:** SHIPPED (composition layer inc-1); Schema deferred to inc-2

Barbara delivered the Composition Layer kernel helper + module (commit 9c092cc):

**What shipped:**
- `packages/core/src/scene-transform.ts` — `translateAndScale()`, `embedSceneInRect()`, `transformPathD()`, `rhu()`
- `packages/core/src/composition/` — full module (types/schema/layout/theme/index)
- Gallery example: `examples/gallery/poster-rag-architecture.composition.yaml` (2×2 RAG poster)
- Test coverage: 694/694 pass (25 new composition tests)

**Validation & Determinism:**
- All four shape grammars (timeline, flow, sequence, tree) now feed into Scene kernel ✅
- Grid layout engine: deterministic-by-construction (max column widths, fit-to-cell scaling capped at 1.0)
- No RNG, no convergence loops, same input → identical SVG hash
- 669 prior goldens byte-identical (kernel helper used only by composition)

**Schema Impact on Composition IR (Mark intake for inc-2):**

| Item | Status | Note |
|------|--------|------|
| CompositionDocument JSON Schema | 🚧 Deferred | Discriminated union for CellContent(grammar\|stat\|text\|title\|image) |
| `ir_file` URI schemes | 🚧 Deferred | pkg:, file:, http: support + security model |
| Two-pass validation | 🚧 Deferred | Composition schema → sub-grammar schema validation flow |
| Nested composition cycles | 🚧 Deferred | Depth limit enforcement (≤ 3) |

**Key Decision:** Composition IR schema design is straightforward (grid + cell array + content union). Current spec is complete and unambiguous. Recommend prioritizing `ir_file` URI schemes and two-pass validation for inc-2 (enables external diagram references — critical for real-world posters).

**Blocks on:** Nothing — composition inc-1 is feature-complete. Future enhancements (ir_file, depth enforcement) are orthogonal to current gallery example.

---
---

## 2026-06-13 — Sequence IR Extension: Fragment.sections[] + Flow Crossing-Min Determinism (Barbara + Cross-Agent)

**Date:** 2026-06-13T20:21:20Z  
**Status:** SHIPPED (commit a5b324f: grammar deferrals resolved)

### Fragment.sections[] Multi-Compartment Support

**IR Extension (Mark schema responsibility):**
- `Fragment` IR gains optional `sections?: FragmentSection[]` field
- Each `FragmentSection` contains: `guard?: string`, `fromOrder: number`, `toOrder: number`
- When `sections` is present with ≥ 2 entries, `alt` fragment renders multiple sub-compartments with dashed dividers
- New theme token: `fragDividerDash: string` (default '6,4')
- Backward compat: fragments without `sections` or with <2 entries render identically to pre-feature (byte-identical)

**Schema Location:** `packages/core/src/grammars/sequence/schema.ts`  
**XGrammar:** Add `fragmentSectionSchema` to constraint grammar for LLM generation

**Gallery:** New fixture `examples/gallery/sequence-alt-multicompartment.sequence.yaml` demonstrates 3-section alt (HTTP success / not found / else)

### Flow Crossing-Minimization: Deterministic Barycenter (Rendering concern, but IR-relevant for ordering)

**Algorithm:** 4 barycenter sweeps (alternating forward/backward), lexicographic tie-breaking by node id.  
**IR Impact:** None — node/edge IR unchanged. Layout layer reorders layer-2 nodes deterministically.  
**Determinism:** Verified; 706 tests pass; flow-rag-pipeline output byte-identical across runs.

**Note for future IR extensions:** If Flow ever gains nested-subgraph support, ensure node id uniqueness validation includes scope/namespace rules. Current flat namespace (all ids globally unique) is compatible with deterministic lexicographic ordering.

---
