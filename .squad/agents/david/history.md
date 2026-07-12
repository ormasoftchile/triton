# Project Context

## [ARCHIVED HISTORY]

Previously completed work:

## [SUMMARIZED RESEARCH — Full details in history-archive.md]

Earlier sessions: diagram-options reference completion, LaTeX integration analysis, layout algorithm catalog, bibliography prune.

---

### 2026-07-07 — Group B `%%` headers follow-up (central stripComments() era)

**Context:** `src/frontend/preprocess.ts` now strips full-line `%%` comments centrally before parse, making `%%` safe in every grammar family. My earlier fallback notes ("grammar does not define a `%%` comment rule") in sequence/journey/gantt/gitgraph/kanban fragments are superseded.

**Files changed:**

| File | Change |
|------|--------|
| `examples/mermaid/sequence/auth.mmd` | Added `%%` options header block after `sequenceDiagram` |
| `examples/mermaid/journey/journey.mmd` | Added `%%` options header block after `journey` |
| `examples/mermaid/gantt/gantt.mmd` | Added `%%` options header block after `gantt` |
| `examples/mermaid/gitgraph/gitgraph.mmd` | Added `%%` options header block after `gitGraph` |
| `examples/mermaid/kanban/kanban.mmd` | Added `%%` options header block after `kanban` |
| `docs/diagram-options/_fragments/sequence.md` | Removed fallback note; added `### Comments` section |
| `docs/diagram-options/_fragments/journey.md` | Removed fallback note; added `### Comments` section |
| `docs/diagram-options/_fragments/gantt.md` | Removed fallback note; added `### Comments` section |
| `docs/diagram-options/_fragments/gitgraph.md` | Removed fallback note; added `### Comments` section |
| `docs/diagram-options/_fragments/kanban.md` | Removed fallback note; added `### Comments` section |

**Verify results:** All 5 previews exit 0, each `.svg` regenerated. Note: previews must be run sequentially — parallel runs share the same dist build directory and cause race-condition import failures (pre-existing).

**Lessons:**
- Central `stripComments()` in `preprocess.ts` decouples `%%` support from individual grammar rules. When a grammar-level capability is lifted to a pre-parse step, all associated documentation fallback notes become incorrect and must be updated.
- Running `node scripts/preview.mjs` concurrently across families triggers a race condition in the shared dist build step (SyntaxError: layeredLayout export missing from class/layout.js). Always run previews serially.
## 2026-07-07 — Group B %% Headers (5 files)

Added %% options header blocks to 5 Group B Mermaid families (sequence/journey/gantt/gitgraph/kanban). Updated 5 fragments: removed fallback notes, added ### Comments sections. Serial render (parallel race in class/layout.js pre-existing).

## Learnings
- **2026-07-12:** Evaluated the `<triton-poster>` live-data concept. Concluded that building custom reactivity, templating (`{{val}}`), and expression parsing (`x > 80 ? red : green`) for SVG patching is redundant and directly reinvents the core premise of React/Svelte/Lit (`UI = f(state)` + VDOM/keys) and tools like Vega or Grafana Canvas. Recommended against building a custom reactive engine. The only viable niche is "Zero-JS, LLM-generatable system topology overlays" using native CSS custom properties for state instead of a bespoke evaluator.
