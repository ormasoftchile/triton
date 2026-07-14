# Triton Diagram Options Reference

This document is the single central reference for every option, keyword, and syntax construct accepted by each diagram family in Triton.
Options are grammar-derived: every entry was extracted from the family's `grammar.peggy` or parser source and verified against real examples.
Full-line `%%` comment lines are supported in **every** family — they are stripped centrally by `src/frontend/preprocess.ts` before any parser runs, so they may appear anywhere in a diagram file, including before the header keyword.
Nearly every example `.mmd` file carries an inline options-header block written as `%%` comments, making available options visible directly alongside the diagram source.

## Table of Contents

### Mermaid Diagrams

- [Flowchart](#flowchart)
- [C4](#c4)
- [Class](#class)
- [Er](#er)
- [Gantt](#gantt)
- [Gitgraph](#gitgraph)
- [Journey](#journey)
- [Kanban](#kanban)
- [Mindmap](#mindmap)
- [Pie](#pie)
- [Quadrant](#quadrant)
- [Radar](#radar)
- [Requirement](#requirement)
- [Sankey](#sankey)
- [Sequence](#sequence)
- [State](#state)
- [Timeline](#timeline)
- [Xychart](#xychart)
- [Architecture](#architecture)

### Triton Diagrams

- [Block](#block)
- [Packet](#packet)
- [Poster](#poster)
- [Topology](#topology)

### Data-Structure (DS) Diagrams

- [DS — Array](#ds--array)
- [DS — AVL Tree](#ds--avl-tree)
- [DS — B-Tree](#ds--b-tree)
- [DS — Circular Queue](#ds--circular-queue)
- [DS — Deque](#ds--deque)
- [DS — Hash Map](#ds--hash-map)
- [DS — Heap](#ds--heap)
- [DS — Linked List](#ds--linked-list)
- [DS — Matrix](#ds--matrix)
- [DS — Memory](#ds--memory)
- [DS — Node Graph](#ds--node-graph)
- [DS — Page](#ds--page)
- [DS — Plan](#ds--plan)
- [DS — Priority Queue](#ds--priority-queue)
- [DS — Queue](#ds--queue)
- [DS — Radix Tree](#ds--radix-tree)
- [DS — Red-Black Tree](#ds--red-black-tree)
- [DS — Segment Tree](#ds--segment-tree)
- [DS — Stack](#ds--stack)
- [DS — Tree](#ds--tree)
- [DS — Trie](#ds--trie)
- [DS — Union-Find (DSU)](#ds--union-find-dsu)


---

## Mermaid Diagrams



---

## Flowchart

Generic directed/undirected graph with layered layout, node shapes, and edge styles.
Supports subgraphs, overlays (notes, legends), and optional YAML frontmatter.

**Header keyword(s):** `flowchart` · `graph`

---

### Directions

| Token | Meaning        |
|-------|----------------|
| `TD`  | Top → Down     |
| `TB`  | Top → Bottom (identical to TD) |
| `BT`  | Bottom → Top   |
| `LR`  | Left → Right   |
| `RL`  | Right → Left   |

---

### Node shapes

| Syntax           | Shape             |
|------------------|-------------------|
| `id[Label]`      | Rectangle (default) |
| `id(Label)`      | Rounded rectangle |
| `id((Label))`    | Circle            |
| `id([Label])`    | Stadium (pill)    |
| `id[[Label]]`    | Subroutine (double-bracket) |
| `id[(Label)]`    | Cylinder          |
| `id{{Label}}`    | Hexagon           |
| `id{Label}`      | Diamond           |
| `id[/Label/]`    | Parallelogram     |
| `id[\Label\]`    | Parallelogram (alt, reversed slant) |
| `id>Label]`      | Asymmetric (flag/arrow) |

---

### Edge types

| Operator   | Kind  | Style  | Notes                    |
|------------|-------|--------|--------------------------|
| `-->`      | sync  | solid  | Arrow (most common)      |
| `---`      | sync  | solid  | Line, no arrowhead       |
| `--->`     | sync  | solid  | Long arrow               |
| `==>`      | sync  | solid  | Thick arrow              |
| `===`      | sync  | solid  | Thick line               |
| `-.->`     | async | dotted | Dashed arrow             |
| `-..->`    | async | dotted | Dashed arrow (long)      |
| `<-->`     | sync  | solid  | Bidirectional            |
| `<.->`  / `<.->` | async | dotted | Bidirectional dotted |
| `--x`      | sync  | solid  | Cross terminus           |
| `--o`      | sync  | solid  | Circle terminus          |

**Edge labels:** append `|label text|` after the operator — e.g. `-->|yes|`.

**Chains:** `A --> B --> C` expands to two edges; mix operators: `A --> B -.-> C`.

---

### Block keywords

| Keyword                          | Purpose                          |
|----------------------------------|----------------------------------|
| `subgraph id [Label]` … `end`   | Cluster nodes into a named group |

---

### Directives (captured, not interpreted by Triton layout)

| Keyword     | Syntax                        |
|-------------|-------------------------------|
| `style`     | `style id fill:#fff,…`        |
| `classDef`  | `classDef name fill:#fff,…`   |
| `class`     | `class id1,id2 name`          |
| `click`     | `click id callback`           |

---

### Overlays

| Keyword  | Syntax |
|----------|--------|
| `note`   | `note "text" at id` · optional `offset dx, dy` |
| `legend` | `legend top-left "Title"` / key: value lines / `end` |

Legend corners: `top-left` · `top-right` · `bottom-left` · `bottom-right`

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
author: Leslie
---
flowchart LR
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
flowchart LR
  A[Start] --> B{Decision}
  B -->|yes| C([Done])
  B -->|no|  D(Retry)
  D --> A
```


---

## C4

Mermaid-compatible C4 architecture diagram: Person/System/Container/Component nodes inside nested boundaries, connected by directed or bidirectional relationships.

**Header keyword(s):** `C4Context` · `C4Container` · `C4Component` · `C4Dynamic` · `C4Deployment`

---

### Node kinds

| Keyword          | IR kind        | Description                        |
|------------------|----------------|------------------------------------|
| `Person`         | `person`       | Internal person / actor            |
| `Person_Ext`     | `person_ext`   | External person / actor            |
| `System`         | `system`       | Internal software system           |
| `System_Ext`     | `system_ext`   | External software system           |
| `SystemDb`       | `db`           | Internal database system           |
| `Container`      | `container`    | Internal container                 |
| `ContainerDb`    | `db`           | Internal database container        |
| `Container_Ext`  | `container_ext`| External container                 |
| `Component`      | `component`    | Internal component                 |

Node declaration syntax: `NodeKind(id, "label")` · `NodeKind(id, "label", "descr")`.

---

### Relationship types

| Keyword    | `ext` flag | Meaning                       |
|------------|------------|-------------------------------|
| `Rel`      | false      | Directed relationship         |
| `Rel_Ext`  | true       | Directed external relationship|
| `BiRel`    | false      | Bidirectional relationship    |

Relation syntax: `Rel(from, to, "label")` · `Rel(from, to, "label", "tech")`.

---

### Block keywords (boundaries)

| Keyword               | Syntax                                        |
|-----------------------|-----------------------------------------------|
| `Enterprise_Boundary` | `Enterprise_Boundary(id, "label") { … }`     |
| `System_Boundary`     | `System_Boundary(id, "label") { … }`         |
| `Container_Boundary`  | `Container_Boundary(id, "label") { … }`      |
| `Boundary`            | `Boundary(id, "label") { … }`                |

Boundaries may be nested. Inner node ids are flattened into the boundary's `nodeIds` list.

---

### Config keywords

| Keyword | Syntax       | Notes                               |
|---------|--------------|-------------------------------------|
| `title` | `title text` | Sets diagram title in metadata      |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
C4Context
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
C4Context
  title System Context
  Person(user, "User", "A system user.")
  System(app, "App", "The application.")
  System_Ext(ext, "External API")
  Rel(user, app, "Uses")
  Rel(app, ext, "Calls", "HTTPS")
```


---

## Class

Mermaid-compatible class diagram: class blocks with typed members, stereotypes, and relationships with cardinality and labels.

**Header keyword(s):** `classDiagram` · `classDiagram-v2`

---

### Relationship types

| Token   | Left head | Right head | Line   |
|---------|-----------|------------|--------|
| `<|--`  | triangle  | none       | solid  |
| `--|>`  | none      | triangle   | solid  |
| `<|..`  | triangle  | none       | dashed |
| `..|>`  | none      | triangle   | dashed |
| `*--`   | diamondF  | none       | solid  |
| `--*`   | none      | diamondF   | solid  |
| `o--`   | diamondO  | none       | solid  |
| `--o`   | none      | diamondO   | solid  |
| `<--`   | arrow     | none       | solid  |
| `-->`   | none      | arrow      | solid  |
| `<..`   | arrow     | none       | dashed |
| `..>`   | none      | arrow      | dashed |
| `--`    | none      | none       | solid  |
| `..`    | none      | none       | dashed |

**Cardinality:** quoted string on either side of the relation token — e.g., `"1"` · `"*"` · `"0..1"`.

**Relation label:** ` : label` appended after the right class name.

---

### Class body syntax

| Syntax               | Meaning                                       |
|----------------------|-----------------------------------------------|
| `class Name { … }`  | Class block with inline member rows           |
| `Name : memberText`  | Standalone member line outside a block        |
| `<<stereotype>>`     | Stereotype annotation inside a class block    |

Members whose text contains `(` are parsed as methods; all others are parsed as attributes.

---

### Config keywords

| Keyword | Syntax      | Notes                         |
|---------|-------------|-------------------------------|
| `note`  | `note text` | Accepted by parser; discarded |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
classDiagram
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
classDiagram
  class Animal {
    +String name
    +move() void
  }
  class Dog {
    +bark() void
  }
  Animal <|-- Dog : extends
  Animal "1" --o "*" Dog : owns
```


---

## Er

Mermaid-compatible entity-relationship diagram: entity blocks with typed attributes and key constraints, connected by crow's-foot relationships.

**Header keyword(s):** `erDiagram`

---

### Relationship types (crow's-foot notation)

Relationship token format: `<left-card><line><right-card>` — e.g., `||--o{`.

| Side token | Cardinality meaning |
|------------|---------------------|
| `\|\|`     | Exactly one         |
| `\|o`      | Zero or one         |
| `\|{`      | One or more         |
| `}o`       | Zero or more        |

**Line style:** `--` (solid / identifying) · `..` (dashed / non-identifying)

**Relation label:** required; quoted (`"label"`) or bare text — e.g., `ENTITY ||--o{ OTHER : places`.

---

### Attribute keys

| Keyword | Meaning       |
|---------|---------------|
| `PK`    | Primary key   |
| `FK`    | Foreign key   |
| `UK`    | Unique key    |

Attribute row syntax inside an entity block: `type name [PK|FK|UK]` — e.g., `string id PK`.

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
erDiagram
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string id PK
    string name
  }
  ORDER {
    int id PK
    string status
  }
```


---

## Gantt

Horizontal bar chart for project schedules with sections, task statuses, `after` dependencies, and critical-path markers.

**Header keyword(s):** `gantt`

---

### Config keywords

| Keyword        | Syntax                  | Behaviour                                   |
|----------------|-------------------------|---------------------------------------------|
| `title`        | `title My Title`        | Chart title                                 |
| `dateFormat`   | `dateFormat YYYY-MM-DD` | Input date format used by the resolver      |
| `excludes`     | `excludes weekends`     | Parsed; not rendered by Triton              |
| `axisFormat`   | `axisFormat %m/%d`      | Parsed; not rendered by Triton              |
| `todayMarker`  | `todayMarker off`       | Parsed; not rendered by Triton              |
| `tickInterval` | `tickInterval 1week`    | Parsed; not rendered by Triton              |

---

### Block keywords

| Syntax          | Purpose                        |
|-----------------|--------------------------------|
| `section Label` | Groups tasks into a named band |

---

### Entry / Event syntax

Task lines use `name : meta` where `meta` is a comma-separated list of tokens resolved by `index.ts`:

| Meta token          | Meaning                              |
|---------------------|--------------------------------------|
| `done`              | Task is complete                     |
| `active`            | Task is in progress                  |
| `crit`              | Mark as critical-path                |
| `milestone`         | Zero-duration milestone marker       |
| `id`                | Unique task identifier               |
| `YYYY-MM-DD`        | Absolute start date                  |
| `after id`          | Start after the named task ends      |
| `Nd` · `Nw` · `Nh` | Duration in days · weeks · hours     |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Gantt
theme: roadmap
---
gantt
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
gantt
  title Project Roadmap
  dateFormat YYYY-MM-DD
  section Phase 1
    Planning : done, p1, 2025-01-01, 14d
    Design   : active, p2, after p1, 14d
  section Phase 2
    Build    : p3, after p2, 30d
    Release  : crit, milestone, 2025-04-15, 0d
```


---

## Gitgraph

Git-history branching diagram with commit, branch, checkout, and merge operations.

**Header keyword(s):** `gitGraph`

---

### Statements

| Syntax                           | Purpose                            |
|----------------------------------|------------------------------------|
| `commit`                         | Add a commit to the current branch |
| `branch name`                    | Create a new branch                |
| `checkout name` · `switch name`  | Move HEAD to a named branch        |
| `merge name`                     | Merge named branch into HEAD       |

---

### Commit / Merge options

Appended as `key: value` pairs after the keyword; all are optional:

| Option | Syntax         | Value format                         |
|--------|----------------|--------------------------------------|
| `id`   | `id: "hash"`   | Quoted string                        |
| `tag`  | `tag: "v1.0"`  | Quoted string                        |
| `type` | `type: NORMAL` | Unquoted identifier or quoted string |

---

### Branch options

| Syntax     | Effect                                                      |
|------------|-------------------------------------------------------------|
| `order: N` | Integer render-order hint (parsed; value not stored in IR)  |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
gitGraph
  commit
  branch feature
  checkout feature
  commit id: "feat-1" tag: "v0.1"
  checkout main
  merge feature tag: "v1.0"
```


---

## Journey

User-journey diagram mapping tasks to satisfaction scores and named actors, grouped into named phases.

**Header keyword(s):** `journey`

---

### Config keywords

| Keyword | Syntax           |
|---------|------------------|
| `title` | `title My Title` |

---

### Block keywords

| Syntax          | Purpose                         |
|-----------------|---------------------------------|
| `section Label` | Groups tasks into a named phase |

---

### Entry / Event syntax

| Syntax                                 | Description                              |
|----------------------------------------|------------------------------------------|
| `Task label : score : Actor1, Actor2`  | Task with satisfaction score and actors  |

**Score:** numeric value (integer or decimal; grammar permits negative values).

**Actors:** comma-separated list of actor names; multiple actors may share one task.

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
journey
  title E-commerce Customer Journey
  section Discovery
    Search online: 4: Customer, Analytics
    Read reviews:  3: Customer
  section Purchase
    Add to cart: 5: Customer
    Checkout:    4: Customer, Payment
```


---

## Kanban

Work-item board with named columns and optionally-identified cards.

**Header keyword(s):** `kanban`

---

### Block keywords

| Syntax                          | Purpose              |
|---------------------------------|----------------------|
| Column label (unindented line)  | Declares a new column|

---

### Card syntax

| Syntax          | Description                      |
|-----------------|----------------------------------|
| `id[Card text]` | Card with an explicit identifier |
| `[Card text]`   | Anonymous card (no identifier)   |

Cards are indented beneath their column header. Identifier characters: `[a-zA-Z0-9_-]`.

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
kanban
  Todo
    t1[Design API endpoints]
    t2[Write specs]
  In Progress
    t3[Build auth service]
  Done
    t4[Project kickoff]
```


---

## Mindmap

Hierarchical radial tree where indentation depth defines parent-child relationships.

**Header keyword(s):** `mindmap`

---

### Node shapes

| Syntax      | Shape             |
|-------------|-------------------|
| `((text))`  | Circle            |
| `(text)`    | Rounded rectangle |
| `[text]`    | Rectangle         |
| `{{text}}`  | Hexagon           |

---

### Directives

| Syntax           | Notes                                                |
|------------------|------------------------------------------------------|
| `::icon(name)`   | Attaches an icon to the preceding node; one per node |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Mindmap
theme: dark-tree
---
mindmap
```

---

### Comments

Lines starting with `%%` are stripped before parsing (indentation of real nodes is unaffected):
```
%% This is a comment
```

---

### Minimal snippet

```
mindmap
  root((Central Topic))
    Branch One
      Leaf A
      Leaf B
    Branch Two
      Leaf C
```


---

## Pie

Proportional arc chart where slices are sized by numeric value.

**Header keyword(s):** `pie`

---

### Config keywords

| Keyword    | Syntax                       | Notes                                          |
|------------|------------------------------|------------------------------------------------|
| `showData` | `pie showData …`             | Optional flag; placed before `title` if used  |
| `title`    | `pie … title <text>`         | Optional; plain text to end of header line     |

---

### Slice syntax

| Syntax              | Notes                                    |
|---------------------|------------------------------------------|
| `"Label" : <num>`   | Quoted label; value is a decimal number  |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
pie showData title Language Popularity
  "Python" : 28.5
  "JavaScript" : 22.3
  "Other" : 49.2
```


---

## Quadrant

Two-axis scatter chart divided into four labelled quadrant regions.

**Header keyword(s):** `quadrantChart`

---

### Config keywords

| Keyword      | Syntax                          | Notes                              |
|--------------|---------------------------------|------------------------------------|
| `title`      | `title <text>`                  | Plain text; rest of line           |
| `x-axis`     | `x-axis <left> --> <right>`     | Left and right end labels          |
| `y-axis`     | `y-axis <bottom> --> <top>`     | Bottom and top end labels          |
| `quadrant-1` | `quadrant-1 <label>`            | Top-right quadrant label           |
| `quadrant-2` | `quadrant-2 <label>`            | Top-left quadrant label            |
| `quadrant-3` | `quadrant-3 <label>`            | Bottom-left quadrant label         |
| `quadrant-4` | `quadrant-4 <label>`            | Bottom-right quadrant label        |

---

### Point syntax

| Syntax            | Notes                                            |
|-------------------|--------------------------------------------------|
| `Label: [x, y]`   | x and y are decimals in the range 0.0 – 1.0     |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
quadrantChart
  title Reach vs Engagement
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  quadrant-1 Expand
  quadrant-2 Promote
  quadrant-3 Re-evaluate
  quadrant-4 Needs Attention
  Viral Video: [0.81, 0.87]
  Blog Post: [0.24, 0.68]
```


---

## Radar

Spider/radar chart plotting one or more datasets across named axes on a radial scale.

**Header keyword(s):** `radar-beta`

---

### Config keywords

| Keyword | Syntax         | Notes                        |
|---------|----------------|------------------------------|
| `title` | `title <text>` | Plain text; rest of line     |
| `max`   | `max <num>`    | Numeric upper bound of scale |
| `min`   | `min <num>`    | Numeric lower bound of scale |

---

### Axis definition

| Syntax                | Notes                                         |
|-----------------------|-----------------------------------------------|
| `axis id["Label"], …` | Comma-separated list; display label optional  |
| `axis id, …`          | Short form — id doubles as the display label  |

---

### Curve (dataset) definition

| Syntax                        | Notes                                                      |
|-------------------------------|------------------------------------------------------------|
| `curve id["Label"]{v, v, …}`  | Named dataset; values must match axis count in order       |
| `curve id{v, v, …}`           | Short form — id doubles as the display label               |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
radar-beta
title Team Skills
axis sp["Speed"], rl["Reliability"], cm["Communication"]
curve team["Our Team"]{8, 9, 7}
max 10
min 0
```


---

## Requirement

Mermaid-compatible requirement diagram: requirement and element blocks with key/value fields, connected by typed relationships.

**Header keyword(s):** `requirementDiagram`

---

### Block kinds

| Keyword                    | Meaning                                |
|----------------------------|----------------------------------------|
| `requirement`              | Generic requirement                    |
| `functionalRequirement`    | Functional requirement                 |
| `interfaceRequirement`     | Interface requirement                  |
| `performanceRequirement`   | Performance requirement                |
| `physicalRequirement`      | Physical requirement                   |
| `designConstraint`         | Design constraint                      |
| `element`                  | System element (implementation entity) |

Keywords are case-insensitive. Block syntax: `kind Name { key: value … }`.

---

### Relationship syntax

```
from - type -> to
```

`type` is an unconstrained identifier. Conventional types documented in the IR source:
`satisfies` · `contains` · `refines` · `derives`

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
requirementDiagram

requirement UserAuth {
  id: REQ-001
  text: The system shall authenticate users.
  risk: high
  verifymethod: test
}

element AuthService {
  type: microservice
}

AuthService - satisfies -> UserAuth
```


---

## Sankey

Flow diagram representing quantities transferred between nodes as proportional-width bands.

**Header keyword(s):** `sankey-beta`

---

### Link syntax

| Syntax                 | Notes                                              |
|------------------------|----------------------------------------------------|
| `Source,Target,Value`  | One CSV row per directed link; names may contain spaces |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
sankey-beta
Coal,Electricity Generation,4200
Natural Gas,Electricity Generation,3100
Electricity Generation,Industry,3600
```


---

## Sequence

Chronological message-passing diagram between named participants (or actors), with activation lifebars, fragment blocks, and overlay notes.

**Header keyword(s):** `sequenceDiagram`

---

### Participants

| Syntax                      | Kind                |
|-----------------------------|---------------------|
| `participant id`            | Box (auto-labelled) |
| `participant id as Label`   | Box (aliased)       |
| `actor id as Label`         | Stick figure        |

---

### Message arrows

| Operator | Line   | Head  |
|----------|--------|-------|
| `->>`    | solid  | Arrow |
| `-->>`   | dashed | Arrow |
| `->`     | solid  | Open  |
| `-->`    | dashed | Open  |
| `-x`     | solid  | Cross |
| `--x`    | dashed | Cross |
| `-)`     | solid  | Async |
| `--)`    | dashed | Async |

**Activation suffix (inline, appended after arrow):** `+` activate target · `-` deactivate source

---

### Overlays

| Syntax                        | Placement      |
|-------------------------------|----------------|
| `Note over id1, id2 : text`   | Spans both     |
| `Note left of id : text`      | Left side      |
| `Note right of id : text`     | Right side     |

---

### Fragment blocks

| Keyword    | Separator | Purpose                      |
|------------|-----------|------------------------------|
| `alt`      | `else`    | Conditional alternatives     |
| `opt`      |           | Optional block               |
| `loop`     |           | Repeated sequence            |
| `par`      | `and`     | Parallel threads             |
| `critical` |           | Critical region              |
| `break`    |           | Break / abort flow           |

All fragment blocks close with `end`.

---

### Config keywords

| Keyword      | Syntax       | Effect                           |
|--------------|--------------|----------------------------------|
| `autonumber` | `autonumber` | Auto-number each message         |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
theme: default
---
sequenceDiagram
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
sequenceDiagram
  participant A as Alice
  participant B as Bob
  A->>+B: Hello
  B-->>-A: Hi back
  Note over A,B: Greeting complete
```


---

## State

Mermaid-compatible state diagram: states, transitions with optional labels, composite states, and choice/fork/join pseudo-states.

**Header keyword(s):** `stateDiagram` · `stateDiagram-v2`

---

### Transitions

| Syntax                          | Meaning                                  |
|---------------------------------|------------------------------------------|
| `StateA --> StateB`             | Unlabelled transition                    |
| `StateA --> StateB : label`     | Labelled transition                      |
| `[*] --> StateA`                | Entry from start pseudo-state            |
| `StateA --> [*]`                | Exit to end pseudo-state                 |

`[*]` maps to the start pseudo-state when used as source and end pseudo-state when used as target.

---

### Block keywords

| Syntax                    | Meaning                                  |
|---------------------------|------------------------------------------|
| `state Name { … }`       | Composite state (inner statements promoted) |

---

### Special state declarations

| Syntax                     | Kind produced |
|----------------------------|---------------|
| `state id <<choice>>`      | Choice node   |
| `state id <<fork>>`        | Fork node     |
| `state id <<join>>`        | Join node     |
| `state "label" as id`      | Aliased state with display label |
| `state id`                 | State declaration (label = id)   |

---

### Config keywords

| Keyword     | Syntax              | Notes                              |
|-------------|---------------------|------------------------------------|
| `direction` | `direction LR`      | Accepted by parser; ignored by Triton layout |
| `note`      | `note text`         | Accepted by parser; discarded      |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
stateDiagram-v2
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start
  Running --> Idle : stop
  Running --> [*] : done
  state Running {
    [*] --> Busy
    Busy --> [*]
  }
```


---

## Timeline

Horizontal (or custom-layout) timeline with sections, dated activity entries, range spans, milestones, status annotations, and overlays. Supports Triton extension directives.

**Header keyword(s):** `timeline`

---

### Config keywords

| Keyword    | Layer | Syntax              |
|------------|-------|---------------------|
| `title`    | L1    | `title My Title`    |
| `subtitle` | L1    | `subtitle Subtitle` |
| `theme`    | L1    | `theme name`        |
| `layout`   | L2    | `layout value`      |
| `axisUnit` | L2    | `axisUnit value`    |

L1 = Mermaid-compatible; L2 = Triton extension (requires `extensions !== false`).

---

### Block keywords

| Syntax          | Purpose                          |
|-----------------|----------------------------------|
| `section Label` | Groups entries into a named span |

---

### Entry / Event syntax

| Syntax                                         | Kind                   |
|------------------------------------------------|------------------------|
| `date : Event text`                            | Point activity (L1)    |
| `start -- end : Label`                         | Range activity (L2)    |
| `start -- end : Label : status`                | Range with status (L2) |
| `start -- end : Label : status @track \| desc` | Full range form (L2)   |
| `date : Label : active\|done\|blocked`         | Annotated point (L2)   |
| `date : Label : milestone`                     | Milestone (L2)         |

**Status values:** `active` · `done` · `blocked` · `default`

**Track assignment:** `@trackId` — groups entries into a named swim-lane.

**Inline description:** `| description text` — appended after optional track assignment.

---

### Overlays

| Keyword  | Syntax                                               |
|----------|------------------------------------------------------|
| `note`   | `note "text" at target` · optional `offset dx, dy`  |
| `legend` | `legend corner "Title"` / `key: value` lines / `end`|

Legend corners: `top-left` · `top-right` · `bottom-left` · `bottom-right`

---

### Frontmatter

Optional YAML block before the header (Triton extension):
```
---
title: My Timeline
author: Team
---
timeline
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

> **Grammar constraint:** `%%` comment lines are only valid inside the `Body` section — i.e., after all directive lines (`title`, `subtitle`, `theme`, `layout`, `axisUnit`). Placing `%%` comments between the `timeline` keyword and the directives causes a parse error.

---

### Minimal snippet

```
timeline
  title 2025 Milestones
  section Q1
    2025-01-15 : Kickoff
    2025-03-01 : Alpha release
  section Q2
    2025-06-01 : Beta launch
```


---

## Xychart

Categorical-x, numeric-y chart supporting bar and line series on a shared axis pair.

**Header keyword(s):** `xychart-beta`

---

### Directions

| Token        | Meaning                   |
|--------------|---------------------------|
| `horizontal` | Horizontal layout         |
| `vertical`   | Vertical layout (default) |

---

### Config keywords

| Keyword  | Syntax                          | Notes                                  |
|----------|---------------------------------|----------------------------------------|
| `title`  | `title "text"` · `title text`   | Quoted or plain; one per chart         |
| `x-axis` | `x-axis [cat, cat, …]`          | Categorical labels in square brackets  |
| `y-axis` | `y-axis "label" min --> max`    | Optional quoted label; optional range  |

---

### Series types

| Keyword | Syntax           | Notes                                         |
|---------|------------------|-----------------------------------------------|
| `bar`   | `bar [v, v, …]`  | Bar series; one value per x-axis category     |
| `line`  | `line [v, v, …]` | Line series; one value per x-axis category    |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
xychart-beta
  title "Monthly Revenue"
  x-axis [Jan, Feb, Mar]
  y-axis "Revenue" 0 --> 6000
  bar [1800, 2600, 3400]
  line [2000, 2500, 3000]
```


---

## Triton Diagrams



---

## Architecture

Arranges services and named groups with port-anchored edges for infrastructure and system-context diagrams.

**Header keyword(s):** `architecture-beta`

---

### Block keywords

| Keyword   | Syntax                                                          | Purpose                                               |
|-----------|-----------------------------------------------------------------|-------------------------------------------------------|
| `group`   | `group <id>(<icon>)[<label>]`                                   | Named container; child services cluster inside it     |
| `service` | `service <id>(<icon>)[<label>]`                                 | Node with icon; placed at top level                   |
| `service` | `service <id>(<icon>)[<label>] in <group>`                      | Node with explicit group membership                   |

Services may also be indented under a `group` line (indent-based membership).

---

### Edge types

| Operator | Kind          |
|----------|---------------|
| `-->`    | Directed      |
| `--`     | Undirected    |
| `<-->`   | Bidirectional |

**Edge syntax:** `<from>:<side> <operator> <side>:<to>`

---

### Port sides

| Token | Side   |
|-------|--------|
| `L`   | Left   |
| `R`   | Right  |
| `T`   | Top    |
| `B`   | Bottom |

Lowercase variants (`l`, `r`, `t`, `b`) are also accepted.

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
architecture-beta
  group cloud(cloud)[Cloud]
    service api(server)[API Server]
    service db(database)[Database]
  service client(internet)[Client]
  client:R --> L:api
  api:R --> L:db
```


---

## Block

Arranges blocks in a responsive column grid with optional column spans and directed edges.

**Header keyword(s):** `block-beta`

---

### Config keywords

| Keyword   | Syntax        | Purpose                           |
|-----------|---------------|-----------------------------------|
| `columns` | `columns <N>` | Set the grid column count (default 1) |

---

### Block definitions

| Syntax             | Meaning                                              |
|--------------------|------------------------------------------------------|
| `id["Label"]`      | Block with label; bare identifiers also accepted     |
| `id["Label"]:<N>`  | Block spanning N columns                             |

Multiple block definitions may appear on the same line, separated by spaces.

---

### Edge types

| Syntax                        | Meaning                                  |
|-------------------------------|------------------------------------------|
| `<from> --> <to>`             | Directed arrow                           |
| `<from> --> \|<label>\| <to>` | Directed arrow with inline label         |

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
block-beta
  columns 3
  A["Frontend"]
  B["API Layer"]:2
  C["Auth"] D["Database"]:2
  A --> B
  B --> D
```


---

## Packet

Renders bit-level protocol field maps as annotated bit-range diagrams.

**Header keyword(s):** `packet-beta`

---

### Config keywords

| Keyword | Syntax          | Purpose                                   |
|---------|-----------------|-------------------------------------------|
| `title` | `title <text>`  | Diagram title displayed above the packet map |

---

### Entry / Event syntax

| Syntax                      | Meaning                                          |
|-----------------------------|--------------------------------------------------|
| `<bit>: "Label"`            | Single-bit field at position `<bit>`             |
| `<start>-<end>: "Label"`    | Multi-bit field covering bits `start` through `end` |

Labels may be quoted with `"` or given as an unquoted bare string.

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
packet-beta
title TCP Segment Header
0-3: "Data Offset"
10: "URG"
16-31: "Window Size"
32-47: "Checksum"
```


---

## Poster

Composes multiple diagrams, stats, and text blocks into a multi-column grid layout.

**Header keyword(s):** `poster`

Optional title: `poster "Dashboard Title"`

---

### Config keywords

| Keyword   | Syntax        | Purpose                              |
|-----------|---------------|--------------------------------------|
| `columns` | `columns <N>` | Number of grid columns (default 2)   |
| `rows`    | `rows <N>`    | Number of grid rows                  |
| `gap`     | `gap <N>`     | Gap between cells                    |

---

### Block keywords

| Keyword | Syntax                                                                          | Purpose                                            |
|---------|---------------------------------------------------------------------------------|----------------------------------------------------|
| `cell`  | `cell [id] ["Title"] [span] [:: kind] [@theme name]` … `end`                   | Grid cell containing a sub-diagram or text content |
| `link`  | `link <from.node> <arrow> <to.node> ["label"] [@routing] [{props}]`            | Cross-cell link overlay                            |
| `trace` | `trace "name" [: type] [color "hex"] <from.n> --> <to.n>`                      | Semantic trace path across cell boundaries         |

---

### Cell spans

| Syntax  | Meaning                          |
|---------|----------------------------------|
| `[N]`   | Span N columns, 1 row            |
| `[NxM]` | Span N columns × M rows          |

---

### Cell kinds

| Kind                              | Content                                   |
|-----------------------------------|-------------------------------------------|
| `flowchart` · `flow`              | Flowchart sub-diagram                     |
| `timeline`                        | Timeline sub-diagram                      |
| `stat`                            | Stat block: `value \| label`              |
| `text`                            | Plain text block                          |
| any identifier                    | Custom or `ds` sub-diagram kind           |

---

### Link arrows

| Operator  | Direction     | Style  |
|-----------|---------------|--------|
| `-->`     | directed      | solid  |
| `-.->`    | directed      | dashed |
| `..>`     | directed      | dotted |
| `<-->`    | bidirectional | solid  |
| `<-.->`   | bidirectional | dashed |
| `<..>`    | bidirectional | dotted |
| `---`     | undirected    | solid  |
| `-.-`     | undirected    | dashed |
| `...`     | undirected    | dotted |

---

### Link routing

| Annotation    | Routing style        |
|---------------|----------------------|
| `@straight`   | Straight line        |
| `@orthogonal` | Right-angle segments |
| `@bezier`     | Bézier curve         |
| `@polyline`   | Polyline segments    |

---

### Trace types

| Type                                   | Semantics                              |
|----------------------------------------|----------------------------------------|
| `satisfies` · `triggers` · `calls`     | Dependency or invocation               |
| `reads` · `writes`                     | Data-flow direction                    |
| `extends` · `custom`                   | Extension or user-defined              |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: Dashboard
author: Alice
---
poster "My Poster"
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
poster "System Dashboard"
  columns 2

  cell "Services"
    flowchart LR
      api[API] --> db[(Database)]
  end

  cell "Uptime"
    99.9% | uptime
  end
```


---

## Topology

Draws cost-weighted node graphs (NUMA, network fabric) with tier-coloured edges and an auto-generated cost legend.

**Header keyword(s):** `topology`

---

### Config keywords

| Keyword | Syntax                                                  | Purpose                                                   |
|---------|---------------------------------------------------------|-----------------------------------------------------------|
| `title` | `title <text>`                                          | Diagram title                                             |
| `costs` | `costs <unit>`                                          | Opens the cost-scale block; sets unit label (e.g. `ns`)   |
| `tier`  | `tier <name> <maxWeight> <color> [<dashArray>]`         | Cost tier with colour; optional dash pattern for edges     |

---

### Block keywords

| Keyword | Syntax                                | Purpose                                        |
|---------|---------------------------------------|------------------------------------------------|
| `group` | `group <id> : <label>`               | Groups nodes into a named panel                |
| `node`  | `node <id> : <label>`                | Node with label                                |
| `node`  | `node <id> : <label> : <sub>`        | Node with label and sub-label                  |

---

### Edge types

| Syntax                         | Meaning                                                 |
|--------------------------------|---------------------------------------------------------|
| `<from> -- <to>`               | Undirected edge (no cost; uses default colour)          |
| `<from> -- <to> : <cost>`      | Undirected edge with numeric cost; coloured by tier     |

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
topology
  title NUMA interconnect
  costs ns
    tier local 90 #27ae60
    tier hop1 140 #2f80ed
  node N0 : Node 0 : CPU+RAM
  node N1 : Node 1 : CPU+RAM
  N0 -- N1 : 140
```


---

## Data-Structure (DS) Diagrams



---

## DS — Array

Contiguous cell strip with optional index row and named pointer annotations.

**Header keyword(s):** `array`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `array <v1> <v2> …` | Inline cells on the header line |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> <v2> …` | Cell values (block form) |
| `index` | Show zero-based index row below cells |
| `ptr <name> -> <idx>` | Named pointer arrow below cell at 0-based `<idx>` |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
array
  title nums
  cells 5 8 13 21 34
  index
  ptr i -> 2
```


---

## DS — AVL Tree

Self-balancing BST rendered as a top-down circle-node tree; real AVL insertion with rotations is performed at parse time — the structure is always balanced by construction. Each node shows its balance factor as a corner badge.

**Header keyword(s):** `avl`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `avl <int1> <int2> …` | Integer keys to insert (duplicates silently ignored) |
| `insert` | Optional keyword (ignored; all integers in input are inserted) |

**Key extraction:** all integers matching `/-?\d+/` in the entire input are extracted and inserted in order.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
avl insert 50 30 70 20 40 60 80
```


---

## DS — B-Tree

B-tree with configurable order; real insertion with node splitting at parse time — valid B-tree structure by construction. Internal nodes render as multi-key strip boxes.

**Header keyword(s):** `btree`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `btree order <N> insert <int1> …` | B-tree of order N with keys to insert |
| `order <N>` | Tree order (minimum 3; defaults to 3 if omitted) |
| `insert` | Optional keyword (ignored; all integers after `order <N>` are inserted) |

**Key extraction:** `order <N>` is stripped first; then all remaining integers matching `/-?\d+/` are inserted in order. Duplicates are silently ignored.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
btree order 3 insert 10 20 5 6 12 30 7 17
```


---

## DS — Circular Queue

Ring-buffer queue: horizontal cell strip (same as linear queue) with a curved wrap-around arc from the rear cell back to the front cell; front/rear markers below.

**Header keyword(s):** `cqueue`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above strip) |
| `capacity <N>` | Total ring capacity (required or inferred from cells) |
| `cells <v1> …` · `items <v1> …` | Cell values; use `_`, `.`, or `-` for empty slots |
| `front <idx>` | 0-based index of the front pointer (inferred if omitted) |
| `rear <idx>` | 0-based index of the rear pointer (inferred if omitted) |

**Empty-slot tokens:** `_` · `.` · `-`

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual ring cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
cqueue
  title ring buffer
  capacity 6
  cells _ B C D _ _
  front 1
  rear 3
```


---

## DS — Deque

Double-ended queue: horizontal cell strip with push/pop double-headed arrows at both the front (left) and rear (right) ends; front/rear pointers below.

**Header keyword(s):** `deque`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `deque <v1> <v2> …` | Inline cells on the header line |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> …` · `items <v1> …` | Cell values (block form) |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
deque
  title work-stealing deque
  cells A B C D
```


---

## DS — Hash Map

Hash map with separate chaining: a vertical bucket strip whose rows can be numbered (`0..N-1`) or labeled with arbitrary strings; non-empty buckets point right to a singly linked chain of key→value entry boxes.

**Header keyword(s):** `hashmap`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above map) |
| `buckets <N>` | Total bucket count (defaults to max referenced numeric index + 1) |
| `buckets <label>, <label>, ...` | Explicit bucket labels, e.g. `buckets name, email, phone` |
| `bucket <idx-or-label>: <entries>` | Populate bucket `<idx-or-label>` with a comma-separated entry list |

**Entry syntax within a bucket line:**

| Separator | Example |
|-----------|---------|
| `->` | `alice->1` |
| `=>` | `alice=>1` |
| `:` | `alice:1` |
| `=` | `alice=1` |

Multiple entries per bucket are comma-separated: `alice->1, bob->2`.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `b0` · `b1` · … `bn` | Bucket rows in display order (positional, still 0-based for compatibility) |
| `b0e0` · `b0e1` · … | Entry boxes in bucket chains (bucket-row · entry-index) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
hashmap
  title users
  buckets name, email, phone, zip
  bucket name: alice->1, bob->2
  bucket email: carol->carol@example.com
  bucket zip: dave->90210
```

Numeric bucket syntax remains valid:
```
hashmap
  buckets 5
  bucket 0: alice->1, bob->2
  bucket 2: carol->3
```


---

## DS — Heap

Binary heap built by real sift-up at parse time; rendered as the implicit complete binary tree (children of i are 2i+1, 2i+2); nodes are circles.

**Header keyword(s):** `heap`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `heap max <int1> <int2> …` | Max-heap (default) |
| `heap min <int1> <int2> …` | Min-heap |
| `insert` | Optional keyword (ignored; all integers in input are inserted) |

**Heap property selection:** presence of the word `min` anywhere in the input selects min-heap; otherwise max-heap.

**Key extraction:** all integers matching `/-?\d+/` in the entire input are extracted and inserted via sift-up in order.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
heap max insert 50 30 70 20 40 60 80
```


---

## DS — Linked List

Singly linked list rendered as a chain of value|pointer node pairs with a head arrow.

**Header keyword(s):** `linkedlist`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `linkedlist <v1> <v2> …` | Inline node values on the header line |
| `title <text>` | Diagram title (bold, above chain) |
| `values <v1> <v2> …` · `nodes <v1> <v2> …` | Explicit node list (block form) |
| bare tokens | Any unrecognised line tokens are appended as node values |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `n0` · `n1` · … `nn` | Individual list nodes (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
linkedlist
  title queue
  values 3 7 9
```


---

## DS — Matrix

2D rectangular grid of equal cells; row and column indices displayed by default; ragged rows are right-padded with blanks.

**Header keyword(s):** `matrix`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `matrix <R>x<C>` | Empty R-row × C-column grid (on the header line) |
| `title <text>` | Diagram title (bold, above grid) |
| `noindex` | Hide row (left) and column (top) index labels |
| `row <v1> <v2> …` | One grid row of cell values |

**Shorthand:** `matrix 3x4` on its own line creates an empty 3×4 grid before any `row` lines.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `r0c0` · `r0c1` · … | Individual cells — `r<row>c<col>` (both 0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
matrix
  title weights
  row 1 2 3
  row 4 5 6
```


---

## DS — Memory

Named memory regions side-by-side, containing variable slots and heap objects; cross-region pointer arrows connect slots to their targets.

**Header keyword(s):** `memory`

---

### Region syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above regions) |
| `region <NAME>` | Start a named region block |
| `var <name>` | A plain variable slot inside the current region |
| `var <name> -> <target-id>` | Slot with a pointer arrow to `<target-id>` in any region |
| `object <id> : <title> : <k>=<v>, …` | Heap object with fields (colon-delimited sections) |

**Entry separator for object fields:** `,` between `key=value` pairs.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `<var-name>` | The var slot box |
| `<object-id>` | The object box |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
memory
  title Stack → Heap
  region STACK
    var p -> obj
  region HEAP
    object obj : Point : x=1, y=2
```


---

## DS — Node Graph

Generic directed or undirected node-link graph; nodes are rounded boxes; edges are straight connectors; directed edges carry arrowheads.

**Header keyword(s):** `nodegraph` · `dsgraph`

---

### Graph-level keywords

| Line | Purpose |
|------|---------|
| `directed` | Enable directed mode (arrowheads on edges) |
| `undirected` | Disable directed mode (default) |
| `title <text>` | Diagram title (bold, above graph) |

---

### Node syntax

| Line | Purpose |
|------|---------|
| `node <id>` | Declare a node with its id as label |
| `node <id> : <label>` | Declare a node with explicit label |

Nodes are also auto-declared on first appearance in an edge line.

---

### Edge syntax

| Operator | Kind |
|----------|------|
| `<from> -> <to>` | Directed edge |
| `<from> -- <to>` | Undirected edge |
| `<from> <-> <to>` | Bidirectional edge |
| `<from> -> <to> : <label>` | Edge with label |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `<node-id>` | Node box |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
nodegraph
  directed
  title Dependency graph
  node A : Parser
  A -> B : calls
  B -- C
```


---

## DS — Page

Slotted storage page: a PageHeader bar, a row of numbered slot pointers, a free-space region, and a row of tuples; arrows connect each slot to its tuple.

**Header keyword(s):** `page`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above page) |
| `slots <N>` | Number of slot pointers (defaults to tuple count) |
| `tuples <t1> <t2> …` | Tuple value tokens (space-separated, one per cell) |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `slot0` · `slot1` · … | Slot pointer cells (0-based) |
| `tuple0` · `tuple1` · … | Tuple cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
page
  title heap page
  slots 4
  tuples (10,Ann) (40,Bob) (50,Cy)
```


---

## DS — Plan

Query-plan tree: same indentation syntax as `tree`, but operator node colours are automatically inferred from label text — no manual `:kind` tags required for standard operators.

**Header keyword(s):** `plan`

---

### Auto-inferred kinds (from label text)

| Label contains | Inferred kind | Visual |
|----------------|---------------|--------|
| `join` | `join` | Join operator colour |
| `scan` | `scan` | Scan operator colour |
| `hash`, `sort`, `aggregate`, `group`, `materialize`, `gather` | `build` | Build/hash colour |

Manual `:kind` tags on a node override inference for that node.

---

### Node line syntax (identical to `tree`)

```
<indent> [|edge-label|] <label> [:kind …] [{attr: val, …}]
```

All node syntax, directions, attribute block keys, and config keywords from the `tree` family apply unchanged. See **DS — Tree** for the full reference.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
plan
  title Query plan
  Hash Join {rows: 980}
    Seq Scan orders {rows: 10000}
    Hash
      Index Scan customers {idx: idx_cust}
```


---

## DS — Priority Queue

Vertical stack of cells ordered by priority (highest at top); each cell is shaded by priority tint and shows its label and numeric priority value.

**Header keyword(s):** `pqueue`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above stack) |
| `item <label words…> <priority>` | One entry; trailing numeric token is the priority; ties preserve input order |

**Ordering:** highest priority rendered at the top; numeric priorities (integer or float); negative values allowed.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Cells in sorted display order (top = highest priority) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
pqueue
  title scheduler
  item Deploy 9
  item Build 5
  item Lint 2
```


---

## DS — Queue

Linear FIFO queue: horizontal cell strip with dequeue arrow at the front (left) and enqueue arrow at the rear (right); front/rear pointers below the filled span.

**Header keyword(s):** `queue`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `queue <v1> <v2> …` | Inline filled cells on the header line |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> …` · `items <v1> …` | Filled cell values (block form) |
| `capacity <N>` | Total slot count (N ≥ filled); trailing empty slots shown |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual cells (0-based, including empty slots) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
queue
  title task queue
  cells A B C
  capacity 5
```


---

## DS — Radix Tree

Prefix-compressed Patricia trie: shared prefixes collapse onto single labelled edges; branch nodes render as small dots; word-terminal nodes render as filled pills showing the complete word.

**Header keyword(s):** `radix`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `radix <word1> <word2> …` | Alphabetic words to insert (case-sensitive) |
| `insert` | Optional keyword (ignored; alphabetic tokens are the words) |

**Word filter:** only purely alphabetic tokens (`/^[A-Za-z]+$/`) that are not `radix` or `insert` are treated as words. Numeric tokens and keywords are silently skipped.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
radix insert cat car card dog do
```


---

## DS — Red-Black Tree

Left-leaning red-black tree (LLRB / Sedgewick); real insertion with rotations and colour flips at parse time — valid red-black colouring by construction. Each node is tagged `red` or `black`.

**Header keyword(s):** `rbtree`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `rbtree <int1> <int2> …` | Integer keys to insert (duplicates silently ignored) |
| `insert` | Optional keyword (ignored; all integers in input are inserted) |

**Key extraction:** all integers matching `/-?\d+/` in the entire input are extracted and inserted in order. The root is always forced black after each insertion.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
rbtree insert 13 8 17 1 11 15 25 6
```


---

## DS — Segment Tree

Segment tree over a numeric array; each node stores the reduced value for its `[lo, hi]` range sub-line. Built bottom-up at parse time.

**Header keyword(s):** `segtree`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `segtree over [<n1>,<n2>,…] reduce <reducer>` | Array and reducer keyword |
| `over […]` | Source array literal (numbers extracted by `/-?\d+/`) |
| `reduce <reducer>` | Aggregation function keyword |

### Reducer keywords

| Token | Operation |
|-------|-----------|
| `sum` | Summation (default when no reducer keyword present) |
| `min` | Minimum |
| `max` | Maximum |

**Key extraction:** all integers/floats matching `/-?\d+/` in the entire input are used as the array elements in order.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
segtree over [5, 8, 13, 21] reduce sum
```


---

## DS — Stack

LIFO stack: vertical cell strip with push/pop arrow at the top; a `top` pointer on the left marks the top-of-stack cell; optional empty slots above show remaining capacity.

**Header keyword(s):** `stack`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `stack <v1> <v2> …` | Inline cells on the header line (last token = top of stack) |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> …` · `items <v1> …` | Cell values in push order; last = top (block form) |
| `capacity <N>` | Total slot count (N ≥ filled); empty slots shown above top |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Cells in display order (top = index of first empty slot, or 0) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
stack
  title call stack
  cells main parse layout
  capacity 6
```


---

## DS — Tree

Generic indentation-based hierarchy; node shape, colour, info sub-line, badge, and parent-edge label are all set per node via inline decoration syntax.

**Header keyword(s):** `tree`

---

### Directions

| Token | Meaning |
|-------|---------|
| `TD` · `TB` | Top → Down (default) |
| `LR` | Left → Right |

---

### Node line syntax

```
<indent> [|edge-label|] <label> [:kind …] [{attr: val, …}]
```

| Part | Purpose |
|------|---------|
| Leading whitespace | Determines parent–child relationship (deeper = child) |
| `\|edge-label\|` | Label on the edge from this node's parent |
| `<label>` | Node display text |
| `:kind` | One or more decoration tags (see table below) |
| `{k: v, k2: v2}` | Attribute block for info sub-line, badge, or additional kinds |

---

### Node kinds

| Kind token | Visual effect |
|------------|---------------|
| `box` | Rectangle node |
| `circle` | Circle node |
| `leaf` | Leaf terminal node |
| `dot` | Small dot (branch, no label) |
| `strip` | Multi-key strip (B-tree node) |
| `active` | Highlighted / filled accent |
| `scan` | Scan operator colour |
| `join` | Join operator colour |
| `build` | Build/hash/sort operator colour |
| `red` · `black` | Red-black tree node colours |
| `muted` | Muted/greyed text |
| `primary` | Primary accent colour |

---

### Attribute block keys

| Key | Value | Effect |
|-----|-------|--------|
| `badge` | any string | Corner badge on the node |
| `sub` · `info` | any string | Muted sub-line under the label |
| `rows` | number | Rendered as `rows: N` info sub-line |
| `idx` | string | Rendered as `idx: <val>` info sub-line |
| any other key | string/number | Rendered as `key: val` info sub-line |

---

### Config keywords

| Line | Purpose |
|------|---------|
| `tree [TD\|TB\|LR]` | Header with optional direction |
| `title <text>` | Diagram title (stored in metadata) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
tree TD
  title Decision tree
  x1 < 0.5 ? :box
    |yes| A :leaf
    |no|  B :leaf
```


---

## DS — Trie

Uncompressed character trie: every character gets its own edge and node; shared prefixes share a path; word-terminal nodes render as filled pills with the full word; intermediate nodes render as dots.

**Header keyword(s):** `trie`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `trie <word1> <word2> …` | Insert words into the trie (alphanumeric tokens only) |
| `insert` | Optional keyword between `trie` and the words (ignored) |

**Word filter:** only alphanumeric tokens (`[A-Za-z0-9]+`) that are not `trie` or `insert` are treated as words to insert.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
trie insert cat car card dog do
```


---

## DS — Union-Find (DSU)

Disjoint Set Union forest: one tree per set, rooted at the set representative (filled circle); member nodes are plain circles; edges are parent pointers drawn top-down.

**Header keyword(s):** `unionfind` · `dsu`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `unionfind <N>` · `dsu <N>` | N elements (0-based), initialised as singletons |
| `title <text>` | Diagram title (stored in metadata) |
| `parent <p0> <p1> … <pN-1>` | Explicit parent array; `parent[i] == i` marks a representative |
| `union <a> <b>` | Attach the root of set(a) under the root of set(b) |

**Precedence:** `parent` array is applied first (seeding identities), then `union` operations are applied in order.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `e0` · `e1` · … `en` | Element nodes (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
unionfind 7
  parent 0 0 1 3 3 5 5
```
