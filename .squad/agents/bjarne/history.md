# Bjarne — Ingestion Design

## Current Status (2026-06-15)

**Poster Keyword Complete (§17.2)**: The `poster` top-level keyword is implemented. Parser (`parsePosterInternal`), composition-theme factories (`buildCompositionThemeFor`), and full render branch (`renderPoster` + `renderCellScene`) wired into `frontend/mermaid/index.ts`. All 21 grammar types supported as cell content. Graceful degradation: unknown/failing cells warn + skip. 2451/2451 tests passing. Existing goldens byte-identical. Gallery demos: `poster-rag.{mmd,svg,png}` (executive, 2×2, flowchart+sequence+mindmap+xychart) and `poster-rag-midnight.{mmd,svg,png}` (midnight dark board).

**§17.1 Extension Mechanisms COMPLETE**: frontmatter/init config (bjarne-config-surface.md) + new top-level keyword (`poster`) are both shipped.

**Config Surface Complete**: Layout/density/themeOverrides now user-selectable via Mermaid-native config (frontmatter + `%%{init}%%`). `resolveContractTheme` helper added to theme-contract/. All 21 render branches wired. 2428/2428 tests passing. Determinism preserved.

**Recent:** Poster keyword shipped (2026-06-15). Config surface implementation (2026-06-15). Prior: requirementDiagram + kanban (2026-06-14). Commit 2325c78.

## Learnings

### Config-Surface Parsing (2026-06-15)

