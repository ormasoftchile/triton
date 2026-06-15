# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-15T14:55:00-04:00 (Named contract themes: terminal, pastel, mono)

---

## 2026-06-15 — Three More Named Contract Themes (terminal, pastel, mono)

### Learnings — terminal, pastel, mono (2026-06-15T14:55:00-04:00)

Built 3 additional `ThemeContract` instances, bringing the named theme total to 7.
Matrix promise re-confirmed: zero per-component work. New total: **2392/2392 tests**.

#### Themes authored

| ID | Aesthetic | Surface | Accent | Typography | Density | Fidelity |
|----|-----------|---------|--------|------------|---------|----------|
| `terminal` | Retro CRT / hacker | `#0C0C0C` near-black | `#33FF00` phosphor green | Courier New monospace | compact | 1 (zero decoration) |
| `pastel` | Soft, friendly, approachable | `#FFF8F6` warm off-white | `#8B7ED8` soft lavender | Nunito rounded sans | comfortable | 2 (gentle lavender shadow) |
| `mono` | Pure grayscale / chroma-free | `#FFFFFF` white | `#595959` mid-gray | Helvetica Neue neutral | normal | 1 (crisp, no effects) |

All three follow the `categorical[0] = accent` convention.

**terminal**: CRT palette — phosphor green primary + amber secondary (HP amber monitor family) + ANSI cyan. Monochromatic at heart; amber and cyan are the two "other" classic CRT phosphor families. Genuinely distinct from `midnight` (modern dark UI: charcoal slate, cyan, Inter, glow, comfortable) and `blueprint` (technical dark blue, cool-only palette, JetBrains Mono). Terminal lives in black-and-green machine-room space; blueprint lives in a technical drawing office.

**pastel**: Every categorical color is tinted with white — no saturated hues appear. Lavender, soft coral, sage, sky, peach, mauve. 12px corner radius is the single largest in the theme set (closest competitor is midnight at 6px) — the rounded pillbox shape is the visual fingerprint. Nunito's rounded terminals amplify this. Genuinely warm and gentle.

**mono**: Zero chroma in the entire theme — palette, accent, categorical, sequential, diverging, all role colors. The graded-gray categorical (8 distinct luminance steps) is the definitive proof that the `DataPalette` contract does not require any hue. All 21 components render deterministically with a chroma-free palette. No per-component special-casing needed.

#### Matrix promise: ZERO per-component binding changes

Adding all 3 themes required changes ONLY to:
1. `packages/core/src/theme-contract/terminal.ts` (new)
2. `packages/core/src/theme-contract/pastel.ts` (new)
3. `packages/core/src/theme-contract/mono.ts` (new)
4. `packages/core/src/theme-contract/index.ts` (register 3 new themes in `CONTRACT_THEMES`)

Zero changes to any of the 21 component bindings. The matrix now covers **7 themes × 21 components** automatically.

#### Matrix test results

`packages/core/test/contract-theme-matrix.test.ts`: now 7 themes × 21 components × assertions.
Full suite: **2392/2392 tests pass**.

#### Coherence honest verdict

**terminal**: Coherent across 6 components — all surfaces share `#0C0C0C`, phosphor green appears on every node border and chart bar, amber appears as the second data series line. The CRT palette is legible and distinctive. The Courier New monospace makes labels feel like machine output. Genuinely distinct from midnight and blueprint. Beautiful within its constraint — makes no apology for being monochromatic.

**pastel**: Coherent across 6 components — warm off-white canvas on all 6, soft lavender accent on all node borders and primary bars, the full pastel rainbow appears in the Sankey and gitgraph without any hue fighting another. The 12px radius on the flowchart nodes is the most visually distinctive shape in the entire theme set. Genuinely distinct and attractive — something you'd expect from a modern product documentation site.

**mono**: Coherent across 6 components — pure white surface on all 6, the graded-gray categorical distributes cleanly across the Sankey flows and gitgraph branches. The chroma-free data palette carries categorical distinction through luminance contrast alone. Honest verdict: readable and clean everywhere; the xychart (gray bars + near-black line on white) is the hardest test and still passes the "distinct series" legibility bar. Genuinely distinct: most restrained and neutral theme in the set.

