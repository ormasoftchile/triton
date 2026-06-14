# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).

## 2026-06-09 — Section 09 Agent Integration

### Ingestion Flows Designed

Four end-to-end ingestion workflows designed for §9:

1. **ADO Work Items → IR**: ADO fields map to IR as follows — `System.Title` → `label`, `System.State` → `status` (via state-to-enum table), `System.WorkItemType` → `category` or entity promotion (Milestone type → IR milestone), `System.IterationPath` → `span` (e.g. `Platform\2026\Q2` → `span: 2026-Q2`), `System.AreaPath` → track. The prompt controls what work item types are included, which time window is used, and how AreaPath segments become tracks. Bugs/tasks are rejected when the prompt says so — not imported as noise.

2. **Natural Language Prose → IR**: Free text is parsed for temporal mentions (H1, Q3, specific dates), named teams/phases, and event types. Uncertain dates use `tbd`/`ongoing` explicitly rather than null or a guessed date. The prompt provides the track structure that the prose lacks.

3. **GitHub Projects → IR**: ProjectV2 ITERATION custom fields map to `span`; DATE fields map to `start`/`milestone.date`; status select fields map to IR enum. GitHub does not have a work item type concept — filtering requires label/custom field conventions specified in the prompt.

4. **Mermaid Timeline → IR**: `title` → `metadata.title`, `section` → `sections[]`, events → activities on a default single track. Mermaid has no swimlane concept; multi-track structure requires prompt instruction.

### Ingestion Contract

Established the four-category ingestion contract (Assumed / Inferred / Defaulted / Rejected) as the formal boundary for what ingestion may do. The prompt is always a first-class input that must be read before the source data is touched. Key prohibitions: must not compute dates, must not import the whole backlog, must not generate non-stable sequential IDs.

### Validation / Error-Repair Loop Design

Five-layer validation pipeline:
- Layer 1: Syntactic YAML/JSON parse
- Layer 2: JSON Schema conformance (required fields, types, enums, ID regex, oneOf for start/span)
- Layer 3: Well-formedness invariants from Mark's contract (referential integrity, ID uniqueness, date ordering, progress bounds, group acyclicity)
- Layer 4: Render-readiness (delegated to Barbara §5 — referenced, not duplicated)
- Layer 5: Semantic advisory (degenerate documents, out-of-range items — warnings only)

Error messages are path-anchored with three components: path (e.g. `activities[2].track`), machine-readable code (e.g. `UNRESOLVED_REF`), and a suggested fix. The agent repair cycle is: Generate → Validate → Report errors → Agent applies surgical patches → Re-validate → Render.

### MCP Tool Surface

Four tools defined:
- `validate_timeline`: input IR (object or string), output structured errors/warnings with path anchors
- `render_timeline`: input IR + format + theme, output base64-encoded bytes + mime type
- `describe_schema`: input optional version/entity, output JSON Schema + per-field docs
- `suggest_time_range`: input list of date hints, output recommended time_range + axis_unit + rationale

Two deployment modes: local subprocess (CLI `timeline mcp-server`) and hosted cloud endpoint.

### Round-Trip / Provenance Approach

Provenance stored in `metadata` block per entity: `source`, `ado_id`/`github_issue`, `ado_revision`, `ingested_at`. Re-sync uses source ID (not IR id) as stable foreign key. Only source-mapped fields are overwritten on re-sync; human-edited fields (label, description, color, progress) are preserved. IR id slugs are frozen after first ingestion — never regenerated. YAML serialisation uses canonical field order and consistent quoting to minimise spurious git diffs.

### IR Gaps Flagged (for Leslie + Mark)

1. **`today` field missing from metadata** — `now` symbolic date is non-deterministic without an explicit `today: date?` in metadata. Leslie's scope spec requires explicit input for determinism but Mark's contract does not include this field.
2. **`index` vs `order` naming discrepancy** — Mark's binding contract (invariant 14) uses `track.index`; the 04-ir.tex spec uses `track.order`. Need canonical name.
3. **`span` + `start` co-presence undefined** — No rule for what happens if both `span` and `start`/`end` are present on the same activity. Suggested fix: treat as schema error.

## 2026-06-10 — Team Update: Design Spec & Agent Integration Design Complete

✓ **Design Spec Section Published (Wave 1)**
- §9 Agent Integration (validation pipeline, MCP tools, ingestion contract)

