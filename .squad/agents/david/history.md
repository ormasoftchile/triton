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

- **2026-07-12 — Mermaid Icons/Images/Notes deep-dive:**

  **Icons — the font-vs-inline-vector distinction (critical for Triton):**
  - Mermaid has TWO icon mechanisms: (A) **font glyph** (`<i class>` in `<foreignObject>`) and (B) **inline vector** (`<path>` via Iconify `iconToHTML()`). Only B is offline/rsvg-safe.
  - `fa:fa-xxx` in flowchart labels: `replaceIconSubstring()` in `createText.ts` takes path A (webfont `<i>`) if the icon prefix is NOT registered in the Iconify store, or path B (inline SVG paths) if it IS registered. The default Mermaid install does NOT register any FA pack — so `fa:fa-xxx` **defaults to the font-dependent path**.
  - `::icon(fa ...)` in mindmap: always font-class based. No inline vector. Not rsvg-safe.
  - `@{ icon: "prefix:name" }` flowchart icon shape (v11.3.0+) and `architecture-beta` icons use `getIconSVG()` → always inline vector IF the pack is registered/bundled. Architecture built-in icons (database/server/disk/internet/cloud) are baked into the bundle — always offline-safe.
  - **`registerIconPacks()` offline pattern**: `SyncIconLoader` (pre-bundled JSON) = offline-safe + deterministic. `AsyncIconLoader` (CDN fetch) = breaks offline.
  - Iconify icon color: icons using `currentColor` in their SVG body are theme-recolorable. Logo/brand icons (logos:aws etc.) have hardcoded fills.

  **Images:**
  - `@{ img: "URL" }` flowchart image shape (v11.3.0+): uses `<image href="URL">` in SVG output. Remote URLs are NOT inlined — require network at rasterization time. `data:` URIs are the only offline-safe option. Also requires `new Image()` + `img.decode()` (DOM/Puppeteer required to get natural dimensions).

  **Comments (`%%`) — confirmed grammar-agnostic:**
  - `cleanupComments()` in `diagram-api/comments.ts` strips `^\s*%%(?!{)[^\n]+` lines before any grammar parser. Applies to ALL diagram types (confirmed: sequence, journey, gantt, gitgraph, kanban all work).
  - `%%{init:...}%%` is explicitly protected by the `(?!{)` lookahead — it is a config directive, not a comment. Processed before comment stripping.

  **Rendered notes by diagram type:**
  - sequenceDiagram: `Note [right|left] of Actor: text`, `Note over A,B: text` — `<rect>`+`<text>`, SVG-native, rsvg-safe.
  - stateDiagram-v2: `note [right|left] of State … end note` — block multi-line or inline.
  - classDiagram: `note "text"` (free-floating!) and `note for ClassName "text"` — folded-corner box. The global `note "text"` is the ONLY free-floating annotation in all of Mermaid.
  - C4: No note annotation element (the `NOTE` constant is a relation line style).
  - All other diagram types (gantt/timeline/gitGraph/mindmap/journey/kanban/ER/block/architecture): no note support.

  **Key offline-safety principle confirmed:**
  > Self-contained SVG → icons must be inlined `<path>` data, never font glyph refs or external URLs. Iconify SyncLoader + Triton's existing PathPrimitive icon registry is the right architecture.

  **Sources:** `rendering-util/icons.ts`, `rendering-util/createText.ts`, `shapes/icon.ts`, `shapes/imageSquare.ts`, `diagrams/architecture/architectureIcons.ts`, `diagram-api/comments.ts`, `preprocess.ts`, official mermaid docs for flowchart/sequence/state/class/mindmap/architecture.
