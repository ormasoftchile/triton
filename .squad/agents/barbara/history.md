# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-14T00:20:00Z (Migration Step 1: Timeline binding complete)

---

## 2026-06-14 — Migration Step 1: Timeline ResolvedTheme → Tier-2 Contract

### bindTimelineTheme + contract enrichment + precedence rule (2026-06-14T00:20:00Z)

Completed Migration Step 1: generalized the timeline `ResolvedTheme` into the Tier-2 contract,
proving the contract vocabulary complete against its hardest consumer.

#### Contract tokens added (additive — no existing bindings broken)

| Token | Interface | Purpose |
|-------|-----------|---------|
| `surfacePanel` | `RolePalette` | Panel/lane/card background — between `surface` and `surfaceRaised` |
| `inkPanel` | `RolePalette` | Text on panel backgrounds (track headers, kanban titles) |
| `markerShape` | `ShapeLanguage` | Default milestone/marker shape (optional) |
| `pattern` | `StatusRole` | Visual fill pattern for status indicators (optional) |

All four are additive. All existing bindings (flow/sequence/chart) compile without change.

#### What was built

**`packages/core/src/themes/contract-binding.ts`** (new):
- `bindTimelineTheme(contract: ThemeContract): ResolvedTheme` — full derivation: canvas, typography, axis, track, activity, milestone, status map, legend, section bands, entryStyle
- Density tables: compact/normal/comfortable → geometry
- Convention enforcement: axisLineColor ← ink, gridlineColor ← border, trackSeparator ← border, headerBackground ← surfacePanel

**`packages/core/src/themes/index.ts`** (updated — precedence rule):
- `resolveTheme()` now: REGISTRY first → contract fallback → consulting default
- `executive` in REGISTRY → always returns dark-navy legacy theme (NOT contract)
- Re-exports `bindTimelineTheme`

**`packages/core/src/render/index.ts`** (updated):
- `resolvedTheme?: ResolvedTheme` added to `BuildSceneOptions` — bypasses resolveTheme() for direct binding calls (used by gallery demo to avoid legacy name collision)

**`packages/core/src/theme-contract/types.ts + executive.ts`** (updated):
- Four new tokens added to types; executive concrete theme updated accordingly

#### Tests (+65 unit + 16 gallery = +81 new tests)

```
packages/core/test/timeline-contract-binding.test.ts  — binding validity, determinism, precedence
packages/core/test/executive-gallery-timeline.test.ts — gallery emit + coherence + precedence guard
```

Total: 1822 (baseline) + 65 (unit) = 1887 passing. ZERO regressions.

#### Gallery outputs

| File | Derivation |
|------|-----------|
| `examples/gallery/executive-timeline.svg/png` | `bindTimelineTheme(CONTRACT_THEMES.executive)`, timeline-columns layout |
| `examples/gallery/executive-gantt.svg/png` | `bindTimelineTheme(CONTRACT_THEMES.executive)`, gantt layout |

`git status --porcelain examples/gallery/*.svg examples/gallery/*.png` shows ONLY these 4 files as `??`. All 14 legacy timeline theme goldens byte-identical.

#### Learnings from the timeline binding

1. **Contract held up.** Every field in `ResolvedTheme` is expressible from the Tier-2 contract with only 4 additive token additions. Vocabulary is complete enough for the timeline family.

2. **`surfacePanel` + `inkPanel` are genuine general tokens.** Needed for lane/track header backgrounds (timeline + gantt), kanban card backgrounds. Added to contract.

3. **`markerShape` is needed.** `timeline-columns` and horizontal milestones both need a shape token. `shape.markerShape?: 'circle' | 'diamond' | 'square' | 'triangle'` added to ShapeLanguage.

4. **`StatusRole.pattern` bridges the workflow state vocabulary.** The timeline has `diagonal-hatch` (cancelled) and `dashed-border` (tentative) patterns. Adding `pattern?` to `StatusRole` puts the semantic intent in the contract rather than the binding.

5. **PRECEDENCE RULE is enforced in `resolveTheme()`.** The critical invariant: REGISTRY lookup before contract lookup. `executive` name → always dark-navy legacy. All 14 legacy goldens preserved. Contract binding only applies to non-legacy names or direct calls.

6. **`timeline-columns` and `gantt` layouts have hardcoded Mermaid-faithful palettes.** Section band colors and task bar fills use internal hardcoded color tables, NOT the theme accent. Canvas, typography, and axis colors DO come from the contract binding. Full accent-color adoption requires layout-level changes — this is Step 2 work, not Step 1.

