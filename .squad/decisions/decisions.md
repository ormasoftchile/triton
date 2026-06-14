# Scribe: Decisions

Decisions guide future work. Never deleted; deferred decisions remain visible.

---

## Active Decisions

### Decision: Mermaid Front-End Architecture — Tier 0 Increment 1

**Agent:** Bjarne (Ingestion Design)
**Date:** 2026-06-13T19:49:35-04:00
**Status:** ADOPTED

---

#### Summary

Implemented the Mermaid front-end (Path A of the dual front-end architecture, §15).
Tier-0 Increment-1 delivers: the front-end module layout, the `flowchart` parser, and
the public surface (`detectDiagramType`, `parseMermaid`, `renderMermaid`).
All 852 tests pass. Gallery PNG rendered with `dark-flow` theme is visibly cleaner than
Mermaid's default.

---

#### Architecture Decisions

##### 1. Three-file module layout

```
packages/core/src/frontend/mermaid/
├── utils.ts      — preprocessMermaid: frontmatter + directives + comments
├── flowchart.ts  — parseFlowchart + parseFlowchartInternal (inc direction/warnings)
└── index.ts      — detectDiagramType, parseMermaid, renderMermaid
```

**Rationale:** `utils.ts` is shared preprocessing used by both `index.ts` and
`flowchart.ts`. Splitting it avoids circular imports. `flowchart.ts` exports a
public `parseFlowchart(text): FlowDocument` and an internal
`parseFlowchartInternal(text): FlowchartParseResult` (with direction + warnings)
used by `renderMermaid`. The internal function is not re-exported from core `index.ts`.

##### 2. Preprocessing before grammar parsing

`preprocessMermaid(text)` runs before any grammar-specific parsing:
1. Strip YAML frontmatter (`--- … ---`) via the `yaml` package already in dependencies.
2. Extract `%%{init}%%` directive fields (theme/title) via JSON parse + single-quote fallback + regex fallback.
3. Drop `%% comment` lines.

**Interface contract:** Any grammar parser in this front-end receives a **clean body**
(no frontmatter, no directives, no comment lines). Frontmatter/directive metadata is
returned as structured fields (`frontmatter`, `directiveTheme`, `directiveTitle`).

##### 3. Ambiguity made explicit: ID sanitization

**Problem:** Mermaid node IDs are arbitrary tokens; the Flow IR schema requires
`^[a-z][a-z0-9-]*$`. This is a genuine ambiguity at the input boundary.

**Resolution:** A per-session `idMap: Map<string, string>` translates raw Mermaid IDs
to valid kebab-case IR IDs. The map is stable within one parse: same raw ID → same
sanitized ID. Algorithm: camelCase/PascalCase→kebab, lowercase, underscore→hyphen,
strip non-[a-z0-9-], prefix 'n' if starts with digit, collision resolution via
numeric suffix (-2, -3, …).

**Why explicit:** Mermaid diagrams commonly use single-letter IDs (`A`, `B`, `C`),
camelCase (`codePush`, `dockerBuild`), and underscores (`fail_lint`). All of these
map cleanly. Collision resolution is rarely needed in practice but is correct and
documented.

##### 4. Node creation policy

Nodes are created on first mention — either in a standalone declaration or as part of
an edge chain. First-mention label = raw ID (before sanitization); a later declaration
with an explicit shape/label UPDATES the label and kind. This mirrors Mermaid's
semantics: `A --> B` creates both A and B with default shape; `B{Decision}` later
updates B's label and kind to diamond.

##### 5. Direction mapping

| Mermaid | FlowTheme.orientation | Layout behaviour |
|---------|----------------------|-----------------|
| `LR`    | `'LR'`               | Fully implemented |
| `RL`    | `'LR'`               | Deferred: no flip |
| `TD`/`TB` | `'TB'`             | Deferred: layout renders as LR |
| `BT`    | `'TB'`               | Deferred: layout renders as LR |

