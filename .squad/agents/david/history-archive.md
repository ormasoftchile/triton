# David — Archive of Earlier Research

Archived 2026-06-23 by Scribe. Pre-realignment research/prior-art detail (timeline-compiler era).
Append-only; never edited after write.

---

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).
- Added `json-schema2020` BibTeX entry to references.bib for Bjarne's agent-integration section (§9) cite requirement.
- Added `skia`, `webgl`, `golden-image-testing`, and `ooxml` BibTeX entries to references.bib for Barbara's render-backends rework (§5/§6/§7).

### 2026-06-10 — Build-vs-Adopt IR Survey

**Finding:** No existing format is adoptable wholesale as a Timeline IR. The recommendation is **BUILD** a bespoke IR with vocabulary borrowed from established standards.

**Two decisive gaps:**
1. Semantic gap: no existing format combines visual-communication roadmap semantics (swimlanes, visual status, milestones) with git-friendly text, LLM-generatable schema, and PPTX output.
2. Pipeline gap: no open-source tool supports a static, multi-backend render pipeline (SVG/PDF/PPTX) with a separate theme engine—every extant tool bakes rendering into the format.

**Closest candidates surveyed:**
- Markwhen (MIT): best surface-syntax fit; fails on theme separation, no stable schema, no PPTX. Not adoptable.
- Mermaid timeline (MIT): no swimlanes, no status, no PPTX. Not adoptable.
- Vega-Lite (BSD-3): best architectural analogy for WHAT/HOW separation; not a roadmap grammar. Not adoptable.
- iCalendar RFC 5545 (IETF): best vocabulary donor; wire format hostile to git/YAML/theme separation. Not adoptable.
- TaskJuggler (GPLv2): scheduling grammar, explicitly out of scope.

**Vocabulary donors identified (all borrowed into existing IR):**
- ISO 8601 → date strings (already used)
- iCalendar RFC 5545 → `start`/`end`/`label`/`description`/`category`/`tags`/`url`/`tentative`/`cancelled`
- schema.org/Event → corroborates above field names as canonical web vocabulary
- W3C OWL-Time + Allen's Algebra → open/ongoing interval semantics (`end: ongoing`), Instant/Interval duality (Milestone vs Activity)
- Vega-Lite → WHAT/HOW architectural separation as design precedent
- Pandoc AST → `version`+`metadata`+typed-entity-lists structural pattern
- Markwhen/Mermaid → surface-syntax precedents for future authoring language

**New cite keys added to references.bib:** `markwhen`, `allen1983`, `owltime`, `ical-rfc5545`, `schemaorg-event`, `taskjuggler`, `observable-plot`, `react-chrono`, `timeline-storyteller`

**Mark/Leslie flags:** No IR schema changes needed. Field names are standards-corroborated. `at-risk`, `blocked`, `span`, `progress`, `track` are original contributions with no adequate standard equivalent.

### 2026-06-09 — Research Sprint: Comparison Analysis and OSS Strategy

**Prior-art findings:**
- Mermaid's `timeline` type (graduated from beta 2023) uses section-grouped events on a year/quarter/date axis. No PPTX output. Layout is viewport-dependent and not deterministic. 88k+ GitHub stars; MIT license; $7.5M seed (2024).
- PlantUML `@startgantt` is experimental (2024): no sections, no milestones, verbose UML-centric syntax.
- vis-timeline and Frappe Gantt are browser-interactive widgets with no declarative text format and no static file export.
- MS Project XML is non-deterministic between saves (GUIDs, timestamps change); binary .mpp format is hostile to LLMs.
- think-cell is the quality benchmark (~$27/user/month, PowerPoint-locked, no text format, no agent path). Produces exactly the artefact we target.
- No existing open-source tool simultaneously achieves: presentation quality + determinism + source-control friendliness + agent-generation friendliness + PPTX output.

**Strongest differentiators identified:**
1. Only open-source, agent-generation-friendly timeline compiler with PPTX output.
2. Visual-communication grammar (not task-scheduling grammar) — intentionally excludes progress, dependencies, critical path.
3. AI-agent-first design: published JSON Schema IR + MCP tool interface = reliable structured output from LLMs.

**Real-data patterns (binding constraints for Mark/Barbara):**
- Quarter granularity dominates executive roadmaps (Q1–Q4 as primary time unit).
- Swimlane + diamond milestone is the universal executive visual idiom.
- Spans and point-events coexist; both must be first-class IR types.
- ADO `IterationPath` and GitHub Projects `DATE`/`ITERATION` fields are the dominant ingestion sources.
- Single-slide fit is a hard constraint for executive roadmaps.

**references.bib cite-key conventions:**
- Format: `<tool/author><year>` (e.g., `mermaid2023`, `vegalite2017`, `grammarofgraphics2005`).
- David is sole writer of references.bib. Other agents notify David to add entries.
- All URL-based sources use `@online` or `@misc`.
- Full cite-key table published in `.squad/decisions/inbox/david-research.md`.