✓ **IR Gaps Flagged & Resolved (Wave 2)**
Your gap reports (Gap A, Gap B, Gap C) were essential for IR contract refinement:
- metadata.today field (date anchor for deterministic now/relative dates)
- track.index vs track.order naming (consensus on field name)
- span/start co-presence exclusivity (Invariant #12: SPAN_START_CONFLICT)

Mark's reconciliation resolved all gaps — no changes needed to agent generation contract.

**Design Spec Location:** `design/` (LaTeX, ready to compile)  
**MCP Tools (normative):**
- `validate_timeline` — 5-layer pipeline
- `render_timeline` — Deterministic rendering
- `describe_schema` — JSON Schema + docs
- `suggest_time_range` — Infer axis from dates

**Validation Layers:** Syntax → Schema → Invariants → Render-readiness → Advisory

Five built-in themes ready; error contract with path-anchored codes and suggested fixes enables Generate → Validate → Repair cycle.

## 2026-06-13 — Tier 0 Inc 1: Mermaid Front-End Architecture + Flowchart Parser

### Learnings

**Front-end architecture (detect → parse → build → serialize):**
The Mermaid front-end implements §15 Path A of the dual front-end architecture. The pipeline is:
1. `preprocessMermaid(text)` — strips YAML frontmatter (`--- … ---`), extracts `%%{init}%%` directive fields (theme/title), drops `%% comment` lines. Returns cleaned body + structured metadata. Implemented in `utils.ts` as a shared utility.
2. `detectDiagramType(text)` — after preprocessing, reads the first content line's leading keyword: `flowchart`/`graph` → 'flowchart', `sequenceDiagram` → 'sequence', `gantt`/`timeline`/`mindmap` → respective kinds. Case-insensitive.
3. `parseFlowchart(text)` — grammar-specific parser. Strips frontmatter, finds header, scans body lines. Returns `FlowDocument`. Internal `parseFlowchartInternal` also returns direction + warnings + frontmatter for use by `renderMermaid`.
4. `buildFlowScene(doc, themeOverride)` — existing Flow grammar kernel, unchanged. The theme override applies direction (LR/TB) and any resolved theme name.
5. `sceneToSvg` / `svgToPng` — existing kernel serializers, unchanged.

**Flowchart-parsing subset implemented:**
- Header: `flowchart`/`graph` + direction (LR/TB/TD/RL/BT). LR fully supported; TB/TD/RL/BT deferred (layout engine is LR-only in Inc 1).
- Node shapes: `[rect]`, `(rounded-rect)`, `((circle))`, `{diamond}`, `([stadium])`, `[[subroutine→rect]]`. Default bare-ID → `rounded-rect`.
- Edges: `-->` (sync/solid), `---` (undirected→sync/solid), `-.->` (async/dotted), `==>` (thick→sync/solid). Labels via `-->|label|` or `-- label -->` (normalized to pipe form before scanning).
- Chains: `A --> B --> C` → edges (A,B) and (B,C). Multi-statement lines via `;`.
- Implicit node creation: any node seen in an edge and not yet declared is auto-created (label = raw ID, shape = rounded-rect). Later explicit declaration updates label+shape.

**Deferrals (explicit TODO list in flowchart.ts):**
Subgraphs, classDef/style/class, click/href, link curve styles, markdown-string labels, `&` multi-node edges, extended shapes (hexagon/trapezoid/asymmetric), thick-edge labels, RL/BT layout flip.

**ID sanitization:**
FlowDocument schema requires `^[a-z][a-z0-9-]*$` IDs. Mermaid IDs are arbitrary tokens. The sanitizer (per-session `idMap`) applies: camelCase→kebab, uppercase→lowercase, underscore/space→hyphen, strip non-[a-z0-9-], collapse hyphens, prefix 'n' if starts with digit. Collision resolution appends `-2`, `-3`, etc.

**Frontmatter/directive handling:**
The `preprocessMermaid` utility handles both frontmatter (parsed via the `yaml` package) and `%%{init}%%` directives (JSON/single-quote extraction with regex fallback). Theme precedence in `renderMermaid`: `options.theme` > frontmatter `theme:` > `%%{init}%%` directive > default.

**Error policy:**
Unrecognized lines → skip with collected warning. Never throws on syntax errors. `parseMermaid`/`renderMermaid` throw with a clear `[Tier 0 Inc 1]` label for unsupported diagram types (sequence/gantt/timeline/mindmap/unknown).

**Test results:**
57 new tests in `mermaid-frontend.test.ts`. All 852 tests pass (57 new + 795 existing). All existing goldens byte-identical. Gallery: `mermaid-flowchart.svg` + `mermaid-flowchart.png` emitted with dark-flow theme. The rendered PNG is visibly superior to Mermaid's default output: dark navy background, teal/violet/emerald accent fills per shape kind, clean curved edges, all shapes/labels correct.

## 2026-06-13 — Tier 0 Inc 1 Hardening: Real-Mermaid Crawl Fidelity

### Learnings

**Root cause of whitespace-independent edge failures:**
The node ID scanner used `[a-zA-Z_][a-zA-Z0-9_-]*` — hyphen was included in the character class. For `A-->B`, the scanner greedily consumed `A--` (stopping only at `>`), leaving `>B` which didn't match any edge operator. Fix: removed `-` from the ID char class (→ `[a-zA-Z_][a-zA-Z0-9_]*`). This is correct per Mermaid's actual grammar (identifiers use `\w+`, no hyphens in bare IDs). One-char change, maximum impact.

**Tokenizer rewrite scope:**
The fix was surgical — the existing tokenizer design (scanNodeToken / scanEdgeToken / parseChain) was architecturally sound. Changes:
1. **ID charset** — removed `-` from `scanNodeToken` regex. Fixes `A-->B`, `A-->|x|B`, `A==>B`, `A--xB`, `A---B`, `A-.->B` (all compact forms).
2. **Extended edge operators** — added all missing Mermaid operators to `scanEdgeToken` (labeled + unlabeled, most-specific first): `<-.->`, `-.-`, `<==>`, `===`, `<-->`, `o--o`, `--x`, `--o` plus their `|label|` variants.
3. **Inline label normalization** — extended `normalizeLabeledEdges` to handle `== text ==>` → `==>|text|` and `-. text .->` → `-.->|text|`.
4. **Extended shapes** — added to `scanNodeToken`: `{{...}}` hexagon→diamond, `[(...)` cylinder→rect, `[/.../ ]` parallelogram-right→rect, `[\...\]` parallelogram-left→rect, `>...]` asymmetric→rect. Regex capture groups extract CLEAN labels without shape delimiters.
5. **Shape degradation warnings** — `ScanNodeResult` now carries optional `shapeWarning?` field; `parseChain` collects these into the warnings array.
6. **Chain unrecognized-content warning** — when the edge scanner returns null with non-whitespace remaining in a chain, a warning is pushed (previously silent).
7. **Direction TD warning** — the `direction === 'TB'` layout-deferred warning was missing 'TD'; fixed to `direction === 'TB' || direction === 'TD'`.

**Public warnings on parseMermaid:**
`MermaidParseResult` now includes `warnings: string[]`. `parseMermaid` delegates to `parseFlowchartInternal` (previously called the simpler `parseFlowchart` which discarded warnings). Callers can inspect what was skipped, deferred, or degraded.

**Corpus test approach:**
Added `test/mermaid-flowchart-corpus.test.ts` — 61 new tests organized by the 7 acceptance criteria. Covers: compact/spaced edges, all edge operator families, extended shapes with label cleanliness assertions, graceful degradation, public warning surface, all direction keywords, and all deferral categories. Also includes 9 "complete pattern" corpus tests (CI pipeline, decision flow, async pipeline, thick approval, mixed operators, all shapes, all inline labels, official Mermaid docs Christmas example, frontmatter+compact).

**Test results after hardening:**
914 tests pass (61 new corpus + 57 existing mermaid + 796 other). All existing goldens byte-identical. `mermaid-flowchart.svg` + `.png` unchanged (demo uses spaced syntax — was already correct). Build clean (TypeScript strict mode, 0 errors).

## Context: Fidelity Bar for Remaining Mermaid Parsers (Seq/Gantt/Timeline/Mindmap)

This flowchart parser hardening establishes the tokenizer and fidelity bar for all remaining Mermaid parsers. Future Inc implementations (Sequence, Gantt, Timeline, Mindmap) should follow this approach:

1. **Real-data crawl validation** — Seed acceptance criteria with a crawl of real Mermaid syntax in the wild. Validate each parser against the crawl corpus (aim: 50+ diverse patterns).

2. **Whitespace-independent parsing** — Parse both compact (`A-->B`) and spaced (`A --> B`) syntax identically. The tokenizer (scanNodeToken / scanEdgeToken) must be whitespace-agnostic; normalization happens downstream.

3. **All documented operators** — Enumerate the parser's operators from Mermaid's documentation and implement all of them (including inline label variants `|label|`). Identify and implement all shape types / styling constructs that aren't deferred.

4. **Clean label extraction** — Use regex capture groups to extract labels without shape delimiters, quotes, or parser-internal syntax. Test that `[/Para/]`, `{{Hex}}`, and other extended shapes produce clean labels in the output.

5. **Graceful degradation with warnings** — Never silently drop or mangle unsupported syntax. Return a valid (possibly partial) document and emit warnings that callers can inspect. `parseMermaidX` should return a public `warnings: string[]` field for all diagram types.

6. **Explicit deferral list** — Document all limitations (subgraphs, directives, etc.) in the parser file. Link to Inc 2+ tasks for each deferral. Callers must know what is not yet implemented.

This establishes consistency across all Mermaid diagram types and ensures user feedback is clear (warnings, not silent failures).

## 2026-06-13 — Tier 0: Mermaid sequenceDiagram Parser

### Learnings

**Arrow → kind mapping (8 operators):**
The Mermaid sequence diagram has 8 arrow operators that map to 3 IR kinds:
- `->>` (solid arrowhead) → `sync`; `-->>` (dashed arrowhead) → `reply`
- `->` (solid open) → `sync`; `-->` (dashed open) → `reply`
- `-)` (solid open circle) → `async`; `--)` (dashed open circle) → `async`
- `-x` (solid cross) → `async`; `--x` (dashed cross) → `async`

All eight are handled whitespace-independently using a single regex with alternation ordered most-specific-first (4-char `-->>` before 3-char `-->` before 2-char `->`).

**Activation shorthand `+/-` semantics:**
The `+` prefix on the TO participant activates the TO participant; the `-` prefix on the TO participant DEACTIVATES THE FROM participant (the sender who was previously activated). This is the key insight from the Mermaid docs example `Alice->>+John: Hello` / `John-->>-Alice: Great` — the `-` on Alice's position deactivates John (the FROM). The parser tracks per-participant stacks of `from_order` values; `+` pushes, `-` pops and finalizes an `Activation` entry.

**Explicit activate/deactivate timing:**
`activate A` appearing after message at order N uses `from_order = N` (the last message, which triggered A's activity). `deactivate A` appearing after message at order M uses `to_order = M`. This produces `Activation { from_order: N, to_order: M }` which is schema-valid as long as `N ≤ M`.

**Fragment sections (alt/par):**
`alt <label>` opens a multi-section fragment and simultaneously starts the first section with `guard = label`. Each `else <label>` closes the current section and opens a new one. `end` closes the last section and finalizes the fragment. The `Fragment.label` = the first alt/par label. Sections are collected as `FragmentSection[]` on the IR only when there are ≥ 2 sections (single-compartment fragments use no sections, preserving byte-identity with the existing IR format). `critical`/`break` are in the Fragment.kind enum — they pass through with a DEFERRED compat warning.

**Notes deferral:**
`Note left of A`, `Note right of A`, `Note over A,B` produce a warning and are skipped entirely. The IR has no Note construct — this is Mark's domain decision (deferred). The warning text says "not in sequence IR yet (Mark's decision)."

**autonumber deferral:**
`autonumber` is a theme/rendering concern (step numbering). The IR has no flag for it. Emits DEFERRED warning, document is not corrupted.

**Auto-registration order:**
Participants auto-registered from messages use `Map` insertion order for left-to-right layout consistency. Explicit `participant`/`actor` declarations that appear before any message are inserted first. If a participant is first used in a message and later explicitly declared, the Map key already exists — the label and kind are updated in-place (preserving insertion-order position).

**ID sanitization (shared algorithm):**
Same camelCase→kebab-case, uppercase→lowercase, underscore→hyphen algorithm as flowchart.ts. Correctly handles `AuthService` → `auth-service`, `UserDB` → `user-db`, etc. The idMap is stable within a parse session.

**Test results:**
971 tests pass (57 new corpus + 914 existing; all existing goldens byte-identical). Gallery: `mermaid-sequence.svg` + `mermaid-sequence.png` emitted with bytebytego-sequence theme. The PNG (848×1010) shows dark navy background, colored ByteByteGo cards with icons for all 4 participants (User actor, Web Client, Auth Service, Database), numbered step badges 0–11, activation bars on Auth and DB, alt/loop/opt fragment boxes all correctly positioned. Looks significantly better than Mermaid's default white-background UML output.
 inspect what was skipped, deferred, or degraded.

**Corpus test approach:**
Added `test/mermaid-flowchart-corpus.test.ts` — 61 new tests organized by the 7 acceptance criteria. Covers: compact/spaced edges, all edge operator families, extended shapes with label cleanliness assertions, graceful degradation, public warning surface, all direction keywords, and all deferral categories. Also includes 9 "complete pattern" corpus tests (CI pipeline, decision flow, async pipeline, thick approval, mixed operators, all shapes, all inline labels, official Mermaid docs Christmas example, frontmatter+compact).

**Test results after hardening:**
914 tests pass (61 new corpus + 57 existing mermaid + 796 other). All existing goldens byte-identical. `mermaid-flowchart.svg` + `.png` unchanged (demo uses spaced syntax — was already correct). Build clean (TypeScript strict mode, 0 errors).

## Context: Fidelity Bar for Remaining Mermaid Parsers (Seq/Gantt/Timeline/Mindmap)

This flowchart parser hardening establishes the tokenizer and fidelity bar for all remaining Mermaid parsers. Future Inc implementations (Sequence, Gantt, Timeline, Mindmap) should follow this approach:

1. **Real-data crawl validation** — Seed acceptance criteria with a crawl of real Mermaid syntax in the wild. Validate each parser against the crawl corpus (aim: 50+ diverse patterns).

2. **Whitespace-independent parsing** — Parse both compact (`A-->B`) and spaced (`A --> B`) syntax identically. The tokenizer (scanNodeToken / scanEdgeToken) must be whitespace-agnostic; normalization happens downstream.

3. **All documented operators** — Enumerate the parser's operators from Mermaid's documentation and implement all of them (including inline label variants `|label|`). Identify and implement all shape types / styling constructs that aren't deferred.

4. **Clean label extraction** — Use regex capture groups to extract labels without shape delimiters, quotes, or parser-internal syntax. Test that `[/Para/]`, `{{Hex}}`, and other extended shapes produce clean labels in the output.

5. **Graceful degradation with warnings** — Never silently drop or mangle unsupported syntax. Return a valid (possibly partial) document and emit warnings that callers can inspect. `parseMermaidX` should return a public `warnings: string[]` field for all diagram types.

6. **Explicit deferral list** — Document all limitations (subgraphs, directives, etc.) in the parser file. Link to Inc 2+ tasks for each deferral. Callers must know what is not yet implemented.

This establishes consistency across all Mermaid diagram types and ensures user feedback is clear (warnings, not silent failures).

## 2026-06-13 — Tier 0: Mermaid sequenceDiagram Parser

### Learnings

**Arrow → kind mapping (8 operators):**
The Mermaid sequence diagram has 8 arrow operators that map to 3 IR kinds:
- `->>` (solid arrowhead) → `sync`; `-->>` (dashed arrowhead) → `reply`
- `->` (solid open) → `sync`; `-->` (dashed open) → `reply`
- `-)` (solid open circle) → `async`; `--)` (dashed open circle) → `async`
- `-x` (solid cross) → `async`; `--x` (dashed cross) → `async`

All eight are handled whitespace-independently using a single regex with alternation ordered most-specific-first (4-char `-->>` before 3-char `-->` before 2-char `->`).

**Activation shorthand `+/-` semantics:**
The `+` prefix on the TO participant activates the TO participant; the `-` prefix on the TO participant DEACTIVATES THE FROM participant (the sender who was previously activated). This is the key insight from the Mermaid docs example `Alice->>+John: Hello` / `John-->>-Alice: Great` — the `-` on Alice's position deactivates John (the FROM). The parser tracks per-participant stacks of `from_order` values; `+` pushes, `-` pops and finalizes an `Activation` entry.

**Explicit activate/deactivate timing:**
`activate A` appearing after message at order N uses `from_order = N` (the last message, which triggered A's activity). `deactivate A` appearing after message at order M uses `to_order = M`. This produces `Activation { from_order: N, to_order: M }` which is schema-valid as long as `N ≤ M`.

**Fragment sections (alt/par):**
`alt <label>` opens a multi-section fragment and simultaneously starts the first section with `guard = label`. Each `else <label>` closes the current section and opens a new one. `end` closes the last section and finalizes the fragment. The `Fragment.label` = the first alt/par label. Sections are collected as `FragmentSection[]` on the IR only when there are ≥ 2 sections (single-compartment fragments use no sections, preserving byte-identity with the existing IR format). `critical`/`break` are in the Fragment.kind enum — they pass through with a DEFERRED compat warning.

**Notes deferral:**
`Note left of A`, `Note right of A`, `Note over A,B` produce a warning and are skipped entirely. The IR has no Note construct — this is Mark's domain decision (deferred). The warning text says "not in sequence IR yet (Mark's decision)."

**autonumber deferral:**
`autonumber` is a theme/rendering concern (step numbering). The IR has no flag for it. Emits DEFERRED warning, document is not corrupted.

**Auto-registration order:**
Participants auto-registered from messages use `Map` insertion order for left-to-right layout consistency. Explicit `participant`/`actor` declarations that appear before any message are inserted first. If a participant is first used in a message and later explicitly declared, the Map key already exists — the label and kind are updated in-place (preserving insertion-order position).

**ID sanitization (shared algorithm):**
Same camelCase→kebab-case, uppercase→lowercase, underscore→hyphen algorithm as flowchart.ts. Correctly handles `AuthService` → `auth-service`, `UserDB` → `user-db`, etc. The idMap is stable within a parse session.

**Test results:**
971 tests pass (57 new corpus + 914 existing; all existing goldens byte-identical). Gallery: `mermaid-sequence.svg` + `mermaid-sequence.png` emitted with bytebytego-sequence theme. The PNG (848×1010) shows dark navy background, colored ByteByteGo cards with icons for all 4 participants (User actor, Web Client, Auth Service, Database), numbered step badges 0–11, activation bars on Auth and DB, alt/loop/opt fragment boxes all correctly positioned. Looks significantly better than Mermaid's default white-background UML output.

**Self-crawl results (6 real snippets):**
1. Basic two-party: P=2 M=2 kinds=[sync,reply] ✓
2. All 8 arrows: P=2 M=8 kinds=[sync,reply,sync,reply,async,async,async,async] ✓
3. Actor + participant with alias: P=3 M=3 kinds=[sync,sync,reply] ✓
4. Activation shorthand +/-: P=2 M=2 A=1 from_order=0 to_order=1 ✓
5. Alt with else: P=3 M=2 F=1(alt, 2 sections) ✓
6. Self-message: P=1 M=1 from===to ✓
7. Notes degrade: 2 note-warns, 1 message intact ✓
8. autonumber degrade: 1 warn, message intact ✓
9. loop+par: M=3 F=2 kinds=[loop,par] ✓
10. Frontmatter/theme: title+theme correct, AuthService→auth-service ✓


## 2026-06-13 — Tier 0 Complete: gantt + timeline + mindmap parsers

### Learnings

**gantt → IRDocument mapping:**
- Mermaid gantt task args parsed as comma-separated tokens: status keywords (`done`/`active`/`crit`/`milestone`) first, then optional raw task ID (first non-status, non-date, non-duration token), then start date, then end date or duration.
- Duration units: `d` (days), `w` (weeks × 7), `m` (calendar months), `y` (fiscal years), `h` (hours). All computed via `Date.setUTC*()` methods for determinism.
- `after <id>` dependency resolution uses two tracking maps: `taskEndByRawMermaidId` (raw Mermaid IDs → ISO end) and `sectionCursor` (section ID → last task end). Forward dependencies (not yet seen) fall back to cursor with warning.
- Sections → IR tracks + sections. Tasks without sections go to a default "Tasks" track. `done/active` → IR status; `crit` → `category: 'critical'`; `milestone` flag → IR `Milestone` not `Activity`.
- `axisFormat`, `excludes`, `todayMarker`, `click/href`, `until` → DEFERRED with warnings.
- Gallery uses `roadmap` theme, horizontal layout. IR axis_unit auto-selected from date range.

**timeline → IRDocument mapping:**
- Period lines: `<period> : <event1> : <event2>`. Continuation lines: `: <event>` (period unchanged).
- Period label → IRDate: 4-digit year → `"YYYY"` span; year-month `YYYY-MM` → span; ISO date → start+end; leading 4-digit → extract year; otherwise sequential month `2024-01`, `2024-02`, etc.
- Events → IR activities with `span: periodDate` (for year/year-month periods) or `start+end` (for ISO date periods). Period anchors → IR milestones with `label = periodLabel`.
- Sections → IR tracks (one per section). Single default track "Events" if no sections.
- Layout: `vertical-spine` (natural for a historical timeline). Theme: `consulting` default.
- `disableMulticolor` / `accTitle` / `accDescr` → DEFERRED with warnings.

**mindmap → TreeDocument indentation parsing:**
- Indentation algorithm: count leading spaces (tabs = 2 spaces). Stack tracks `{ node, indent }` pairs. Pop stack while `stack.top.indent >= current.indent`. Empty stack = root level; otherwise add to stack.top.
- Root node: first non-directive node parsed, always gets `kind: 'root'` regardless of shape (shape is cosmetic).
- `::icon(fa fa-x)` directive: strip `"fa fa-"`, `"fas fa-"`, `"far fa-"`, `"fa-"` prefix. Assign to `lastNode.icon`. Emits ICON warning (FontAwesome names may not match built-in registry).
- Node label extraction: matched in priority order: `id((label))` > `id[[label]]` > `id[label]` > `id(label)` > `id{{label}}` > `id))label((` > `id>label]` > pure shapes > `"quoted"` > bare text. HTML `<br/>` → space.
- Kind from shape: `((..))` → `'circle'`, `[[..]]` → `'database'`, `[..]` → `'rect'`, `(..)` → `'rounded'`, `{{..}}` → `'hexagon'`, `))..(( ` → `'bang'`, `>..]` → `'asymm'`. Root node always overridden to `'root'`.
- `:::className` class directives → SKIP + warning. Multiple root-level nodes → warning + attach as child.
- Gallery uses `dark-tree` theme, Buchheim–Jünger–Leipert tidy-tree layout engine.

**What degrades gracefully (all three parsers):**
- gantt: `axisFormat`, `excludes`, `todayMarker`, `click`, `until`, exotic `dateFormat` variants → DEFERRED warning.
- timeline: `disableMulticolor`, `accTitle`, `accDescr`, non-parseable period labels (sequential fallback) → warned or silently handled.
- mindmap: `:::className` → SKIP warning. `::icon()` on unrecognised names → ICON warning. Multiple roots → warning + attach as child. All parsers: unrecognised lines → SKIP warning.

**Test results:**
1083 tests pass (112 new corpus tests: 35 gantt + 38 timeline + 39 mindmap, plus 3 dispatch updates).
All 971 existing goldens byte-identical. Gallery: `mermaid-gantt.{svg,png}`, `mermaid-timeline.{svg,png}`, `mermaid-mindmap.{svg,png}` emitted. Build clean (TypeScript strict mode, 0 errors).

**Self-crawl results:**
1. gantt G1: 2 sections → 2 tracks, 4 activities with correct statuses, 1 milestone at 2014-01-25 ✓
2. gantt G2: after-dependency chain resolved correctly (des2.end→des3.start, des3.end→des4.start) ✓
3. timeline T1: 6 events across 4 year periods, all with correct span dates ✓
4. timeline T2: 2 sections → 2 tracks, events on correct tracks ✓
5. mindmap M1: root="mindmap", 3 children, icon "book" on "Long history" ✓
6. mindmap M2: shape kinds correctly extracted: rect, rounded, circle; React label clean ✓

**Gallery self-check (SVG inspection):**
- gantt: 1200×324px, 30 text elements, 20 rects — correct horizontal gantt layout
- timeline: 1200×9233px, 146 text elements — tall vertical-spine (14 programming language periods)
- mindmap: 1932×402px, 28 text elements, 29 rects — top-down tree with 4 main branches

**Tier 0 COMPLETE (2025-01-01):** All five mermaid parsers (flowchart, sequence, gantt, timeline, mindmap) integrate and render. Suite: 1083 tests (+112), 0 regressions. Commit a7f543b.
