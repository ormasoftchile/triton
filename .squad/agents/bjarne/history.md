## # Bjarne — Ingestion Design

**[HISTORY SUMMARIZED 2026-07-13T00:32:23Z]**

---

## Learnings — Architecture-Beta Parity (Phase A) — 2026-07-13T20:10:00-04:00

### Corrected Parity Scope
The earlier gap report (decisions.md, Brian's architecture-beta analysis) listed several phantom features that are NOT real Mermaid architecture-beta syntax. Dropping them was correct:
- Edge labels/titles — architecture-beta has none
- "iconText" / icon alt text — not a feature
- fcose engine config knobs (`randomize`, `seed`, `nodeSeparation`, etc.) — Mermaid internal; Triton uses its own layout engine
- `title`/`accTitle`/`accDescr` accessibility directives — deferred, not core parity

### Grammar Changes (`src/diagrams/mermaid/architecture/grammar.peggy`)
1. **Nested groups** — `GroupLine` now accepts optional `in <parentId>` clause (same pattern as `ServiceLine`). IR carries `parent?: string` on `ArchGroup`.
2. **Junction** — new `JunctionLine` rule parses `junction <id> (in <groupId>)?`. Supports both explicit `in` and indentation-based group membership (same logic as services).
3. **Arrow direction** — `EdgeLine` refactored to use `Arrow` rule with ordered choices: `<-->`, `-->`, `<--`, `--`. Each returns `{ left, right }` booleans. `<--` was missing in the original; added.
4. **Group-edge `{group}` modifier** — `EdgeEndpoint` rule parses optional `{group}` suffix on any endpoint Ident. Result: `fromGroup: boolean`, `toGroup: boolean` on each edge.
5. **Align directives** — new `AlignLine` rule: `align row|column <id> <id> ...` (≥2 members via `head + tail+`). Axis lowercased. Stored in `aligns[]` array on document.
6. **Iconify icon tokens** — icon slot was already `$[^)\n]*` which accepts `:`, so `logos:aws-s3` etc. worked without change. Confirmed + tested.
7. **`Line` dispatch order** — updated to `GroupLine / ServiceLine / JunctionLine / AlignLine / EdgeLine / BlankLine`.

### IR Changes (`src/diagrams/mermaid/architecture/ir.ts`)
- `ArchGroup.parent?: string` — optional parent group ID
- New `ArchJunction { id, group? }` — 4-way split node, no icon/label
- `ArchEdge` extended: `fromGroup: boolean`, `toGroup: boolean`, `arrowLeft: boolean`, `arrowRight: boolean`
- New `ArchAlign { axis: 'row'|'column', members: readonly string[] }`
- `ArchitectureDocument` extended: `junctions: readonly ArchJunction[]`, `aligns: readonly ArchAlign[]`
- `index.ts` re-exports: `ArchJunction`, `ArchAlign` added

### Parser Regeneration
`node scripts/build-grammars.mjs` — all 23 grammars compiled successfully.

### Tests
Created `test/architecture-grammar.test.ts` — 26 parse-level tests, 0 rendering tests:
- 3 nested group tests
- 4 junction tests (bare, with `in`, indented, count)
- 4 arrow direction tests (all 4 forms)
- 3 group-edge modifier tests
- 5 align directive tests
- 4 iconify token tests
- 3 backward-compatibility tests on existing example

Full suite: **825 tests, 44 files, all passing** (0 failures).

### TODOs Handed to Brian (Phase B — layout)
1. **Junctions** — `ArchJunction` nodes must be laid out as small 4-way split dots (no icon, no label). Layout must route up to 4 edges (L/R/T/B) through them. Currently `layoutArchitecture()` ignores `ir.junctions`.
2. **Arrow rendering** — `ArchEdge.arrowLeft` / `arrowRight` flags must drive arrowhead markers on each edge end. Currently the renderer uses a single `ARROW_ID` marker only; needs conditional per-end arrowhead logic.
3. **Group-edge `{group}` modifier** — When `fromGroup` or `toGroup` is true, the edge's port should attach to the group-box boundary, not the service's own box boundary. Currently ignored.
4. **Align constraints** — `ir.aligns` carries `{ axis: 'row'|'column', members }` layout hints. Brian's `layoutArchitecture()` should honour these by constraining the relevant nodes to the same row/column in the layered layout pass (or post-process adjustment).
5. **Nested group rendering** — `ir.groups` items with a `parent` field should be drawn as visually nested inside their parent group box, not as independent sibling boxes.
6. **Iconify icon resolution** — `ArchService.icon` and `ArchGroup.icon` may now carry `prefix:name` tokens. Brian's `iconGlyph()` helper currently does keyword matching (server/database/cloud/…). When the icon string contains `:`, it should be treated as an `IconRef` and resolved via the icon pack system. Fallback: generic box glyph.

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
