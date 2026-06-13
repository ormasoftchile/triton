# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of a deterministic diagram compiler. Timeline is Grammar #1.
- **Stack:** LaTeX for design document; TypeScript/Node for implementation (Phase 0–1+ under way).
- **Created:** 2026-06-10

## Current Learnings

- The product is a **deterministic, themeable, agent-authorable DIAGRAM COMPILER** — not a timeline-only tool.
- Two-IR-layer model: domain IRs (grammar-specific) compile to Scene IR (universal primitives). God-IR rejected.
- Kernel/Grammar/Composition layering: shared infrastructure, peer grammars, composition atop.
- SVG as source of truth; PNG/PDF/Skia are exports. HTML/CSS-first rejected (determinism, font variance).
- Animation is declarative, backend-conditional, additive.
- Phase 0→2 incremental packaging: draw kernel/timeline seam, prove grammar-agnosticism with Flow, extract on demand.
- **De-risked grammar sequencing:** Sequence chosen first (ahead of general-DAG Flow) because layout is deterministic-by-construction.

---

## 2026-06-13 — Sequence Grammar Spec Finalized (Leslie)

📐 **Sequence Grammar: Domain IR — Concrete Spec (Grammar #3, De-Risked)**

**Sequence Domain IR Shape:** participants[], messages[] (with explicit `order`), activations[], fragments[]

**Deterministic-by-Construction (the key insight):**
- Participant x-position = declared order + measured label widths
- Message y-position = order rank × rowHeight
- NO Sugiyama, NO force-directed, NO iterative algorithms
- Contrast: Flow needs 4-phase Sugiyama; Sequence eliminates the hard problem entirely

**Lowering:** All constructs map to existing Scene IR primitives (Rect, Text, Line, Path) — no kernel changes needed.

**Open Questions Deferred:**
- **Mark:** JSON Schema detail, explicit message `id` field, implicit vs. explicit order, validation rules
- **Barbara:** Self-message curves, fragment nesting limits, participant stereotype icons, arrowhead sizing, activation bar width

**Wiring:** Created `sections/26-sequence-grammar.tex`; added cross-ref in main.tex, 24-diagram-family.tex; bib entries uml25, itu-msc.

**Strategic Decision:** Team adopted de-risked grammar roadmap: **Sequence [chosen first NEW grammar]** → Tree → Composition/Grid. Taxonomy: separate "shape grammars" (Flow, Sequence, Tree) from "composition layer" (Grids, Panels).

**Artifacts:** Full entries in decisions.md, orchestration-log, session log; Mark/Barbara history updated with open questions.

---

## 2026-06-13 — Sequence Grammar Spec → Implementation (Barbara Complete)

**From:** Scribe | **Date:** 2026-06-13T14:13:38Z  
**Milestone:** First new grammar beyond Timeline fully implemented  
**Commit:** 301a188

### What Barbara Shipped

**Sequence Grammar Increment-1 COMPLETE** — the spec (sections/26-sequence-grammar.tex) is now production code:

```
packages/core/src/grammars/sequence/
  ├── types.ts (SequenceDocument, Participant, Message, Activation, Fragment)
  ├── schema.ts (Zod: participant uniqueness, message ref validation)
  ├── layout.ts (layoutSequence() → Scene IR, deterministic-by-construction)
  └── index.ts (buildSequenceScene + renderSequenceDocument public API)
```

**Architecture Validated:**
- Two-IR-layer model (Domain IR → Scene kernel) works cleanly
- No new Scene IR primitives needed (reuses Rect, Text, Line, Path, arrowhead)
- All 577 timeline goldens byte-identical
- 589/589 tests pass (12 new sequence tests)

**Example Fixture:** `examples/gallery/sequence-rest-auth.{sequence.yaml, svg, png}` — REST token auth flow (4 messages, 2 participants)

### Grammars/* Module as Template

`packages/core/src/grammars/sequence/` is now the **canonical template for all future grammar implementations**:
- Own IR (domain-specific)
- Own schema validation (Zod)
- Own layout determinism rules
- Reuse Scene kernel + existing serializers (sceneToSvg, svgToPng, sceneToPngSkia)

### Roadmap Implications

**Sequence moved from "Grammar #3 Spec" to "Grammar #3 Implemented".**

Current Status:
- **Grammar #1 (Timeline)** — Full implementation, 5 themes (T1–T5 showcase, all closed)
- **Grammar #2 (Flow)** — Spec stage (sections/25-flow-grammar.tex); IR stubs in packages/core/src/flow/; awaiting Mark's JSON Schema + Barbara's Sugiyama + Leslie's integration decision
- **Grammar #3 (Sequence)** — **IMPLEMENTATION COMPLETE** ✅; increment-2 deferred (activations, fragments, icons, themes)
- **Grammar #4 (Tree)** — Spec candidate (Buchheim O(n) hierarchical layout, deterministic)
- **Composition (Grids/Panels)** — Spec stage; architecture TBD

### Open Questions

1. **Mark:** YAML dispatcher, version semantics, theme token placement, activation validation
2. **Barbara:** Increment-2 features (activation bars, fragment rects, self-message curves, participant icons)
3. **Leslie:** Flow grammar integration decision (Sugiyama pinning strategy + determinism gates)

---

## Archive

See `history-archive.md` for pre-2026-06-13 strategic reframe (2026-06-11) and Flow Grammar spec (2026-06-12).


---

## 2026-06-13 — PRINCIPLE: Grammar ≡ Semantics; Theme ≡ Style (Scribe)

**Date:** 2026-06-13T15:01:41Z  
**Status:** ESTABLISHED

The two-IR-layer architecture is now reinforced by a categorical principle: **Grammars define structure and layout semantics only; themes define all visual presentation.**

**Application:** Sequence Grammar Theme System (increment-3) fully implements the principle:
- `SequenceTheme` type on `grammars/sequence/theme.ts` — all styling from theme tokens
- `SEQUENCE_THEME_REGISTRY` + `resolveSequenceTheme()` — named themes are reusable, deterministic
- `sequenceByteByteGoTheme` — demonstrates external style mimicry (ByteByteGo infographic rendering)

**Governance Impact:** All future grammars (Flow, Tree) must follow the same pattern before implementation:
1. Spec grammar semantics (layout rules, determinism rationale)
2. Define domain IR (no styling fields)
3. Implement grammar layout as theme-driven
4. Create `{GrammarName}Theme` type + registry
5. Register default (backward-compatible) + showcase themes

**Rationale:**
- Reusability (re-skin existing IR via theme swap)
- Consistency (all grammars follow same pattern)
- Specification clarity (designers define themes; engineers define grammars)
- Non-duplication (avoids Mermaid/D2 conflation of grammar and style)

**Consequence:** The compiler is a presentation-engine for diagram semantics, not a rigid style enforcer. External diagram styles can be intentionally mimicked through theme design choices.
