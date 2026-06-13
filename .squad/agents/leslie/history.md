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

## Archive

See `history-archive.md` for pre-2026-06-13 strategic reframe (2026-06-11) and Flow Grammar spec (2026-06-12).

