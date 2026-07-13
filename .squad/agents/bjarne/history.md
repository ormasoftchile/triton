## # Bjarne — Ingestion Design

**[HISTORY SUMMARIZED 2026-07-13T00:32:23Z]**

## Recent Work — Icon System (P1 & P6)

**P1 Icon Pack Discovery (2026-07-12):**
Implemented `src/icons/discover.ts` with three public functions:
- `findTritonIconsDir(startDir)` — walks up ≤10 levels for `.triton/icons/` (mirrors theme discovery)
- `discoverIconPacks(dir)` — scans `*.triton-icons.json` files, validates with Mark's pure validator, builds `IconPackMap` (keyed by pack `prefix`)
- `loadIconPacks(startDir)` — convenience combinator for hosts
Duplicate-prefix rule: last-wins + warning. Returns `{ map: IconPackMap; warnings }`.
14 tests passing. Mirrors `src/theme/discover.ts` structure exactly.

**P6 Flowchart Grammar & Annotations (2026-07-12):**
End-to-end wiring of node annotations for flowchart diagrams:
- Grammar: `@key:value` repeatable node annotations (positionally distinct from edge @). `NodeDecl` rule extended with lookahead `!(_ EdgeArrow)` to prevent ambiguity.
- Value grammar: first `:` separates key from value; remaining colons part of value (e.g., `@icon:azure:app-service`). Unquoted values greedy `[^ \t\r\n@\[\](){};]+`; quoted values `"..."`.
- IR: added `NodeShape = 'card'` to union and `FlowNode.icon?: IconRef` field. Parser calls `parseIconRef()` on raw token; throws descriptive error on invalid.
- API: `renderSync()` and `compileSync()` extended with optional `icons?: IconPackMap` parameter. Threaded into `LayoutOptions { icons }` and passed to `module.layout()`.
- Layout: icon resolution + emit via `pen.icon()` for each `FlowNode` with icon. Silent degradation if unresolvable. Icon placed at leading (left) edge inside node.
- Canonical example: `A ["App Service"] @shape:card @icon:azure:app-service`
- P6→P7 boundary: P6 handles parse → IR → emit. P7 (Brian) handles full card two-region layout (icon-left / text-right), variable node sizing.
22 tests passing. 747 total tests pass, 0 typecheck errors.

---

## Earlier Work (Archived)

Prior sessions:
- Diagram-options documentation (Group A: class/state/er/c4/requirement — 2026-07-06)
- Extension Phase 3: IntelliSense (completion + diagnostics — 2026-06-24)
- Wave-2 design realignment (front-end/architecture/packaging/layout — 2026-06-23)
- Group A `%%` header support (2026-07-07)
- Live-poster data-binding pro advocate position (2026-07-12)
- Cross-diagram links, traces, kernel geometry updates (2026-06-16)

Full archival maintained in `.squad/agents/bjarne/history-archive.md` for reference if needed.