No per-component flagging needed. No special-casing applied.

#### Files created/modified

```
packages/core/src/theme-contract/terminal.ts                (NEW — terminal theme)
packages/core/src/theme-contract/pastel.ts                  (NEW — pastel theme)
packages/core/src/theme-contract/mono.ts                    (NEW — mono theme)
packages/core/src/theme-contract/index.ts                   (modified — register 3 new themes)
packages/core/test/terminal-pastel-mono-gallery.test.ts     (NEW — 3 themes × 6 components gallery emit)
examples/gallery/terminal-{flowchart,class,xychart,sankey,gitgraph,timeline}.{svg,png}  (NEW — 12 files)
examples/gallery/pastel-{flowchart,class,xychart,sankey,gitgraph,timeline}.{svg,png}    (NEW — 12 files)
examples/gallery/mono-{flowchart,class,xychart,sankey,gitgraph,timeline}.{svg,png}      (NEW — 12 files)
examples/gallery/index.html       (modified — 3 new theme gallery sections, ex. 84–101)
.squad/decisions/inbox/barbara-themes-terminal-pastel-mono.md  (NEW)
```

---



#### Themes authored

| ID | Aesthetic | Surface | Accent | Typography | Density | Fidelity |
|----|-----------|---------|--------|------------|---------|----------|
| `midnight` | Dark dev-doc | `#0F1620` charcoal | `#00D4FF` cyan | Inter sans-serif | comfortable | 2 (glow enabled) |
| `blueprint` | Architectural/technical | `#1A2B47` deep blue | `#00BFFF` cyan | JetBrains Mono | normal | 1 (zero decoration) |
| `editorial` | Warm print/magazine | `#FAF6EF` cream | `#8B2635` burgundy | Lora serif | comfortable | 2 (ink shadow, no glow) |

All three follow the `categorical[0] = accent` convention. Each data palette harmonizes with its surface:
- midnight: vivid-on-dark (cyan, amber, emerald, violet, coral, sky)
- blueprint: strictly cool (cyans, whites, sky-blues only — no warm hues)
- editorial: warm/muted print (burgundy, forest, copper, slate, warm-brown)

#### Matrix promise: ZERO per-component binding changes

Adding all 3 themes required changes ONLY to:
1. `packages/core/src/theme-contract/midnight.ts` (new)
2. `packages/core/src/theme-contract/blueprint.ts` (new)
3. `packages/core/src/theme-contract/editorial.ts` (new)
4. `packages/core/src/theme-contract/index.ts` (register 3 new themes in `CONTRACT_THEMES`)

**Zero changes to any of the 21 component bindings.** The 12 grammar bindings
(`grammars/*/contract-binding.ts`) and the timeline binding (`themes/contract-binding.ts`)
consumed the `ThemeContract` interface without modification. This is the definitive proof
that the Tier-2 contract vocabulary is complete and general.

#### Matrix test results

`packages/core/test/contract-theme-matrix.test.ts`: 4 themes × 21 components × 2 assertions
(no-error + deterministic) = 170 test cases. All pass. New total: **2206/2206 tests**.

#### Coherence honest verdict

**midnight**: Coherent across 6 components — dark charcoal canvas, cyan accent on all node borders and
chart bars, amber as data contrast line. Vivid categorical reads clearly on dark. Genuinely distinct
from executive (opposite surface, different family, glow enabled). Beautiful: the canonical dark-mode look.

**blueprint**: Coherent across 6 components — deep-blue field, all text near-white monospace, zero
corner radius, 1.5× heavy strokes, strictly cool palette (no warm hues appear anywhere). The most
opinionated of the three. Genuinely distinct from midnight (different palette philosophy, monospace vs sans).
Beautiful: it genuinely looks like a technical drawing.