**Files created this sprint:**
- `design/references.bib` — 30+ BibTeX entries covering all tools, grammars, temporal data models, agent ecosystem.
- `design/sections/10-comparison.tex` — Section 10, Comparison Analysis.
- `design/sections/12-oss-strategy.tex` — Section 12, OSS Strategy.
- `.squad/decisions/inbox/david-research.md` — binding constraints and recommendations for the team.

## 2026-06-10 — Team Update: Design Spec & Bibliography Complete

✓ **Design Spec Sections Published (Wave 1)**
- §10 Comparison (prior-art landscape)
- §12 OSS Strategy (positioning, licensing, adoption)

✓ **Bibliography Expanded (references.bib)**
- 37+ cite keys established
- Added `json-schema2020` (IETF JSON Schema draft 2020-12) per Bjarne's requirement for §9

✓ **Research Constraints & Recommendations Documented** (david-research.md)
- 8 binding constraints from real-data crawl
- 5 informing recommendations
- Prior-art coverage: Mermaid, think-cell, PlantUML, MS Project, Vega-Lite, etc.

**Design Spec Location:** `design/` (LaTeX, ready to compile)  
**Archive:** Decisions merged into `.squad/decisions.md`

Next phase: OSS launch planning and agent integration validation.

### 2026-06-12 — Research Synthesis Sprint: Four-Report Integration

**Reports synthesized:**
- `diagramcode.md` — diagram-as-code landscape (Mermaid, D2, Graphviz, PlantUML, Structurizr, Excalidraw, tldraw, yEd, GoJS, Eraser, Napkin.ai, Pikchr, Ditaa, Nomnoml, Svgbob)
- `vizgrammar.md` — visualization grammars, infographic tools, animation formats (Vega, Vega-Lite, D3, ECharts, ggplot2, Lottie, SMIL, CSS Animations, WAAPI, Motion Canvas, Manim)
- `concept-theory.md` — viz grammar theory (Wilkinson GoG, Wickham, Vega-Lite), visual communication (Bertin, Cleveland & McGill, Tufte, Gestalt, Munzner), LLM-DSL generation (Outlines, Grammar Prompting, XGrammar, GBNF, ChartGPT, NL4DV, Constraint Tax)
- `concept-layout.md` — graph drawing & layout algorithms (Sugiyama phases, Brandes-Köpf, Walker, Buchheim, Kamada-Kawai, stress majorization, Fruchterman-Reingold, Tamassia TSM, libcola/WebCola, ELK, dagre)

**Section files touched:** 52-comparison.tex, 20-grammar-concept.tex, 42-layout-engines.tex, 23-corpus-taxonomy.tex, 13-determinism.tex

**New BibTeX entries added:** 20 (references.bib: 72 → 92)
Keys: `bertin1967`, `tufte1983`, `cleveland1984`, `munzner2014`, `munzner2009`, `willard2023`, `wang2023grammar`, `dong2024xgrammar`, `llama2024gbnf`, `tian2023chartgpt`, `narechania2021nl4dv`, `ray2026constraint`, `brandesKopf2001`, `walker1990`, `buchheim2002`, `kamadaKawai1989`, `gansnerStressMaj2004`, `tamassia1987`, `webCola`, `gansner1993dot`

---

**Key findings:**

1. **Three-cluster landscape (not two):** The prior-art landscape has three clusters: (A) diagram-as-code tools (Mermaid, D2, Graphviz), (B) visualization grammars (Vega-Lite, ggplot2 — chart-only), and (C) proprietary presentation tools (think-cell, PowerPoint). The unoccupied cell is "diagram-capable + principled grammar + presentation quality + determinism."

2. **Chart/diagram gap is the core opportunity:** Vega-Lite and ggplot2 prove the architecture works (JSON IR → compiler → deterministic presentation-quality output) but are explicitly scoped to statistical graphics. No existing tool applies this pattern to diagram types.

3. **GoG principles directly applicable:** Wickham's default inference (specify only deviations), spec/render separation, and Vega-Lite's two-tier compile (spec → Vega IR → rendered output) are direct ancestors of the Domain IR → Scene IR pipeline. Munzner's nested model validates that IR design at the higher level cannot be rescued by better algorithms below.

4. **LLM-DSL: small grammar = reliability:** Willard & Louf (Outlines), Wang et al. (Grammar Prompting), and Dong et al. (XGrammar) all converge on the same finding: a small, minimal grammar fragment for the specific task is more reliable than the full schema. This validates the god-IR rejection and the goal of keeping each Domain IR semantically tight. The "constraint tax" (Ray 2026) shows this especially matters for small/on-device models.

5. **Sugiyama layout: four phases fully cited:** Phase 4 (coordinate assignment) is the Brandes-Köpf O(n) algorithm (2001), used in dagre, ELK Layered, and Graphviz dot. Phase 2 (layer assignment) uses the Gansner et al. (1993) network simplex algorithm. These are now explicitly cited in §42.

