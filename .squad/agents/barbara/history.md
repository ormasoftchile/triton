# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).

---

## 2026-06-09 — Sections 5, 6, 7 (Rendering, Themes, Output Targets)

### Determinism Contract
The rendering model is a six-phase pipeline (Axis → Tracks → Activities → Milestones → Sections/Annotations → Label Collision). Each phase is a pure function of its inputs; no system state, randomness, or runtime entropy is consulted. Sort keys are: tracks by `index` asc; activities by `(start_ordinal, id)` asc; milestones by `(date_ordinal, id)` asc. Rounding is round-half-up throughout. The date→x coordinate formula uses integer arithmetic with the ordinal-day representation (epoch: 2000-01-01 = day 0) to prevent floating-point divergence across platforms.

### Key Edge-Case Rulings
- **Zero-duration**: render at `min_width` px centred at `x(start)`; never invisible.
- **Ongoing/omitted end**: bar to right canvas boundary + right-chevron; omitted `end` treated as `ongoing` (IR gap flagged).
- **TBD end**: dashed extension of `tbd_extension_px` with "TBD" label.
- **Approximate dates (~prefix)**: nominal geometry; gradient fade at approximate edge(s).
- **Outside time_range**: not rendered; renderer warning; appears in legend.
- **Partial overlap with range**: clipped; clip indicator (angled cut) on clipped edge.
- **Very short span (< min_width)**: render at `min_width` centred on logical midpoint.
- **Simultaneous milestones**: stack downward by `stack_offset_y`, sorted by `id` asc.
- **Empty track**: never collapsed; rendered at `row_height` with empty body.
- **Sub-lane cap exceeded**: excess activities go to last lane (visible overlap); warning emitted.

### IR Gaps Found (flagged for Mark + Leslie)
1. **`metadata.today` missing** — needed for `now` resolution and today-marker; blocks determinism without a fallback chain.
2. **`metadata.fiscal_year_start` missing** — `FY26-Q2` dates cannot be deterministically resolved without knowing the fiscal calendar start month.
3. **Relative date anchor undefined** — `+3m` / `-2w` need an explicit anchor; proposed: same chain as Gap 1.
4. **Omitted `end` semantics ambiguous** — rendering model rules it equals `ongoing`; IR spec should be explicit.

### Theme Schema Knobs
Complete theme schema blocks: `canvas`, `typography` (with embedded WOFF2 font files required), `axis`, `track`, `activity`, `milestone`, `annotation`, `legend`, `status_map` (all 7 statuses mandatory), `category_map` (optional; overrides fill/stroke only; pattern/opacity from status_map). Patterns vocabulary: `solid`, `diagonal-hatch` (45° lines, 4px spacing), `dashed-border` (dashed stroke). Theme inheritance: single-level via `extends`; status_map and category_map merged entry-by-entry.

### Five Built-in Themes
| Theme | Signature characteristic |
|-------|------------------------|
| Consulting | Navy + black; square bars; no gridlines; no legend; print-optimised |
| Executive | Serif headings; rounded bars; full status palette + icons; today marker |
| Product | Dense; colored track headers; category-colored; progress always shown |
| Release | Traffic-light colors; monospace; triangle milestones; bold today marker |
| Minimal | All bars dark grey; pattern-only status; no legend; greyscale-safe |

### Output Priority
1. SVG — foundation; everything derives from it
2. PNG — universal paste target; one library call on top of SVG
3. PDF — consulting/print use case; deterministic via svg2pdf/cairosvg
4. PPTX — think-cell-comparable editability via python-pptx native shapes; highest complexity
5. HTML — developer/agent preview; trivially derived from SVG

### Rendering-Validation Notes for Bjarne
An IR is unambiguously renderable if: `time_range` start/end are concrete dates; all `track` refs resolve; `track.index` values are unique; symbolic/relative dates have a `today`/`created` anchor; `progress` in [0,1]. Agents should prefer concrete ISO dates over `now` or relative dates.