Direction is passed as a `FlowTheme` orientation override to `buildFlowScene`, not
stored in the `FlowDocument` (which has no direction field). This is the correct
seam: direction is a style/layout concern, not a semantic concern.

##### 6. Theme precedence in renderMermaid

```
options.theme > frontmatter theme > %%{init}%% directive theme > 'default-flow'
```

The resolved theme name is also written back to `doc.metadata.theme` before calling
`buildFlowScene`, so the schema-validation path has a consistent view.

##### 7. Error policy

- **Syntax errors:** Skip the offending line; collect a human-readable warning.
  The parser NEVER throws on malformed input.
- **Unsupported diagram types:** `parseMermaid` and `renderMermaid` throw with a
  `[Tier 0 Inc 1]` label, naming the unsupported type and the planned increment.
- **Deferred features:** A WARNING is collected with the string "DEFERRED:" + feature
  name + planned increment. The diagram still renders (without the deferred feature).

---

#### Implemented Subset (Tier 0 Inc 1)

##### Nodes
| Mermaid syntax | IR kind        |
|----------------|----------------|
| `A[label]`     | `'rect'`       |
| `A(label)`     | `'rounded-rect'` |
| `A((label))`   | `'circle'`     |
| `A{label}`     | `'diamond'`    |
| `A([label])`   | `'stadium'`    |
| `A[[label]]`   | `'rect'`       |
| `A` (bare)     | `'rounded-rect'` |

##### Edges
| Mermaid syntax       | IR kind  | IR style  |
|----------------------|----------|-----------|
| `-->`                | `'sync'` | `'solid'` |
| `---`                | `'sync'` | `'solid'` |
| `-.->`               | `'async'`| `'dotted'`|
| `==>`                | `'sync'` | `'solid'` |
| `-->|label|`         | sync/solid + label |
| `-- label -->`       | normalised to `-->|label|` |

---

#### Deferred Features (Explicit TODO List)

1. Subgraphs (`subgraph … end`) — Inc 2
2. Class directives (`classDef`, `class`, `style`) — Inc 2
3. Click / href callbacks — Inc 2
4. Link curve styles (`linkStyle`) — Inc 2
5. Markdown-string labels (`["\`text\`"]`) — Inc 2
6. Multi-node edges (`A & B --> C`) — Inc 2
7. Extended node shapes: hexagon `{{…}}`, trapezoid `[/…/]`, asymmetric `>[…]` — Inc 2
8. Thick-edge labels (`==label==>`) — Inc 2
9. RL/BT layout flip (reverse direction in layout engine) — Inc 2 / layout engine
10. sequenceDiagram parser — Inc 2
11. gantt/timeline parser — Inc 2
12. mindmap parser — Inc 2

---

#### Files Created

```
packages/core/src/frontend/mermaid/utils.ts       (preprocessing shared utility)
packages/core/src/frontend/mermaid/flowchart.ts    (Mermaid flowchart parser)
packages/core/src/frontend/mermaid/index.ts        (front-end entry: detect/parse/render)
packages/core/test/mermaid-frontend.test.ts        (57 tests)
examples/gallery/mermaid-flowchart.mmd             (CI/CD pipeline example)
examples/gallery/mermaid-flowchart.svg             (rendered gallery output)
examples/gallery/mermaid-flowchart.png             (rendered gallery output)
```

**Modified:**
```
packages/core/src/index.ts  (added front-end exports)
```

---

#### Test Results

- **852 total tests passed** (57 new + 795 existing).
- All existing goldens byte-identical.
- Determinism: parse twice → identical JSON; render twice → identical sceneHash.
- Gallery PNG self-check: dark navy background, correct shapes (stadium/rect/diamond),
  teal curved edges, labeled edges, dotted async edge, back-edge arc.
  Visually superior to Mermaid's default (explicit project pitch criterion met).