7. **Coherence is foundational, not complete.** The 5 executive diagrams now share white canvas + Georgia serif + slate ink. The timeline section bands (indigo/orange/purple Mermaid palette) and gantt task bars (blue/grey/red Mermaid palette) are not yet executive navy. This is the honest state — reported in decision doc.

8. **`resolvedTheme` bypass in BuildSceneOptions** is the right architectural pattern for demo/test scenarios where you want contract-derived rendering without touching the name registry. Used here to render executive-timeline/gantt goldens without colliding with the legacy `executive` name.

#### Files created/modified

```
packages/core/src/theme-contract/types.ts              (modified — 4 new tokens)
packages/core/src/theme-contract/executive.ts          (modified — new token values)
packages/core/src/theme-contract/index.ts              (modified — doc comment update)
packages/core/src/themes/contract-binding.ts           (NEW — bindTimelineTheme)
packages/core/src/themes/index.ts                      (modified — precedence rule + re-export)
packages/core/src/render/index.ts                      (modified — resolvedTheme bypass option)
packages/core/test/timeline-contract-binding.test.ts   (NEW — 65 tests)
packages/core/test/executive-gallery-timeline.test.ts  (NEW — 16 tests)
examples/gallery/executive-timeline.svg                (NEW)
examples/gallery/executive-timeline.png                (NEW)
examples/gallery/executive-gantt.svg                   (NEW)
examples/gallery/executive-gantt.png                   (NEW)
examples/gallery/index.html                            (modified — added examples 48+49)
.squad/decisions/inbox/barbara-migration-step1-timeline.md (NEW)
```

---

## 2026-06-14 — Theme Contract Spike: executive theme across flow + sequence + xychart

### ThemeContract + executive + three bindings (2026-06-14T23:15:00Z)

Implemented the Tier-2 general theme contract (§12) and validated it by applying
the `executive` theme to all three proof-set components.

#### What was built

**`packages/core/src/theme-contract/`** (new module):
- `types.ts` — `ThemeContract` interface: `palette` (RolePalette: surface/ink/accent/border/muted/status + workflow states), `dataPalette` (categorical min-6, sequential ramp, diverging ramp), `typography` (family/fallback/scale/weights), `spacing` (unit+steps, advisory), `density` ('compact'|'normal'|'comfortable'), `shape` (cornerRadius/nodePadding/strokeScale/connectorStyle), `effects` (fidelity 0–3, dropShadow, glow, motion).
- `executive.ts` — concrete theme: #FFFFFF surface, #1E293B slate ink, #1F497D navy accent, Georgia serif, `comfortable` density, 4px corner radius, elbow connectors, fidelity tier 2 (Polished), 8-entry categorical data palette.
- `index.ts` — `CONTRACT_THEMES` map, `isContractTheme()` guard.

**Three Tier-3 bindings (new files):**
- `grammars/flow/contract-binding.ts` — `bindFlowTheme(contract)`: density drives layerGap/nodeGap/margins; shape drives nodeRx/edgeStyle; palette drives nodeFill/nodeStroke/statusFills; type scale drives font sizes.
- `grammars/sequence/contract-binding.ts` — `bindSequenceTheme(contract)`: density drives rowHeight/colGap/margins; shape drives participantBoxRx/fragRx; accent drives participantBoxStroke/fragTabFill; type scale drives labelFontSize/msgFontSize.
- `grammars/chart/contract-binding.ts` — `bindChartTheme(contract)`: dataPalette.categorical → piePalette; density drives canvas margins/height; type scale drives titleFontSize/tickLabelFontSize; ink/border roles drive axis/gridline.

**Opt-in wiring in `frontend/mermaid/index.ts`:**
Sequence, flowchart, and xychart branches now check `isContractTheme(themeName)` and take the binding path when true. All other theme names fall through to the existing resolvers unchanged — byte-identical for all pre-existing diagrams.

#### Gallery outputs (new files, existing goldens untouched)

| File | viewBox |
|------|---------|
| `executive-flowchart.svg/png` | 2016×290 |
| `executive-sequence.svg/png` | 852×1201 |
| `executive-xychart.svg/png` | 920×600 |

`git status --porcelain examples/gallery/*.svg` shows only these 3 new files (`??`).

#### Test results

| Suite | Tests |
|-------|-------|
| Pre-existing | 1759 |
| `theme-contract-bindings.test.ts` (new) | +52 |
| `executive-gallery-emit.test.ts` (new) | +11 |
| **Total** | **1822 passing** |

