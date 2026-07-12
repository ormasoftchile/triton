# Leslie — Spec Architect

## [ARCHIVE GATE SUMMARY — 2026-07-12]

Recent work (2026-06-14 to 2026-07-12):
1. Diagram-options reference format (2026-07-06): Fragment-first spec, `%%` placement per-grammar.
2. Layout algorithm initiative phase plan (2026-06-27): Static dispatch, performance fallbacks deferred.
3. Connector syntax redesign (2026-07-12): Strict Mermaid superset. 15-token matrix (9 honored + 6 extensions: -_-> dashed, -~-> wavy). Approved by Cristian 2026-07-12T09:40-04:00.
4. Live-poster scope ruling (2026-07-12): Hard boundary; compiler pure; one-way dependency; `repeat:` rejected; binding-map JSON sidecar OK.

**Key learnings:** Compiler purity non-negotiable. Fragment parallelization avoids conflicts. Static dispatch keeps determinism. Cosmetic bindings v1; structural deferred.

---

## 2026-07-06 — Diagram-Options Complete

Central `stripComments()` preprocessor shipped (`src/frontend/preprocess.ts`). All 45 fragment families updated. 60 of 68 examples carry `%%` headers. Tests 404 pass, typecheck 0 errors.

---

## 2026-07-10 — Poster Replication Analysis

Algomaster.io reference posters (DSA 15 Patterns, Load Balancing): 0 fully replicable, 14/5 partial. Main gaps: per-cell highlight, annotation overlay, hash-ring primitive, interval bar. Roadmap: quick wins (highlight, caption) → new primitives (interval, hash-ring) → animation (advised against for determinism).

---

## 2026-07-12 — Connector Syntax v2 (Revised)

**Strict Mermaid superset:** Dashed survives via `-_->`, wavy via `-~->`. Full 15-token matrix (5 styles × 3 directions). Migration: 1 parse break (`<..>`), 10 visual (`-.->` dashed→dotted), 8 animation losses (auto-march removal). Flowchart's `sync|async` kind should be dropped to unify output shape.

---

## 2026-07-12 — External Theming Design & Implementation Plan (APPROVED)

**Scope:** Complete architectural analysis of external theme files (Sections 1–9) + 6-phase Tier-1 implementation roadmap (§10).

**Key findings:**
- **Fully feasible:** External themes are inherently I/O; compiler never loads them. Existing `renderSync(themeInput?, ...)` API has the right seam.
- **Reference:** Frontmatter `theme: ./file.triton-theme.json` (Option D — simple, familiar).
- **Format:** JSON, `.triton-theme.json` extension.
- **Cristian's 5 decisions (2026-07-12):**
  1. Unknown-key policy = **STRICT/ERROR** (catches typos early).
  2. Name from filename when omitted (`acme-corp.triton-theme.json` → `acme-corp`).
  3. `base` key supported, optional, defaults `"default"`.
  4. File extension = `.triton-theme.json`.
  5. Phase 0 cache-key = shell `printf >> tempfile` with `%% triton-key:` comment.

**6-phase Tier-1 plan** (16–20 hours):
- Phase 0: triton.sty cache-key fix (1h).
- Phase 1: triton-core validator + JSON Schema (3–4h).
- Phase 2: Shared theme loader (2–3h).
- Phase 3: VS Code extension (4–5h).
- Phase 4: triton-latex CLI + .sty (3–4h).
- Phase 5: Docs + examples (2–3h).

**Status:** APPROVED. Phase 0 start cleared. Archived to `.squad/decisions.md`.