## 2026-06-10 — Team Update: Design Spec & Gaps Resolved

✓ **Design Spec Sections Published (Wave 1)**
- §5 Rendering Model (determinism contract, 6-phase layout, edge-case rulings)
- §6 Theme Architecture (5 built-in themes, schema knobs)
- §7 Output Targets (SVG→PNG→PDF→PPTX→HTML priority)

✓ **IR Gaps Flagged & Resolved (Wave 2)**
Your gap reports (Gap 1, Gap 2, Gap 3, Gap 5) were critical for IR contract refinement:
- metadata.today (date anchor for determinism)
- metadata.fiscal_year_start (fiscal calendar normative)
- Omitted end semantics (= ongoing open interval)
- Relative-date anchor (same chain as now: today → created → error)

Mark's reconciliation resolved all gaps surgically — no IR redesign required.

**Design Spec Location:** `design/` (LaTeX, ready to compile)  
**Status:** All 17 IR invariants now consistent across Rendering (this), Agent Integration (Bjarne), and IR spec (Mark)

Six-phase layout order and determinism contract are normative for all renderers.

---

## 2026-06-10 — Scene/Render IR Architecture Rework (Owner Design Review)

### Driving Decision
The owner identified a fundamental architectural flaw: SVG was set as the universal root
from which all other formats derived. This capped the system's visual ceiling — rich art
effects (glow, bloom, cloud textures, soft shadows, volumetric atmospheres) were either
unavailable or non-portable. Resolution: demote SVG to one backend; introduce a
deterministic, backend-agnostic Scene/Render IR as the root.

### Scene / Render IR as Root (§5.7 + §7.1)
The six-phase layout pipeline's output is now formally named the **Scene / Render IR** —
a byte-deterministic, backend-agnostic record of all drawing primitives, resolved
coordinates, visual treatments, and effect requests. Key fields: `canvas`, `elements`
(ordered drawing primitives: Rect, Polygon, Line, Text, Path, Image, Group), `effects`
(EffectDefinition registry with fallback_policy per effect), `meta` (scene_hash, theme_id,
fidelity_tier). The Scene is the stable handoff contract between the layout engine and any
backend. Backends are pluggable; they do not feed back into the pipeline.

### Backend Capability / Fidelity-Tier Model (§7.2 + §6.5 + §6.2.10)
Four fidelity tiers defined:
- **Tier 0 Minimal**: no effects; SVG backend sufficient
- **Tier 1 Crisp**: gradients, hatch, patterns; SVG backend sufficient; fully deterministic
- **Tier 2 Polished**: drop shadows, glow; SVG safe-filter set (determinism caveat) OR Raster; PPTX native shape effects (a:glow, a:outerShdw)
- **Tier 3 Showcase**: bloom, cloud/atmosphere, noise textures, gradient meshes; Raster backend required

Six built-in themes: Minimal (Tier 0), Consulting/Release (Tier 1), Executive/Product
(Tier 2), Showcase/Keynote (Tier 3, new).

Each backend has a capability profile table (§7.5 / Table 7.4). Effects unsupported
natively use the Scene's `fallback_policy` (approximate, omit, embed-raster, error).

### Layered Determinism Contract (§5.1 item 7 + §7.1.2)
Determinism now has three distinct levels:
1. **Scene geometry** — always byte-deterministic; pure pipeline guarantee; unconditional.
2. **Per-backend output** — deterministic given pinned backend version + fixed effect
   seeds (derived from scene_hash + effect_id; no random state). Backend version is an
   explicit contract parameter, recorded in output metadata.
3. **Cross-backend pixel identity** — explicitly NOT promised and NOT required. SVG and
   Raster backends are expected to differ. This is a feature, not a defect. Cross-backend
   tests use per-backend golden images, not cross-backend pixel equality.

