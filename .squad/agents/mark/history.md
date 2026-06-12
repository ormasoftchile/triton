# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of deterministic diagram compiler. Mark leads IR (intermediate representation) architecture.
- **Stack:** LaTeX for design; TypeScript/Node for implementation (Phase 0–1+ in progress).
- **Created:** 2026-06-10

## Current Learnings

- The IR is the **universal contract** between ingestion, rendering, and agent reasoning. Small, semantically tight domain IRs (not god-schemas) are LLM-friendly.
- Parity decisions (Activity/Milestone icon, color, blocks, metadata) keep the IR consistent and extensible across multiple grammars.
- Well-formedness invariants (17 total) catch misconfigurations early for deterministic rendering.
- Date resolution chain (metadata.today → metadata.created → error) ensures determinism; no system-clock dependency.
- The two-IR-layer model (grammar-specific domain IR → universal Scene IR) decouples concerns and enables grammar-agnosticism.

## 2026-06-11 — Strategic Alignment on Two-IR-Layer Architecture (Mark)

📐 **IR Positioned Within Diagram Compiler Strategic Reframe**

### Scene IR as Shared Kernel Contract

With the strategic reframe to diagram compiler, the IR architecture is repositioned:

- **Domain IR** (Timeline's IR): Grammar-specific, small, semantically tight
- **Scene IR** (Universal kernel): Assembly language of primitives (Rect, Line, Circle, Text, Path, Group, effects, animation hints)
- **All domain IRs compile DOWN to Scene IR** — the shared rendering contract

### Timeline IR Role in Phase 0→2

In Phase 0, the kernel/timeline seam is drawn inside `packages/core`. Timeline IR (Domain) + Timeline Layout Engine compile to Scene IR. Future grammars (Flow, Graph, etc.) will have their own domain IRs, sharing the Scene IR contract and kernel infrastructure.

### Implications for Validation & Rendering

- Timeline validation continues to enforce the 17 well-formedness invariants
- Scene IR compilation deterministic: same Timeline IR → same Scene IR (golden-testable as text/bytes)
- Backend diversity supported: SVG, PNG (resvg), Skia, PDF — all consume Scene IR, not domain IR
- Animation hints on Scene primitives are backend-conditional (SVG honors; raster ignores)
