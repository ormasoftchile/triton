# Bjarne — Ingestion Design

## Current Status (2026-06-14)

**Tier 3 Extension Complete**: requirementDiagram + kanban grammars shipped. 1627/1627 tests passing. Determinism preserved. Gallery examples 40 + 41 emitted.

**Recent:** requirementDiagram + kanban (2026-06-14). Prior: sequence autonumber 1-indexed + Note parsing; Radar gallery example syntax update. Commit 01bcc61.

## Learnings

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