### PPTX Native Effects Exploitation
PowerPoint's OOXML shape model includes native glow (a:glow), shadow (a:outerShdw), and
soft-edge properties that satisfy Tier-2 effect requests without embedded rasters. The
PPTX backend exploits these natively. Tier-3 art layers (clouds, noise) fall back to
embedded PNG overlays atop the editable native-shape scaffold.

### SVG Honest Limitations (§7.3)
SVG filters exist but are non-deterministic across renderers. The spec now:
- Restricts SVG filters to a "safe filter" set at Tier 2 with an explicit determinism
  caveat comment in the SVG output
- Forbids Tier-3 effects on SVG without fallback
- Includes Table 7.2 itemising each SVG effect construct and its determinism status

### IR Gaps — None New
No new IR gaps introduced by this rework. The Timeline IR (§4) is unaffected — this is
all below the IR boundary. The `fidelity_tier` is a theme property, not an IR field.

### New Cite Keys Needed (for David)
- `skia` — Skia Graphics Library
- `webgl` — HTML Canvas / WebGL specification
- `golden-image-testing` — golden-image / snapshot testing methodology
- `ooxml` — Office Open XML ISO/IEC 29500 (PPTX native shape effects)

### Files Modified
- `design/sections/07-output-targets.tex` --- full architecture rewrite
- `design/sections/05-rendering.tex` --- determinism contract + Scene output subsection
- `design/sections/06-themes.tex` --- fidelity tier schema, Showcase theme, degradation model
- `.squad/decisions/inbox/barbara-render-backends.md` --- decision record created

---

## 2026-06-10 --- Section 14: Target Outputs Coverage Analysis

### Five Target Layout Families

Analysis of the five owner-provided reference images reveals four layout families
(including the current one):

| Family | Targets | Status in design |
|--------|---------|-----------------|
| Horizontal swimlane Gantt (current) | (baseline) | Fully implemented in §5 |
| Vertical central-spine, alternating entries | T1, T3, T5 | **Gap Render-1** -- not in §5 pipeline |
| Horizontal single-line, numbered milestones | T2 | Edge case of current pipeline; numbered-circle node shape missing |
| Serpentine/winding path | T4 | **Gap Render-3** -- fundamentally novel spine geometry; future scope |

The IR is layout-agnostic (confirmed). Layout family belongs in the theme schema as
`layout_family: { orientation, spine_geometry, entry_placement }` -- not in the IR.

### Coverage Verdict

- **IR data coverage**: All five targets are representable with current IR fields.
  Two true IR gaps flagged for Mark: milestones lack `metadata: map<string,any>`
  (Gap IR-1), and neither activities nor milestones have a direct `color: string?`
  hint field (Gap IR-2; workaround: category + category_map).
- **Layout coverage**: 1 of 5 targets (T2) maps to the current pipeline; 3 (T1, T3, T5)
  need the vertical-spine family; 1 (T4) needs the serpentine family.
- **Theme coverage**: None of the five targets is fully served by the current five themes.
  Four new themes/variants needed: dark-executive (T1/T5), light-minimal-corporate (T2),
  colorful-infographic (T3), showcase-dark child theme (T5).
- **Effect coverage**: All required effects (glow/bloom, noise texture, drop shadow) are
  already defined in the Scene effect registry and Showcase theme. No new effect types needed.

### Prioritised Additions

1. Vertical central-spine layout module (covers T1, T3, T5)
2. dark-executive and showcase-dark themes
3. Card-entry renderer + numbered-circle milestone shape
4. light-minimal-corporate and colorful-infographic themes
5. Dashed-leader-arrow annotation connector style
6. Serpentine spine geometry (post-MVP)

### Files Modified
- `design/sections/14-target-outputs.tex` -- new section created
- `design/main.tex` -- \input{sections/14-target-outputs} added after §13
- `.squad/decisions/inbox/barbara-target-outputs.md` -- decision record created