**editorial**: Coherent across 6 components — warm cream canvas, burgundy accent, warm muted data palette
(burgundy, forest, copper), Lora serif at comfortable density. Near-black `#1A1208` ink instead of
pure black — a subtle warmth that feels intentional. Genuinely distinct from executive (serif but warmer
surface, different accent, Lora vs Georgia, 0.9× lighter strokes). Beautiful: the xychart (burgundy bars +
forest line on cream) achieves the FT/Economist reference aesthetic.

One finding worth noting: `blueprint` orthogonal routing falls through to `elbow` for the current
flow binding because it doesn't distinguish `orthogonal` from `elbow`. The connector style is advisory
(§12 spec) and the result still looks clean. No fix needed, no per-component hack applied.

#### Files created/modified

```
packages/core/src/theme-contract/midnight.ts           (NEW — midnight theme)
packages/core/src/theme-contract/blueprint.ts          (NEW — blueprint theme)
packages/core/src/theme-contract/editorial.ts          (NEW — editorial theme)
packages/core/src/theme-contract/index.ts              (modified — register 3 new themes)
packages/core/test/contract-theme-matrix.test.ts       (NEW — 4×21 matrix test)
packages/core/test/named-themes-gallery.test.ts        (NEW — 3 themes × 6 components gallery emit)
examples/gallery/midnight-{flowchart,class,xychart,sankey,gitgraph,timeline}.{svg,png}  (NEW — 12 files)
examples/gallery/blueprint-{flowchart,class,xychart,sankey,gitgraph,timeline}.{svg,png} (NEW — 12 files)
examples/gallery/editorial-{flowchart,class,xychart,sankey,gitgraph,timeline}.{svg,png} (NEW — 12 files)
examples/gallery/index.html                            (modified — 3 new theme gallery sections, ex. 66–83)
.squad/decisions/inbox/barbara-named-contract-themes.md (NEW)
```

---


---

## Earlier Work (Archived)

For detailed implementation notes, see history-archive.md and dated archive files.

**2026-06-15 Work (Completed):**
- (2026-06-15T12:59:00Z) **3 named contract themes added** — midnight (dark), blueprint (technical schematic), editorial (warm print); matrix proven: 0 per-component changes required; all 21 types render deterministically; 2206 tests passing
- (2026-06-15T11:42:00Z) **Timeline section palette contract gap closed** — sectionPalette now theme-driven; fallback-default pattern; executive categorical palette → section headers/events; determinism preserved (1976/1976 tests)
- (2026-06-15T10:35:33Z) **Charts + specialized migration complete** — pie, quadrant, radar, sankey, gitGraph, journey, kanban, mindmap, packet now adopt contract; no Tier-2 vocabulary expansion needed

**2026-06-14 Work (Completed):**
- (2026-06-14T00:20:00Z) **Migration Step 1 done** — generalized timeline ResolvedTheme → Tier-2 contract; added 4 tokens (surfacePanel, inkPanel, markerShape, pattern); bindTimelineTheme proved contract complete; 1887 tests; all legacy goldens byte-identical
- (2026-06-14T23:15:00Z) **Theme contract spike succeeded** — Tier-2 general contract + executive theme + flow/sequence/chart bindings; coherence proved; opt-in wiring; 1822 tests; 3 new gallery files
- (2026-06-14T19:30:00Z) **Tier 3 long-tail grammars shipped** — block-beta, packet-beta, architecture-beta production-ready; deterministic layout; 1759 tests; all existing goldens byte-identical
- (2026-06-14) Theming architecture decided — general-contract model; §12 rewritten
- (2026-06-14T23:09:08Z) Theme vocabulary resolved; proof set = flow+sequence+xychart

For detailed notes on gantt-faithful layout, timeline-columns refactor, radar curve syntax, see history-2026-06-14-archived.md.
- (2026-06-14) Theming architecture decided — general-contract model, §12 rewritten; will implement per-component theme contract
- (2026-06-14T23:09:08Z) Theme vocabulary resolved; proof set = flow+sequence+xychart