- **`PreprocessResult` extension**: Added `directiveLayout`, `directiveDensity`, `directiveThemeOverrides` to `PreprocessResult` in `utils.ts`. `extractInitFields` extended to parse these from `%%{init}%%` JSON payloads. Frontmatter fields (`layout`, `density`, `themeOverrides`) are already parsed into the `frontmatter` Record by the YAML parser — no additional parsing needed.
- **Precedence**: `frontmatter > %%{init}%%` for all config-surface keys. For `themeOverrides`, frontmatter object is merged over directive object (frontmatter wins key conflicts). This mirrors the existing theme precedence pattern.
- **Graceful degradation**: Unknown frontmatter keys silently ignored (YAML parses them into the Record, callers just don't read unknown keys). Invalid density values ignored by `isValidDensity` guard. Unknown layout names get a warning + fallback, no error.

### `resolveContractTheme` Override Merge (2026-06-15)

- **Location**: `packages/core/src/theme-contract/resolve.ts`. Imports all 7 theme instances directly (not via index.ts) to avoid circular dependency — index.ts re-exports from resolve.ts.
- **Fast path**: When density and overrides are both absent, returns the base theme instance unchanged (reference equality, O(1)).
- **Shorthand expansion**: 15 flat shorthand keys (accent, surface, fontFamily, cornerRadius, etc.) are expanded to their nested ThemeContract paths before deep-merge. This lets users write `themeOverrides: { accent: "#0A7" }` instead of `themeOverrides: { palette: { accent: "#0A7" } }`.
- **Deep merge**: Recursive merge — source overwrites target for primitives and arrays; both sides plain-object → recurse. Arrays are replaced, not concatenated. Deterministic.
- **REGISTRY sync**: resolve.ts maintains its own copy of the CONTRACT_THEMES registry (currently 7 themes). When new themes are added to index.ts, resolve.ts must be updated in parallel. **This is a maintenance point.**

### Layout Selection Wiring (2026-06-15)

- **Timeline only** supports layout selection from config: `timeline-columns` (default), `vertical-spine`, `serpentine`, `roadmap`, `horizontal`. Layout is passed to `buildScene`/`renderDocument` as the `layout` option.
- **Gantt** ignores layout config (always `gantt`). All other diagram types ignore `layout` gracefully.
- **Timeline + contract theme + density/overrides**: Uses `resolvedTheme` bypass in `buildScene`/`renderDocument` (skips legacy `resolveTheme` registry). This is the same pattern used by the executive-gallery tests.
- **Layout validation helper** `resolveTimelineLayout()`: validates layout string against known set, emits warning + falls back for unknown values, never throws.

### Poster DSL Parser + Render (2026-06-15)

- **Parser design (`poster.ts`)**: No imports from `index.ts` (avoids circular). `parsePosterInternal` uses `preprocessMermaid` for frontmatter, then walks body lines with `CELL_HEADER_RE = /^(\s*)cell\s*\[(\d+)\s*,\s*(\d+)\]\s*:\s*(.+)$/i`. Grid size: `GRID_RE = /^grid\s+(\d+)\s*[xX×]\s*(\d+)\s*$/` applied to `layout:` frontmatter field. Cell bodies collected as raw indented lines, then de-indented by stripping the minimum indent of non-empty lines.
- **SceneCellContent (additive)**: Added `{ kind: 'scene'; scene: Scene }` to `composition/types.ts` and `case 'scene': return content.scene` to `compileCellContent` in `layout.ts`. `layoutComposition` exported from `composition/index.ts`. The Zod schema in `schema.ts` was NOT modified (schema is for YAML-authored compositions; poster uses `layoutComposition` directly).
- **Per-cell renderCellScene**: The `renderCellScene(cellText, themeName)` helper in `index.ts` dispatches on `detectDiagramType(cellText)` and calls the appropriate grammar parser + `buildXxxScene`. All 21 grammar types handled. `'poster'` and `'unknown'` return `null` (graceful skip). Errors throw → caller catches + warns + skips.
- **Theme coherence**: `buildCompositionThemeFor(themeName)` in `poster.ts` maps each of the 7 contract theme names to a `CompositionTheme` that matches the design system (executive: white/#1F497D/Georgia; midnight: near-black/#6366F1/Inter; blueprint: deep-blue/#00A8E8/mono; etc.). Same `themeName` is passed to every `renderCellScene` call, so all cells share one contract.
- **renderPoster entry point**: Early dispatch in `renderMermaid` at the `kind === 'poster'` check (before `preprocessMermaid` for directive config, which posters don't use). Calls `parsePosterInternal` + per-cell `renderCellScene` + `layoutComposition` + `sceneToSvg`/`svgToPng`.
- **Graceful degradation**: Cell fails → `warnings.push(...)` + `continue`. All cells fail → `throw new Error('[poster] All cells failed...')`. Tests: C4 (unknown type), C5 (malformed body), C6 (all fail).
- **sceneToSvg/svgToPng imports**: Added directly to `frontend/mermaid/index.ts` (needed by `renderPoster`). These were previously only called through grammar renderers.

### Poster File Paths (2026-06-15)

- `packages/core/src/frontend/mermaid/poster.ts` — NEW: DSL parser + composition-theme factories
- `packages/core/src/composition/types.ts` — ADDITIVE: `SceneCellContent` type
- `packages/core/src/composition/layout.ts` — ADDITIVE: `case 'scene'` in compileCellContent
- `packages/core/src/composition/index.ts` — ADDITIVE: exports `layoutComposition`, `SceneCellContent`
- `packages/core/src/frontend/mermaid/index.ts` — MODIFIED: poster wiring (detect, parse, render branches, doc union types)
- `packages/core/test/mermaid-poster.test.ts` — NEW: 23 tests
- `examples/gallery/poster-rag.{mmd,svg,png}` — executive 2×2 poster demo
- `examples/gallery/poster-rag-midnight.{mmd,svg,png}` — midnight dark board demo
- `.squad/decisions/inbox/bjarne-poster-superset.md` — decision note

### Next

- `packages/core/src/frontend/mermaid/utils.ts` — PreprocessResult extended
- `packages/core/src/theme-contract/resolve.ts` — NEW: resolveContractTheme
- `packages/core/src/theme-contract/index.ts` — exports resolve.ts + 3 new theme exports (terminal/pastel/mono were already added by Barbara)
- `packages/core/src/frontend/mermaid/index.ts` — all 21 render branches updated
- `packages/core/src/index.ts` — public API exports for theme-contract
- `packages/core/test/mermaid-config-surface.test.ts` — NEW: 36 tests
- `examples/gallery/config-density-compact.{mmd,svg,png}` — demo: executive + compact
- `examples/gallery/config-accent-override.{mmd,svg,png}` — demo: midnight + teal accent
- `examples/gallery/config-layout.{mmd,svg,png}` — demo: executive + vertical-spine timeline

### requirementDiagram IR + Layout (2026-06-14)
- **IR**: 3 collections — requirements (name, kind, id?, text?, risk?, verifymethod?), elements (name, type?, docref?), relationships (src, dst, kind). Semantic only, 7 relationship kinds.
- **Typed variants**: 6 keyword variants (requirement/functionalRequirement/…/designConstraint) map to «stereotype» labels. Real Mermaid shows «Requirement», «Functional», «Element» etc.
- **Layout**: 2-column grid reusing class grammar layout logic. Title band + compartment divider + attribute list. Edge pills: «kind» rounded rect at midpoint. Open arrowhead at target.
- **A/B gap**: Real Mermaid uses dagre graph layout (single column, compact). Our 2-column grid is wider/shorter but structurally faithful.
- **Parser edge case**: Block parsing must handle BOTH multi-line (`requirement foo {\nid: 1\n}`) AND inline (`requirement foo { id: 1 }`) syntax. Use `parseInlineFields()` with field-keyword-as-delimiter regex. The `(-?>)` regex pattern for relationship arrows means optional-dash+mandatory-`>`; correct pattern for `->` OR `-` is `(?:->|-)`.
- **Relationship regex**: `/^(\S+)\s*-\s*(\w+)\s*(?:->|-)\s*(\S+)$/` handles both directed and undirected forms.

### kanban IR + Layout (2026-06-14)
- **IR**: columns (id, label, cards[]), each card (id, label, metadata?). Semantic only.
- **Parser**: indentation-aware like mindmap. First non-zero indent sets `indentUnit`. Depth 1 = columns, depth 2 = cards. `id[label]` or bare label syntax for both.
- **Metadata**: `@{ assigned: "x", priority: "high", ticket: "..." }` — comma-split, key: value pairs, attached to last card.
- **Layout**: columns side-by-side, equal height (maxColHeight). Colored header band + stacked card boxes. Header color palette cycles: green/purple/pink/blue/amber/teal. Bottom-corner squaring rect removes rx from header bottom.
- **Text wrap**: `wrapText()` helper for long card labels at `cardMaxWidth`.
- **A/B gap**: Real Mermaid kanban is more compact (99px tall for 3 cols/3 cards). Our cards are taller with more padding. Color palette faithfully matches (green/purple/pink for Todo/Doing/Done).

### Parser Crawl Findings (real Mermaid, 2026-06-14)
- requirementDiagram fields must be on separate lines (no inline `{ id: 1 text: foo }` in real Mermaid). Our parser supports both for robustness.
- kanban uses 2-space indentation in official docs. Tabs and other indent widths handled by measuring first non-zero indent.
- Both grammars use `requirementDiagram` / `kanban` as case-insensitive keywords.

## Next

Archive maintained in history-archive.md.

---
- (2026-06-14) Theming architecture decided — general-contract model, §12 rewritten; will implement per-component theme contract
- (2026-06-14T23:09:08Z) Theme vocabulary resolved; proof set = flow+sequence+xychart
- (2026-06-14T23:32:53Z) Theme contract spike succeeded; binding pattern established
- (2026-06-15T04:09:23Z) **Migration step 1 done** — contract gained 4 tokens (surfacePanel, inkPanel, markerShape, pattern); doc §12 sync pending
- (2026-06-15T00:15:00Z) **Migration step 2 done** — node-link family on contract; 12 types coherent under executive
- (2026-06-15T11:35:00Z) **Theme-contract migration COMPLETE** — all 21 diagram types adopt Tier-2 contract; `executive` theme renders coherently; determinism preserved (1976/1976 tests)
- (2026-06-15T17:04:29Z) **3 named contract themes added; matrix proven** — midnight (dark), blueprint (technical), editorial (warm print); zero per-component changes required; all 21 components light up deterministically; 2206 tests passing (Commit 2325c78)
- (2026-06-15T19:00:00Z) **Config surface complete** — layout/density/themeOverrides selectable via frontmatter + %%{init}%%; resolveContractTheme helper; 36 new tests; 2428/2428 passing; existing goldens byte-identical
- (2026-06-15T22:00:00Z) **poster keyword shipped** — §17.2 multi-diagram composition; DSL parser; all 21 grammar types as cells; theme-per-cell coherence; buildCompositionThemeFor for 7 contract themes; 23 new tests; 2451/2451 passing; gallery demos: poster-rag (executive) + poster-rag-midnight; §17.1 extension mechanisms COMPLETE