#### Coherence assessment

**PASSES.** All three diagrams cohere as one design system:
- **Palette:** navy `#1F497D` appears as node borders (flow), participant box borders + fragment tabs (sequence), primary bar series (xychart). Ink `#1E293B` is consistent text color. Background `#FFFFFF` uniform.
- **Typography:** Georgia serif in all three. Scale applied hierarchically: title lg → labels md/base → secondary sm/xs.
- **Shape:** 4px corner radius in flow + sequence. Comfortable density produces generous, airy whitespace across all three.
- **Data palette:** xychart bars use categorical[0] = #1F497D (accent), line uses categorical[1] = #2E86AB. This validates the "categorical[0] = accent" convention.

#### Vocabulary learnings from the spike

1. **`axisColor` needs guidance:** chart binding maps axisColor → `palette.ink`. Works but axes read heavier than ideal. The binding should use `inkMuted` for grid lines (done); the guidance doc should recommend `ink` for axis lines, `border` for gridlines.
2. **`connectorStyle` is advisory:** only consumed by flow. Sequence and chart don't use it — this is correct and expected. Document in migration guide.
3. **`categorical[0]` should equal `palette.accent`** — convention to enforce in all future contract themes.
4. **Density tables are Tier-3, not Tier-2:** each binding independently defines compact/normal/comfortable geometry tables. These are not the contract's business — they are component-level derivation rules. The contract just declares the density level.
5. **Status fills in flow use hex alpha notation (`#RRGGBB` + `'22'`/`'33'`):** this works in SVG but is not strictly WCAG-friendly. A proper tint utility function would be cleaner. Filed as future work.

#### Files created

```
packages/core/src/theme-contract/types.ts
packages/core/src/theme-contract/executive.ts
packages/core/src/theme-contract/index.ts
packages/core/src/grammars/flow/contract-binding.ts
packages/core/src/grammars/sequence/contract-binding.ts
packages/core/src/grammars/chart/contract-binding.ts
packages/core/test/theme-contract-bindings.test.ts
packages/core/test/executive-gallery-emit.test.ts
examples/gallery/executive-flowchart.svg
examples/gallery/executive-flowchart.png
examples/gallery/executive-sequence.svg
examples/gallery/executive-sequence.png
examples/gallery/executive-xychart.svg
examples/gallery/executive-xychart.png
.squad/decisions/inbox/barbara-theme-contract-spike.md
```

---

## 2026-06-14 — Tier 3 Long-Tail Grammars Shipped

### block-beta + packet-beta + architecture-beta (2026-06-14T19:30:00Z)

Completed Tier 3 long-tail shipment. All five remaining standard Mermaid diagram types production-ready:

**block-beta:** N-column fixed-grid layout with row-major placement, spans, groups as background containers, straight arrows with midpoint labels. Gallery: 472×196 viewBox.

**packet-beta:** 32-bit field grid with row wrapping. Fields crossing boundaries split into segments with boundary labels. Adaptive typography for narrow fields. Gallery: 984×180 viewBox.

**architecture-beta:** Services, groups (indentation-nested + explicit `in`), junctions, port-anchored edges (L/R/T/B sides). Constraint-grid placement deterministic. Icon registry extended: server, disk, internet glyphs. Gallery: card 44.

**Key design principles:**
- All coordinates use `rhuInt()` for determinism
- Layout uses deterministic algorithms (no heuristic solvers)
- Graceful degradation: unknown icons/endpoints warn but don't fail
- Width parity with real Mermaid where possible (e.g., packet 984px); visual compactness acceptable for deterministic rendering

**Test suite:** 1759/1759 passing. All pre-existing goldens byte-identical.

### A/B Verification Results

| Grammar | Structure | Layout |
|---------|-----------|--------|
| block-beta | ✓ grid, spans, groups, arrows | Deterministic, more spacious |
| packet-beta | ✓ 32-bit fields, wrapping | Width-parity; taller but semantic |
| architecture-beta | ✓ services, groups, edges | Constraint-grid, deterministic |

All semantic elements present. Visual layout more compact/spacious than real Mermaid but structurally faithful.

---

## Earlier Work (Archived)

For detailed notes on gantt-faithful layout, timeline-columns refactor, radar curve syntax, see history-2026-06-14-archived.md.
- (2026-06-14) Theming architecture decided — general-contract model, §12 rewritten; will implement per-component theme contract
- (2026-06-14T23:09:08Z) Theme vocabulary resolved; proof set = flow+sequence+xychart