6. **Tree layout: Buchheim (2002) is state-of-the-art:** Walker (1990) has a known O(n²) bug; Buchheim et al. fixed it. D3's `d3.tree()` implements the Buchheim algorithm. This is now cited in §42.

7. **Force-directed: stress majorization is the safe alternative:** Gansner, Koren & North (2004) stress majorization with a deterministic initial placement is monotone-convergent with no randomness. This is the recommended algorithm for undirected networks where force-directed aesthetics are desired. Explicit fallback to Sugiyama for DAGs; force-directed only for exploratory use.

8. **Orthogonal layout: Tamassia (1987) TSM framework:** Bend minimisation as minimum-cost network flow on the dual graph, solvable in polynomial time. Relevant for architecture diagrams (ER, UML). ELK Layered's orthogonal routing mode implements this.

9. **Comparison/Matrix is a genuinely tabular kind:** Not a flow, not a graph. Its layout is constrained-grid assignment (column-width × row-height computation), not any graph algorithm. Must be its own grammar with its own Domain IR (cells, columns, rows, indicators).

10. **Animated-arrow pattern for Flow grammar:** `stroke-dashoffset` animation on SVG connector paths produces the "flowing" effect dominant in ByteByteGo-style explainers. This attaches as an animation hint on the Scene IR connector path — no change to static geometry.

11. **No prior art has SVG animation first-class:** Survey of all 17+ diagram-as-code tools found zero tools with a first-class SVG animation output layer. This is the most unambiguous market gap in the landscape.

---

**Constraints and recommendations for Mark (IR) and Barbara (rendering):**

- **Mark:** The Comparison grammar Domain IR needs first-class `column`, `row`, `cell`, and `indicator` (checkmark/X/stat) entity types. Do NOT model comparison as a node-link graph. The layout engine for comparison is a constrained-grid algorithm, not a Sugiyama variant.

- **Mark:** Each Domain IR's JSON Schema should be submitted as a formal grammar constraint for LLM generation (XGrammar, llama.cpp GBNF, or OpenAI Structured Outputs). This requires the schema to be machine-readable and self-contained. Keep enum lists short; keep required fields minimal.

- **Barbara:** The `stroke-dashoffset` animation for the flowing-arrow effect in Flow grammar connectors must be an explicit animation hint in the Scene IR connector primitive. The raster backend ignores it (renders the static dash pattern); the SVG backend emits a SMIL `<animate>` element or a CSS `@keyframes` rule.

- **Barbara:** Force-directed layout (when used at all) must use stress majorization with a deterministic initial layout. No random seeds in the production rendering path. Sugiyama layered (dagre/ELK) should be the default for all directed-graph cases.


**Layer A: Scene / Render IR → BUILD-but-BORROW**

No existing scene IR is adoptable wholesale. Three disqualifying gaps:
1. No surveyed format carries a typed effect registry with per-effect fallback policies.
2. No generic scene IR retains entity-type awareness needed for PPTX native-shape binding (ROUNDED_RECTANGLE vs DIAMOND).
3. None carry a fidelity_tier + scene_hash in the scene root.

Two patterns explicitly borrowed:
- **Typed-mark / display-list** (Vega scenegraph, usvg): ordered typed primitives + canvas descriptor + group nesting.
- **Multi-backend dispatch** (Matplotlib Figure/Artist): same scene tree dispatched to swappable renderers.

**Layer B: Rendering Toolchain → ADOPT / BUILD-ON per backend**

| Backend | Library | Licence | Determinism |
|---------|---------|---------|-------------|
| SVG serialiser | Write directly (XML) | — | Byte-deterministic |
| SVG→PNG rasterisation | resvg (Rust) | Apache-2/MIT | Full (platform-independent) |
| Raster/art effects | Skia (C++) | BSL-1 | Pinned version + fixed seeds |
| PDF (vector path) | svg2pdf / cairosvg | Apache-2 / MIT | Full with pinning |
| PPTX | python-pptx + pptx.oxml | MIT | Geometric only |
| HTML | Browser SVG / Node.js canvas | Open std. | Pinned version |

**Architecture validation:** Scene-graph-as-root corroborated by Vega scenegraph + usvg; Skia for raster is natural/only viable choice; golden-image testing is standard; SVG-as-backend decision confirmed.

**Flag for Barbara/Leslie:** Verify that Skia's HarfBuzz text-shaping path for label widths matches the layout pipeline's pre-computed embedded-font-metrics (§5 item 5). No change anticipated.

**New cite keys added to references.bib:** `vega-scenegraph`, `resvg`, `usvg`, `cairo`, `lottie`, `matplotlib`, `pdf-iso32000`, `png-spec`

**File modified:** `design/sections/07-output-targets.tex` — new §7.9 subsection appended.

