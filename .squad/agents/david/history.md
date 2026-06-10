# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

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
