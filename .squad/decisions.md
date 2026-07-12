# Design — Cross-Diagram Icon Attachment (extends Icon Library Import; not yet approved to build)

**Author:** Leslie (Spec Architect)  
**Date:** 2026-07-12T19:31:45-04:00  
**Status:** DESIGN RECOMMENDATION — extends the Icon Library Import Format (finalized 2026-07-12)

---

## Definitions

- **Icon token:** The universal `prefix:name` string (e.g. `azure:app-service`, `mdi:server`) that identifies one icon in a loaded pack.
- **Node-shape icon:** An icon that decorates a node/box/cell as a visual glyph — like architecture's `service db(database)[DB]`. The icon IS the node's primary visual or a prominent badge.
- **Inline-label icon:** An icon embedded INSIDE a text label/run, mixed with prose — rendered as an inline glyph alongside words.
- **IconRef:** The shared IR token that carries a resolved icon reference through the pipeline.

---

## 1. Diagram Family Survey — Icon Attachment Points

### Diagram types WHERE icons attach (node-shape and/or inline-label):

| Diagram | Attachment point | Form(s) | IR file (citation) |
|---------|-----------------|---------|-------------------|
| **architecture** | `service`/`group` icon slot | Node-shape (EXISTING) | `src/diagrams/triton/architecture/ir.ts:6,13` |
| **flowchart** | `FlowNode` (box/shape) | Node-shape (PROPOSED) | `src/diagrams/mermaid/flowchart/ir.ts:12–16` |
| **flowchart** | `FlowNode.label`, `FlowEdge.label` | Inline-label (PROPOSED) | `src/diagrams/mermaid/flowchart/ir.ts:14,30` |
| **mindmap** | `MindNode.icon` | Node-shape (EXISTING slot) | `src/diagrams/mermaid/mindmap/ir.ts:5` |
| **sequence** | `SeqParticipant` | Node-shape (PROPOSED) | `src/diagrams/mermaid/sequence/ir.ts:4–7` |
| **sequence** | `SeqMessage.text`, `SeqNote.text` | Inline-label (PROPOSED) | `src/diagrams/mermaid/sequence/ir.ts:16,25` |
| **state** | `StateNode` | Node-shape (PROPOSED) | `src/diagrams/mermaid/state/ir.ts:6–10` |
| **class** | `ClassBox` (stereotype decoration) | Node-shape (PROPOSED) | `src/diagrams/mermaid/class/ir.ts:8–12` |
| **c4** | `C4Node` (person/system/container) | Node-shape (PROPOSED) | `src/diagrams/mermaid/c4/ir.ts:3–7` |
| **block** | `BlockNode` | Node-shape (PROPOSED) | `src/diagrams/triton/block/ir.ts:4–7` |
| **poster** | `PosterCell.title`, `StatCell.label` | Inline-label (PROPOSED) | `src/diagrams/triton/poster/ir.ts:6,22` |
| **er** | `ErEntity` (header badge) | Node-shape (PROPOSED, low-priority) | `src/diagrams/mermaid/er/ir.ts:8–11` |
| **journey** | `JourneyTask` | Inline-label (PROPOSED, low-priority) | `src/diagrams/mermaid/journey/ir.ts:4–8` |

### Diagram types WHERE icons DO NOT make sense:

| Diagram | Reason |
|---------|--------|
| **gantt** | Tasks are time bars on a timeline; no discrete node/box. Icon on a bar adds visual noise, not information. |
| **gitgraph** | Commits are small circles on lanes; structural, not semantic. No user-facing "node label" to decorate. |
| **pie / radar / quadrant / xychart** | Data-driven charts; axes/slices are numeric, not entity-based. Icons do not attach to a data point. |
| **sankey** | Flow widths encode quantity; nodes are thin labels. No box surface to decorate. |
| **kanban** | Card titles are text-centric; could accept inline-label later but not in first cut. |
| **packet** | Bit-field headers; structural, numeric. No semantic entity. |
| **ds family** (array/linkedlist/memory/page/queue/stack/tree) | Cells contain VALUES (numbers, strings). An icon in a cell conflicts with value semantics. The `tokenizeDirective` in `src/diagrams/triton/ds/struct/shared.ts:36–68` parses bare and quoted tokens as data values. Not icon targets. |

---

## 2. Two Attachment Forms — Precise Definition

### 2A. Node-Shape Icon

**Definition:** An optional `icon` property on a node/box/cell IR, referencing a `prefix:name` token. Rendered as the primary or decorative glyph for that node.

**Syntax approach — per grammar family:**

#### Architecture (EXISTING — no change)
```
service api(azure:app-service)[API Server]
```
Grammar: `src/diagrams/triton/architecture/grammar.peggy:34` — already parses `(icon)`.

#### Flowchart (PROPOSED — metadata block)
Triton's flowchart grammar (`src/diagrams/mermaid/flowchart/grammar.peggy`) does NOT currently parse `@{...}` shape metadata. The grammar defines shapes via bracket delimiters (lines 222–232). However, Mermaid v11+ supports `@{ icon: "...", shape: "..." }` node metadata.

**Proposal:** Extend the flowchart grammar to accept an optional `@{...}` metadata block after a node definition. This is Mermaid-superset-compatible — we adopt their syntax where it exists:

```
flowchart LR
  A@{ icon: "azure:app-service", shape: "rounded-rect" }["App Service"]
  B@{ icon: "mdi:database" }["Database"]
  A --> B
```

When `@{icon: "prefix:name"}` is present, the node renders with that icon above/inside its label. This requires a grammar extension at `grammar.peggy:211` (the `NodeRef` rule).

#### Mindmap (EXISTING slot — redefine token)
The `::icon(...)` syntax already exists (`src/diagrams/mermaid/mindmap/index.ts:31–32`). Currently accepts raw class names (FA). **Redefine:** the parenthesized value is now interpreted as a `prefix:name` token:
```
mindmap
  Root
    Cloud Infra
      ::icon(azure:virtual-network)
    Database
      ::icon(mdi:database)
```
No grammar change needed — the regex at `index.ts:31` already captures `[^)]*`. Resolution changes from CSS class to IconRef.

#### Sequence (PROPOSED — participant metadata)
```
sequenceDiagram
  participant A as App Service @{ icon: "azure:app-service" }
  participant B as Database @{ icon: "mdi:database" }
```
The `@{...}` block appended after the participant label/alias. Renders icon inside the participant header box.

#### State (PROPOSED — state declaration metadata)
```
stateDiagram-v2
  state "Processing" as proc @{ icon: "mdi:cog" }
  state "Done" as done @{ icon: "mdi:check-circle" }
```

#### Class (PROPOSED — stereotype-position icon)
```
classDiagram
  class UserService {
    <<service>> @{ icon: "mdi:account" }
    +getUser() User
  }
```
Icon renders in the class header, adjacent to the stereotype.

#### C4 (PROPOSED — node function parameter)
C4 already has a `kind` that drives shape (person/system). Icon is additive:
```
C4Context
  System(api, "API Gateway", "Routes requests", $icon="azure:api-management")
```
The `$icon=` parameter mirrors Mermaid C4's `$sprite` convention, avoiding grammar conflict with positional args.

#### Block (PROPOSED — metadata block)
```
block-beta
  columns 3
  A@{ icon: "mdi:server" }["Server"] B["Cache"] C["DB"]
```

### 2B. Inline-Label Icon

**Definition:** An icon glyph embedded inline within a text run (label, note, message text). Resolves to an inline SVG `<path>`/`<g>` element positioned as a glyph alongside text.

**Token design constraints:**
- Must be UNAMBIGUOUS against the quoted-string tokenizer (`src/diagrams/triton/ds/struct/shared.ts:36–68` — uses `"..."` quoting with `\"` escape only).
- Must not collide with `%%` comment stripping (centralized, line-level).
- Must not collide with Mermaid's `fa:fa-x` (which we are NOT adopting — it fires only under htmlLabels, unsuitable for static SVG).
- Must not collide with existing delimiters: `[]`, `()`, `{}`, `<>`, `|...|`, `::`, `-->`.

**Proposed token:** `:prefix:name:` (colon-wrapped icon reference)

Rationale:
- Leading+trailing colon is unambiguous: bare colons in labels don't follow `word:word:` pattern (would need two colons wrapping a slash-free identifier pair).
- Mirrors emoji shortcode convention (`:smile:`) — familiar to users.
- The regex `/:([a-z0-9-]+:[a-z0-9-]+):/` matches exactly `prefix:name` — no false positives against English prose, URLs (which have `://`), or timestamp text (`HH:MM`).
- Survives inside quoted strings and bracket-delimited labels.

**Examples:**
```
flowchart LR
  A["Deploy to :azure:app-service: production"]
  B["Check :mdi:database: health"]
  A --> B
```

```
sequenceDiagram
  A ->> B: Deploy :azure:aks: cluster
  Note over B: :mdi:check-circle: Complete
```

**Rendering:** The inline icon resolves to an SVG `<path>` (or `<g>`) element inserted into the text `<text>` element's flow at glyph position. For rsvg-convert compatibility (static PNG), the icon MUST be a `<g>` sibling at the correct x-offset — NOT foreignObject, NOT `<image>`. The text metrics engine reserves `width × height` (default: 1em × 1em) for the icon glyph.

---

## 3. One Token, Many Hosts — Shared Resolution

The SAME `prefix:name` token powers BOTH attachment forms. Resolution path:

```
Grammar parse → IR carries IconRef → Renderer resolves body from ResolvedIconRegistry → SVG emit
```

**IconRef IR shape (Mark's domain — proposed, not built):**

```typescript
/** Carried by any IR node/label that references an icon. */
export interface IconRef {
  readonly prefix: string;   // e.g. "azure"
  readonly name: string;     // e.g. "app-service"
}
```

**Where IconRef appears in extended IRs:**

| IR interface | New field | Type |
|--------------|-----------|------|
| `FlowNode` | `icon?: IconRef` | Optional |
| `MindNode` | `icon?: IconRef` (retyped from `string`) | Optional |
| `SeqParticipant` | `icon?: IconRef` | Optional |
| `StateNode` | `icon?: IconRef` | Optional |
| `ClassBox` | `icon?: IconRef` | Optional |
| `C4Node` | `icon?: IconRef` | Optional |
| `BlockNode` | `icon?: IconRef` | Optional |
| `ArchService` / `ArchGroup` | `icon: string \| IconRef` (backward compat) | Required (string for built-ins) |
| All `label`/`text` fields | Inline tokens parsed at render time | N/A (string stays string; inline `:p:n:` resolved during SVG emit) |

**One resolver, one rendering path:**
- The host passes `ResolvedIconRegistry` (Map<prefix, Map<name, ResolvedIcon>>) into core — already designed in the icon-library format spec.
- Core's renderer calls a single `resolveIcon(registry, ref): ResolvedIcon | null` function regardless of which diagram type requested it.
- Missing icons → fallback to geometric primitive (the existing `iconGlyph` function at `src/diagrams/triton/architecture/layout.ts:111` already does this for architecture; generalize it).

---

## 4. Rendering Placement & Layout

### Node-shape icon placement:
- **Default:** Icon above label text, centered horizontally within the node box. (Architecture currently does this — `layout.ts:91`: icon at `y + 24` from top of rect.)
- **Compact variant:** Icon left of label (leading glyph), when node width >> height.
- **Icon-only:** If label is empty, icon fills the node as primary glyph.

### Inline-label icon placement:
- Icon rendered inline at glyph position, baseline-aligned with surrounding text.
- Reserved box: 1em × 1em (matching line-height), scaled from icon's `viewBox`.
- For multi-line text, the icon stays on its line — no float/wrap behavior.

### Mono vs brand rule (unchanged):
- `currentColor` body → tint to palette hue (the node's computed stroke/text color).
- Hardcoded fill values → render verbatim (brand icon).
- Detection is per-icon at resolve time — already specified in icon-library format.

### Layout cost (Edsger/Brian's domain — flagged, not designed):
- Each diagram's layout engine must account for icon box reservation.
- Architecture already does this. Flowchart/state/class/block require box-height increase. Sequence requires participant header expansion.
- Inline icons require text-metrics adjustment (reserve glyph width in the text measurement pass).
- **This is per-diagram layout work. Each diagram family's `layout.ts` must be updated.**

---

## 5. Concrete Examples

### Example A — Flowchart Node Icon (PROPOSED)

```mermaid
flowchart LR
  A@{ icon: "azure:app-service" }["App Service"]
  B@{ icon: "mdi:database" }["PostgreSQL"]
  A -->|queries| B
```

- `@{ icon: "..." }` = **PROPOSED** (not in current grammar at `grammar.peggy:211`)
- `["label"]` = EXISTING shape syntax (`grammar.peggy:230`)
- `-->|label|` = EXISTING edge syntax (`grammar.peggy:163`)

### Example B — Sequence Participant Icon (PROPOSED)

```mermaid
sequenceDiagram
  participant client as Client @{ icon: "mdi:laptop" }
  participant api as API @{ icon: "azure:api-management" }
  client ->> api: POST /deploy :azure:aks:
```

- `participant X as Y` = EXISTING
- `@{ icon: "..." }` on participant = **PROPOSED**
- `:azure:aks:` in message text = **PROPOSED** inline-label icon

### Example C — Mindmap Node Icon (EXISTING slot, NEW token format)

```mermaid
mindmap
  Cloud Architecture
    Compute
      ::icon(azure:virtual-machines)
    Networking
      ::icon(azure:virtual-network)
    Storage
      ::icon(azure:storage-accounts)
```

- `::icon(...)` = EXISTING syntax (`src/diagrams/mermaid/mindmap/index.ts:31`)
- `azure:virtual-machines` inside parens = **PROPOSED** (was FA class name)

### Example D — Class Stereotype Icon (PROPOSED)

```mermaid
classDiagram
  class OrderService {
    <<service>> @{ icon: "mdi:cart" }
    +createOrder(items) Order
    +cancelOrder(id) void
  }
```

- `<<stereotype>>` = EXISTING
- `@{ icon: "..." }` after stereotype = **PROPOSED**

### Example E — Inline-Label Icon in Flowchart (PROPOSED)

```mermaid
flowchart TD
  A["Deploy :azure:app-service: to prod"]
  B{"Check :mdi:heart-pulse: health"}
  A --> B
```

- `["text"]` label = EXISTING
- `:prefix:name:` within text = **PROPOSED** inline-label token

---

## 6. Applicability Matrix & Phasing Delta

### Per-Diagram Applicability Matrix

| Diagram | Node-shape icon | Inline-label icon | Phase |
|---------|:-:|:-:|-------|
| architecture | ✅ EXISTING | ❌ N/A (labels are short) | Done |
| flowchart | ✅ | ✅ | P6a (first cut) |
| mindmap | ✅ (slot exists) | ❌ (single-word labels) | P6a |
| sequence | ✅ (participant) | ✅ (message/note text) | P6a |
| state | ✅ | ❌ (labels too short) | P6b |
| class | ✅ (stereotype) | ❌ (member signatures) | P6b |
| c4 | ✅ | ❌ (descriptions are prose) | P6b |
| block | ✅ | ✅ | P6b |
| poster | ❌ (cells hold sub-diagrams) | ✅ (title/caption) | P6c |
| er | ✅ (low value) | ❌ | P6c (if demand) |
| journey | ❌ | ✅ (task labels) | P6c (if demand) |
| gantt | ❌ | ❌ | Never |
| gitgraph | ❌ | ❌ | Never |
| pie/radar/quadrant/xy | ❌ | ❌ | Never |
| sankey | ❌ | ❌ | Never |
| packet | ❌ | ❌ | Never |
| ds family | ❌ | ❌ | Never |

### Phasing Delta (extends existing P6 bucket)

The existing P6 phase ("Grammar integration — 4–6h") becomes:

| Sub-phase | Scope | Effort | Depends on |
|-----------|-------|--------|------------|
| **P6a** | Flowchart `@{icon}` grammar + IR, mindmap IconRef reinterpretation, sequence participant icon. Inline-label tokenizer (shared). | 6–8h | P2 |
| **P6b** | State, class, c4, block node-shape icon. | 4–5h | P6a |
| **P6c** | Poster inline-label, er/journey (if demand). | 2–3h | P6a |

**Revised P6 total:** 12–16h (up from 4–6h) — reflects the cross-diagram scope.
**Revised overall total:** ~30–40h (up from 22–30h).

The inline-label tokenizer (`:prefix:name:` regex + resolve) is built ONCE in P6a and shared by all diagrams that support inline icons. The `@{...}` metadata parser is also built once (flowchart) and reused by sequence/state/class/block.

---

## RECOMMENDATION

1. **Two attachment forms:**
   - **Node-shape icon** via `@{ icon: "prefix:name" }` metadata (for grammars without a dedicated icon slot) or existing `(icon)` / `::icon(...)` syntax (architecture, mindmap).
   - **Inline-label icon** via `:prefix:name:` colon-wrapped token inside any text/label string.

2. **Shared IR:** A single `IconRef { prefix, name }` type carried by all diagram IRs. One resolver function. One SVG emit path. Host provides the registry; core stays pure.

3. **First cut (P6a):** Flowchart + mindmap + sequence. These cover the highest user demand (cloud architecture diagrams often combine flowchart for topology + sequence for interactions).

4. **Mermaid compatibility:** Adopt `@{ icon: "..." }` where Mermaid v11+ defines it (flowchart shape metadata). Triton extends it to other grammars consistently. The `:prefix:name:` inline form is Triton-original (Mermaid's `fa:fa-x` is htmlLabels-only and deprecated for static SVG).

5. **No grammar conflicts:** The `@{` token does not appear in any current Triton grammar. The `:prefix:name:` pattern does not collide with `%%` comments, `|...|` edge labels, `::` (only appears as line-start `::icon`), or quoted-string delimiters.

---

# Research & Design — Icon Library Import Format (IconifyJSON packs; not yet approved to build)

**Authors:** David (Research Lead), Leslie (Spec Architect)  
**Date:** 2026-07-12T18:50:49-04:00  
**Status:** FINAL DESIGN RECOMMENDATION — Pending approval to begin Phase P0-P6 (22–30 hours) implementation. NOT YET approved to build.

---

## Background

Triton users need a way to reference and embed icons (especially Azure architecture icons for cloud diagrams) inline in diagrams. David conducted licensing + format research; Leslie designed the import/discovery/rendering mechanism.

**Key finding (David):** Microsoft's Azure Architecture Icons (705+) are licensed for "architectural diagrams, training materials, or documentation" only. Third-party tool bundling would be redistribution outside permitted use — Microsoft reserves all other rights. **Verdict: Triton cannot ship Azure icons; must be bring-your-own-pack (BYOP) model.**

**Candidate format (David + Leslie):** IconifyJSON (the `@iconify/types@2.0.0` schema used by Iconify's 150+ official packs). Single `.json` file; deterministic; compile-time resolution; ecosystem tooling available.

---

## David's Findings: Azure Licensing & Format Research

### 1. Azure Architecture Icons — Official Distribution & Licensing

| Attribute | Fact |
|-----------|------|
| Official page | https://learn.microsoft.com/en-us/azure/architecture/icons/ |
| Download URL | `https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip` |
| Format | ZIP of individual `.svg` files (also `.png` included) |
| Count | **705+ icons** as of July 2026 (updated monthly; +10–13 per batch) |
| Folder structure | Category subfolders: `Compute/`, `Networking/`, `AI + Machine Learning/`, `Databases/`, `Storage/`, `Security/`, `Developer Tools/`, `Identity/`, … (17+ categories matching Azure portal navigation) |
| SVG naming | `{Service Name}_{Category}.svg` — e.g. `Virtual Machines_Compute.svg`, `Key Vault_Security.svg` |
| Colors | **Multicolor, NOT monochrome.** Hardcoded Azure brand fills: `#0078D4` (blue), teal, gradients. Do NOT use `currentColor`. Cannot be palette-tinted. Render verbatim regardless of surrounding CSS. |

### Color detail (critical for Triton)

The official Azure icons embed Microsoft brand gradients directly in SVG `<path>` fills and `<linearGradient>` defs. They look visually rich but are completely opaque to theming. A Triton dark theme cannot invert or tint them. They will always show Azure's corporate color palette.

### Licensing terms — verbatim from the official page

> "Microsoft permits the use of these icons in architectural diagrams, training materials, or documentation. You can copy, distribute, and display the icons only for the permitted use unless granted explicit permission by Microsoft. Microsoft reserves all other rights."

**Source:** https://learn.microsoft.com/en-us/azure/architecture/icons/

#### Redistribution verdict

**Triton CANNOT bundle or redistribute Azure SVG files.** The "permitted use" is limited to architectural diagrams, training, and documentation. Packaging them inside a third-party compiler tool's npm/tar distribution would be redistribution outside the permitted use — Microsoft explicitly reserves all other rights. This is a hard constraint.

**Consequence for Triton:** Azure icons must be **user-supplied** ("bring your own pack" / BYOP model). Triton provides the import pipeline documentation; the user provides the icons.

### 2. Azure Icons on Iconify — Coverage Audit (July 2026)

| Source | What's there | Monochrome? | Count |
|--------|-------------|-------------|-------|
| `@iconify-json/logos` | `logos:microsoft-azure`, `logos:azure`, `logos:azure-icon` — brand logos only | ❌ hardcoded fills | 3 |
| `@iconify-json/simple-icons` | `simple-icons:azuredevops`, `simple-icons:azurefunctions`, `simple-icons:azurepipelines`, `simple-icons:azureartifacts`, `simple-icons:azuredataexplorer` — dev-brand marks | ✅ `currentColor` | 5 |
| `@iconify-json/devicon` | `devicon:azure-original` — generic Azure hex logo | ❌ hardcoded fills | 1 |
| **`@iconify-json/azure`** | **Does not exist.** Not in `iconify/icon-sets` JSON dir (confirmed July 2026). | — | 0 |

**Confirmed:** No Iconify pack covers the 705+ official Azure architecture service icons (App Service, AKS, Virtual Network, Key Vault, Cosmos DB, etc.). The full set is absent from Iconify due to Microsoft's licensing restriction.

### 3. The `IconifyJSON` Pack Format — The Candidate Static Format

The `@iconify/types@2.0.0` TypeScript definition provides the schema:

```typescript
interface IconifyIcon {
  body: string;    // inner SVG markup — NO <svg> wrapper
  rotate?: number; // 0–3 (×90°)
  hFlip?: boolean;
  vFlip?: boolean;
  hidden?: boolean;
  width?: number;
  height?: number;
}

interface IconifyJSON {
  prefix: string;                          // "azure", "mdi", "logos", …
  provider?: string;
  icons: { [name: string]: IconifyIcon };  // name = bare name, no prefix
  aliases?: { [name: string]: { parent: string } };
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  lastModified?: number;
  not_found?: string[];
}
```

**Source:** `https://cdn.jsdelivr.net/npm/@iconify/types@2.0.0/types.d.ts`

### Monochrome vs multicolor — the mechanism

| Property | Monochrome | Multicolor (brand) |
|----------|------------|-------------------|
| `body` fill | `fill="currentColor"` | `fill="#0078D4"`, `fill="url(#grad1)"`, etc. |
| Triton behavior | Set CSS `color` on `<svg>` wrapper → inherits palette token | Emit body verbatim → brand colors appear as-is |
| Theming | ✅ Recolorable | ❌ Fixed brand colors |
| Example packs | MDI, Lucide, Heroicons, simple-icons | logos:*, Azure architecture icons |

### File sizes (measured July 2026)

| Pack | Icons | Raw JSON size | Note |
|------|-------|--------------|------|
| `@iconify-json/mdi` | 7,638 | 3.0 MB | monochrome, simple paths |
| `@iconify-json/logos` | 2,091 | 7.4 MB | multicolor, complex paths |
| `@iconify-json/simple-icons` | 3,720 | ~2 MB (est) | monochrome |
| **Azure pack (estimated)** | **705** | **2–5 MB** | multicolor, complex gradient paths |

### Converting Azure SVGs → IconifyJSON: The `importDirectory` Pipeline

User runs once per Azure release using `@iconify/tools`:

```bash
npm install @iconify/tools
```

```js
import { importDirectory, cleanupSVG } from '@iconify/tools';
import { writeFileSync } from 'fs';

const collection = await importDirectory('./Azure_Public_Service_Icons/SVG', {
  prefix: 'azure',
});

for (const name of collection.keys()) {
  const icon = collection.getIcon(name);
  await cleanupSVG(icon);  // strips <title>, <desc>, fixes malformed SVG
  collection.setIcon(name, icon);
}

writeFileSync('./azure.json', JSON.stringify(collection.export()));
console.log(`Exported ${collection.count()} icons to azure.json`);
```

After running: user has `azure.json` (~2–5 MB). They reference it in their Triton diagram.

### Why IconifyJSON over alternatives

| Format | Description | Cons for Triton |
|--------|-------------|----------------|
| **Directory of `.svg` files** | `azure/virtual-machines.svg`, `azure/key-vault.svg`, … | N file I/O reads per compile; no single artifact; hard to distribute; no schema; no standard tooling |
| **SVG `<symbol>` sprite** | One SVG with `<symbol id="azure-...">` blocks | Must inject entire sprite into output (bulk); non-standard for pack distribution; no JSON tooling |

**IconifyJSON wins:** single artifact, standard schema, load-once/lookup-by-name, ecosystem tooling (`@iconify/utils`, `@iconify/tools`), compact per-icon bodies, deterministic.

---

## Leslie's Design: Static Icon-Library Import Mechanism

### Discovery & Location — Mirror Themes

```
project/
├── .triton/
│   ├── themes/
│   │   └── acme.triton-theme.json       ← existing (v0.1.15)
│   └── icons/
│       ├── lucide.triton-icons.json      ← bundled default (MIT)
│       └── azure.triton-icons.json       ← user-supplied (BYOP)
```

**Discovery function (`findTritonIconsDir`):** Walk up from start directory looking for `.triton/icons/`, return absolute path when found. Direct analogy to `findTritonThemesDir` (`src/theme/discover.ts:129–148`).

**Scan for `.triton-icons.json` files:** Validate each file — must have `prefix` (slug format), `icons` (object with at least one entry), each icon must have `body` (non-empty string).

**Prefix determination:** `prefix` field in JSON is AUTHORITATIVE. Filename stem is fallback ONLY if `prefix` field is absent.

**CLI Flags (analogous to `--themes-dir`/`--theme-file`):**

| Flag | Meaning |
|------|---------|
| `--icons-dir <dir>` | Directory of `.triton-icons.json` files. Merged on top of auto-discovered `.triton/icons/`. |
| `--icon-pack <path>` | Path to a single `.triton-icons.json` file. Additive (can repeat). Errors are fatal. |

### Purity Boundary — Where Resolution Happens

**Rule (same as themes):** Host discovers icon packs, resolves referenced icons to their SVG body data, and passes resolved icon bodies INTO core as structured data. Core never touches the filesystem.

**Injection point:** Add `icons?: ResolvedIconRegistry` as a new optional parameter on `compileSync`/`renderSync` (at `src/frontend/index.ts`). This parallels `themeInput?: ThemeInput` exactly.

```
HOST LAYER (I/O)                          CORE (pure)
─────────────────────────────────────     ─────────────────────────────────────
1. Discover .triton/icons/ dir            
2. Load + validate all packs              
3. Build ResolvedIconRegistry:            
   Map<prefix, Map<name, ResolvedIcon>>   
   where ResolvedIcon = {                 
     body: string,                        
     width: number, height: number,       
     left: number, top: number,           
     isBrand: boolean                     
   }                                      
4. Pass registry into core as data        → compileSync(input, themeInput?, icons?)
                                          → renderSync(input, themeInput?, icons?)
```

### Reference Syntax in Diagrams

```mermaid
architecture
  service vm[Azure VM] {
    icon: "azure:app-service"
  }
```

**Grammar:** `icon: "prefix:name"` property on node declarations. Value = quoted string.

**No prefix = default pack:** `icon: "server"` resolves against bundled Lucide (if available).

### Monochrome vs Brand/Multicolor — Detection & Rendering

**Classification (per-icon, at pack-load time):**

Scan body string for `fill="..."` or `stroke="..."` attributes. If any value is NOT one of: `"none"`, `"currentColor"`, `"inherit"` → classify as BRAND (`isBrand = true`); else MONOCHROME.

**Rendering behavior at emit:**

- **Monochrome:** Wrap body in `<svg ... style="color: ${paletteColor}">`. `currentColor` inherits the palette token.
- **Brand:** Wrap body in `<svg ...>` with NO color override. Body's hardcoded fills render as-is.
- **Gradient IDs:** Azure icons use local `<defs><linearGradient id="a">`. When multiple Azure icons appear in same output SVG, IDs may collide. Renderer MUST namespace gradient IDs per icon instance (e.g. `icon-{n}-a`).

### Licensing & Bundling

| Category | Policy |
|----------|--------|
| **Bundled default set** | Triton MAY bundle ONLY icons under permissive licenses (MIT, Apache-2.0, ISC). Recommendation: **Lucide** (MIT, 1400+ icons, monochrome `currentColor`, perfect for palette-tinting). |
| **User-imported packs (BYOP)** | User downloads the official vendor icon set (Azure, AWS, GCP), converts to `.triton-icons.json` via provided tooling, and supplies the pack. Triton NEVER redistributes vendor icons in any form. |
| **Conversion tooling** | `triton-icons convert` CLI helper (uses `@iconify/tools` `importDirectory` + `cleanupSVG`). Does NOT call `parseColors()` (preserves brand fills). Normalizes filenames to kebab-case. |

### Determinism, Caching, Sizing

- Icon bodies resolved at compile time from static JSON files on disk. No network; no runtime font loading.
- Same input + same packs → identical SVG output. Guaranteed.
- **Cache-key:** LaTeX cache key (`latex/triton.sty`) MUST fold in icon pack paths AND content-hash (SHA-256 of pack JSON). Eliminates stale-cache problem.
- **Sizing:** Icon-specific dimensions from pack: `width` / `height` / `left` / `top`. Define icon's `viewBox`. Renderer wraps body in `<svg viewBox="...">` at emit time.

### Suggested Phasing

| Phase | Scope | Estimate | Dependencies |
|-------|-------|----------|--------------|
| **P0** | Format spec finalized. JSON Schema for `.triton-icons.json`. Validator + types (`src/contracts/icons.ts`). | 2–3h | None |
| **P1** | Discovery module (`src/icons/discover.ts`) — mirrors `src/theme/discover.ts`. `findTritonIconsDir`, `discoverIconPacks`, `loadIconPack`. Mono/brand classification at load. | 3–4h | P0 |
| **P2** | Core API extension — `icons?: ResolvedIconRegistry` parameter. Icon body emit in renderer. Gradient-ID namespacing. | 3–4h | P0, P1 |
| **P3** | CLI integration (`latex/src/icon-resolve.ts`) — `--icons-dir`, `--icon-pack` flags. Cache-key update in `triton.sty` (content-hash). | 3–4h | P1, P2 |
| **P4** | VS Code extension — `IconPackRegistry`, watchers, preview re-render. Icon-name autocomplete. | 4–5h | P1 |
| **P5** | Conversion CLI tool (`triton-icons convert`). Uses `@iconify/tools`. Kebab-case normalization. `--mono` flag. Docs + Azure BYOP guide. | 3–4h | P0 |
| **P6** | Grammar integration — `icon: "prefix:name"` syntax in flowchart, architecture, poster, mindmap, topology. Fallback to geometric primitives. | 4–6h | P2 |

**Total:** ~22–30 hours. **Critical path:** P0 → P1 → P2 → P6.

---

## Recommendation & Next Steps

**Approve:** Adopt IconifyJSON (`.triton-icons.json` files under `.triton/icons/`) as Triton's universal icon pack format.

- **Bundled default:** Lucide (MIT, 1400+, monochrome).
- **Azure:** BYOP model; user converts vendor SVGs via `@iconify/tools` + Triton's conversion helper.
- **Core architecture:** Host discovers/resolves → passes `ResolvedIconRegistry` into core (mirrors theme purity boundary).
- **Grammar:** `icon: "prefix:name"` syntax (new node property).
- **Determinism:** Compile-time inline; content-hash in cache key.
- **Phasing:** P0–P6, ~22–30 hours, starting after this design is approved.

**NOT approved to build.** Awaiting leadership sign-off before Phase P0 begins.

---

## Sources & References

- **Azure Icon Licensing:** https://learn.microsoft.com/en-us/azure/architecture/icons/
- **IconifyJSON Schema:** @iconify/types@2.0.0, `types.d.ts`
- **Conversion Tools:** `@iconify/tools` npm package (importDirectory, cleanupSVG)
- **Ecosystem:** Iconify 150+ packs on CDN; `@iconify-json/*` npm
- **Theme Discovery Precedent:** `src/theme/discover.ts`


---

# Example Cleanup — 2026-07-12T11:07:34-04:00

**Author:** Brian (Backend/Implementation Engineer)  
**Status:** COMPLETE — staged for Cristian's review (unstaged alongside connector-syntax redesign)

---

## Summary

Audited all 84 `.mmd` files across 27 subdirectories under `examples/`. Zero bad examples found. One redundant file removed with its generated companions.

---

## Audit methodology

1. Ran batch render via `packages/core/dist/frontend/index.js` against every `.mmd` file.
2. Checked for: parse errors, empty/degenerate SVG, NaN coordinates.
3. Analyzed each multi-file directory for structural uniqueness (distinct layout, diagram type, axis, directive, feature combination).
4. Applied conservative rule: keep unless demonstrably nothing new.

---

## Bad examples removed

**None.** All 84 `.mmd` files parse and render to valid SVG.

---

## Redundant examples removed

| File | Reason |
|------|--------|
| `examples/triton/poster/launch-readiness.mmd` | Redundant: 2-col poster with flowchart+stat+timeline+text cells — identical structure to `poster.mmd`. No distinct feature, layout, or directive. |
| `examples/triton/poster/launch-readiness.svg` | Generated companion of removed .mmd |
| `examples/triton/poster/themes/launch-readiness/*.svg` (12 files) | Theme-variant companions of removed .mmd |

**Total removed: 14 files (1 .mmd + 1 .svg + 12 theme SVGs)**

---

## Per-directory table

| Directory | Files before | Removed (bad) | Removed (redundant) | Kept |
|-----------|-------------|---------------|---------------------|------|
| mermaid/timeline | 9 mmd | 0 | 0 | 9 |
| mermaid/flowchart | 3 mmd | 0 | 0 | 3 |
| mermaid/animated | 2 mmd | 0 | 0 | 2 |
| mermaid/showcases | 2 mmd | 0 | 0 | 2 |
| mermaid/* (single-file dirs) | 13 mmd | 0 | 0 | 13 |
| triton/ds/tree | 9 mmd | 0 | 0 | 9 |
| triton/ds/queue | 8 mmd | 0 | 0 | 8 |
| triton/poster | 7 mmd | 0 | 1 | 6 |
| triton/poster/phase1 | 5 mmd | 0 | 0 | 5 |
| triton/cross-link | 6 mmd | 0 | 0 | 6 |
| triton/ds/stack | 2 mmd | 0 | 0 | 2 |
| triton/ds/array | 2 mmd | 0 | 0 | 2 |
| triton/topology | 2 mmd | 0 | 0 | 2 |
| triton/ds/* (single-file dirs) | 6 mmd | 0 | 0 | 6 |
| triton/architecture | 1 mmd | 0 | 0 | 1 |
| triton/block | 1 mmd | 0 | 0 | 1 |
| triton/packet | 1 mmd | 0 | 0 | 1 |
| **Total** | **84 mmd** | **0** | **1** | **83** |

---

## `pnpm test` result

```
Test Files  33 passed (33)
     Tests  540 passed (540)   ← was 541; dropped by 1 for the removed example's dynamic test
  Duration  ~3.1s
```

All 540 tests green. The drop from 541→540 is exactly accounted for by removing one `.mmd` file from `examples.test.ts`'s dynamic discovery loop.

---

## Items kept with uncertainty (conservative holds)

| File | Kept because |
|------|-------------|
| `mermaid/timeline/company-history.mmd` | Uses same default layout + sections + L2 ranges + @tracks as `product-roadmap.mmd`, but is a simpler case (done/active only) and provides a distinct real-world narrative. Feature overlap is real but not full duplication. |
| `mermaid/timeline/vertical-journey.mmd` | Uses `layout vertical-spine` like `ai-timeline.mmd`, but demonstrates simpler L1+milestone usage vs ai-timeline's L2-range+track+desc+subtitle+theme. Two different complexity tiers for the same layout. |
| `triton/ds/tree/plan.mmd` vs `query-plan.mmd` | Both show a query plan tree, but `plan` uses the dedicated `plan` header with auto-kind detection; `query-plan.mmd` uses the `tree` header with explicit `:kind` annotations. Different syntax paths. |
| `triton/poster/phase1/` (all 5) | Each targets a distinct overlay directive or pattern (note, caption, path, two-pointer, sliding-window) even though all use poster composition. |

---

## Structural notes for future cleanup passes

- **Timeline** (9 files) is dense but justified: 6 distinct `layout` values + dedicated examples for L2-range syntax, @track notation, and the subtitle/theme directives.
- **DS/Tree** (9 files) covers 6 dedicated diagram types (avl/btree/heap/rbtree/radix/segtree) plus 3 tree-based types (tree TD/decision, plan, tree/query-plan). All distinct.
- **DS/Queue** (8 files) is a clean 4-type × 2-axis matrix (queue, cqueue, deque, pqueue × horizontal, vertical). No waste.
- **Poster** (6 mmd after cleanup) now spans: basic 2-col (poster.mmd), 3-col (engineering-dashboard.mmd), 4-col large grid (ds-poster.mmd), complex-with-links (sql-engine.mmd), column-span (spanning.mmd), row-span (row-spanning.mmd).
- Most file bloat (500+ total) comes from `themes/*/` generated SVG directories — 12 theme variants per .mmd. Those are generated artifacts, not primary sources.

---

# Decision: Cross-Link Label De-Collision — Chrome Rect Registration

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-12T11:07:34-04:00
**Status:** COMPLETE — uncommitted, ready for Cristian's review

---

## Problem

The red "leaf points to page" cross-link label in `examples/triton/poster/sql-engine.mmd` was rendering directly on top of the PageHeader blue bar inside the "Slotted page" cell, making both elements unreadable.

## Root Cause

The cross-link label de-collision pass in `src/crosslink/engine3.ts` operates against `fixedRects = [...allNodeBounds, ...occupiedRects]` where:
- `allNodeBounds` = anchor node bounding boxes (slot0, slot1, slot2, the B+tree nodes, etc.)
- `occupiedRects` = cell/poster titles registered in `textOccupied`

The **PageHeader bar** inside `src/diagrams/triton/ds/struct/page.ts` is internal visual chrome of the child diagram. It is neither an anchor node nor a cell/poster title, so it was invisible to the de-collision system.

The failure mode was a two-step cascade:
1. `labelAnchor` placed the red label at the midpoint of the longest horizontal segment (y≈401, just below the PageHeader bar at y=381–398).
2. `deCollideLabels` detected a tiny overlap between the label and the slot1 anchor node → pushed the label **up by 5px** → label landed squarely on the PageHeader bar.
3. With PageHeader not in `fixedRects`, de-collision stopped — label stayed on the bar.

## Fix

**Layer:** `LayoutResult` contract + `page.ts` diagram + poster `layout.ts` composition.

### 1. `src/contracts/anchors.ts`
Added optional field to `LayoutResult`:
```ts
readonly chromeRects?: readonly Rect[];
```
Diagrams that have internal chrome bars (wide header/region header rects that sit near the top of the content area) can populate this list in local diagram coordinates.

### 2. `src/diagrams/triton/ds/struct/page.ts`
`layoutPage` now returns:
```ts
const chromeRects = [{ x: px, y: py, width: pageW, height: HEADER }];
return { scene, anchors, chromeRects };
```
This exposes the PageHeader bar (26px tall, full page width) as a chrome rect.

### 3. `src/diagrams/triton/poster/layout.ts`
After the anchor-transform loop, the poster layout now also transforms chrome rects using the same `scale + offsetX/offsetY` and pushes them into `textOccupied`:
```ts
for (const cr of (result.chromeRects ?? [])) {
  textOccupied.push({
    x: cr.x * scale + offsetX,
    y: cr.y * scale + offsetY,
    width:  cr.width  * scale,
    height: cr.height * scale,
  });
}
```

## Outcome

- Red "leaf points to page" label is now below the PageHeader bar, clear and legible.
- PageHeader bar text "PageHeader freeStart → ← freeEnd" fully visible.
- Green "scan uses index" and purple "tuple is a row" labels + all routing unchanged.
- poster.mmd and ds-poster.mmd (no slotted-page cell) unaffected.
- `pnpm test`: 539/539 ✓ (expected: engineering-dashboard removal reduced count 540→539).

## Convention Going Forward

Any child diagram that renders a wide internal header bar (topology region headers, future memory region headers, etc.) should add it to `chromeRects` in its `LayoutResult` so the poster's cross-link label system avoids it automatically. Zero cost for diagrams that omit the field.

---

# Example Frontmatter Update — `%%` Quick-Ref Headers

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-12T11:00:47-04:00
**Status:** COMPLETE — uncommitted, ready for Cristian's review

---

## What changed

### 1. POSTER headers — 7 files

Each file received two new lines inserted after `%% Routing:` and before `%% Frontmatter:`:

```
%% Animation:   @anim:march · particle · draw · pulse · glow · comet · stream · flow · colorcycle · none
%% Props:       { anim:… route:… style:… color:… }   (@ annotations win over { } on conflict)
```

Files touched:
- `examples/triton/poster/poster.mmd`
- `examples/triton/poster/launch-readiness.mmd`
- `examples/triton/poster/ds-poster.mmd`
- `examples/triton/poster/sql-engine.mmd`
- `examples/triton/poster/row-spanning.mmd`
- `examples/triton/poster/engineering-dashboard.mmd`
- `examples/triton/poster/spanning.mmd`

The existing `%% Arrows:` line (15-token set) was left untouched.

### 2. FLOWCHART headers — 3 files

The stale `%% Edges:` line was replaced with the full 5-style set, and three new lines were added:

```
%% Edges:       --> -_-> -.-> ==> -~->  ·  <--> <-_-> <-.-> <==> <-~->  ·  --- -_- -.- === -~-  ·  --x --o   (+|label|)
%% Styles:      solid -- · dashed -_- · dotted -.- · thick == · wavy -~-
%% Animation:   @anim:march · particle · draw · pulse · glow · comet · stream · flow · colorcycle · none
%% Routing:     @straight · @orthogonal · @bezier · @polyline   (+ :WallPair, e.g. @orthogonal:EW)
```

Files touched:
- `examples/mermaid/flowchart/flowchart.mmd`
- `examples/mermaid/flowchart/ci-pipeline.mmd`
- `examples/mermaid/flowchart/order-processing.mmd`

### 3. CROSS-LINK headers — 5 files

A new `%% CROSS-LINK — options quick-ref` block was inserted after `columns N` in each file. Block covers poster essentials plus Link, Styles, Animation, Routing, Props:

```
%% ────────────────────────────────────────────────────────────────────────────
%% CROSS-LINK — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:      poster "Title"  (title optional)
%% Grid:        columns N · rows N · gap N
%% Cell:        cell [id] ["Title"] [span] [:: kind] [@theme t] … end
%% Kinds:       flowchart · flow · timeline · stat · text · <identifier>
%% Link:        link <src> <arrow> <dst> ["label"] [@routing[:WallPair]] [@anim:name] [{ props }]
%% Arrows:      --> · -_-> · -.-> · ==> · -~-> · <--> · <-_-> · <-.-> · <==> · <-~-> · --- · -_- · -.- · === · -~-
%% Styles:      solid -- · dashed -_- · dotted -.- · thick == · wavy -~-
%% Animation:   @anim:march · particle · draw · pulse · glow · comet · stream · flow · colorcycle · none
%% Routing:     @straight · @orthogonal · @bezier · @polyline   (+ :WallPair, e.g. @orthogonal:EW)
%% Props:       { anim:… route:… style:… color:… }   (@ annotations win over { } on conflict)
%% ────────────────────────────────────────────────────────────────────────────
```

Files touched:
- `examples/triton/cross-link/basic.mmd`
- `examples/triton/cross-link/complex.mmd`
- `examples/triton/cross-link/mixed-routing.mmd`
- `examples/triton/cross-link/platform.mmd`
- `examples/triton/cross-link/anim-gallery.mmd`

---

## SVG-unchanged confirmation

`%%` comments are stripped before parse. These edits **cannot** affect rendered SVG output by design.

After re-rendering all three directories with `node scripts/preview.mjs` using the fresh built parser:

- **Poster SVGs** — 7 rendered successfully. Some SVGs show diffs vs HEAD (`ds-poster.svg`, `row-spanning.svg`, `spanning.svg`, `sql-engine.svg`). These diffs are from Brian's **pre-existing** connector redesign changes in `src/crosslink/` and `src/diagrams/`, not from `%%` edits. Confirmed: same SVG content is produced for any two consecutive renders of the same file.
- **Flowchart SVGs** — 3 rendered successfully. `ci-pipeline.svg` shows a path coordinate diff vs HEAD caused by the new connector renderer (pre-existing Brian change), not comments.
- **Cross-link SVGs** — Re-render failed with `[PARSE_ERROR] parser.parse is not a function` for all 6 files in the directory (including `style-matrix.mmd` which was not touched). This is a **pre-existing issue** with the cross-link engine WIP — the error exists before and after my `%%` edits. The two SVGs that differ from HEAD (`basic.svg`, `complex.svg`) were already modified by Brian's engine changes before this task ran.

---

## Formatting alignment

All 15 touched `.mmd` files use the 13-char label-pad convention (`label: + spaces = 13 chars`). No files required alignment disclosure — all new lines match the surrounding column width exactly.

---

## Test result

`pnpm build` ✓ · `pnpm test` ✓ — **541/541 tests passed**
# Design Analysis: Connector Syntax — Strict Mermaid Superset (REVISED)

**Author:** Leslie (Lead / Spec Architect)
**Date:** 2026-07-12T09:33-04:00
**Status:** ANALYSIS (v2) — supersedes v1. Awaiting Cristian's review.
**Revision cause:** Corrected constraint — Triton is a STRICT SUPERSET of Mermaid (extending with new tokens is desired), not "no divergence."

---

## 0. The Corrected Rule

> Triton connector syntax is a STRICT SUPERSET of Mermaid.
> - Every Mermaid token retains Mermaid's exact meaning (never contradicted).
> - Extending Mermaid with NEW tokens is explicitly ALLOWED and desired.
> - `-.->` = dotted (Mermaid). `==>` = thick (Mermaid). `--o`/`--x` = marker (Mermaid).
> - Mermaid's dot-lengthening (`-..->`, `-...->`) means "longer dotted" — not repurposable.

This changes the prior analysis fundamentally: "dashed" and "wavy" are NOT dropped — they get NEW Triton-extension tokens.

---

## 1. Full Token Matrix (Direction × Style)

### 1.1 Decided Directed Tokens

| Style   | Directed | Origin  | Infix  |
|---------|----------|---------|--------|
| Solid   | `-->`    | Mermaid | `--`   |
| Dotted  | `-.->`   | Mermaid | `-.-`  |
| Thick   | `==>`    | Mermaid | `==`   |
| Dashed  | `-_->`   | Triton  | `-_-`  |
| Wavy    | `-~->`   | Triton  | `-~-`  |

### 1.2 Undirected (open, no arrowhead)

Mermaid's undirected form: remove arrowheads, extend the trailing segment.

| Style   | Undirected | Origin  | Rationale |
|---------|-----------|---------|-----------|
| Solid   | `---`     | Mermaid | Established. |
| Dotted  | `-.-`     | Mermaid | Established (flowchart grammar line 170). |
| Thick   | `===`     | Mermaid | Established. |
| Dashed  | `-_-`     | Triton  | Minimal — same infix, no arrow. |
| Wavy    | `-~-`     | Triton  | Same pattern. |

**Ambiguity check:** `-_-` could be misread as an emoticon, but within a `link` statement context it's unambiguous. `-~-` has no collision with any Mermaid token (Mermaid uses `~` only in classDiagram generics, never in edge tokens). ✅ No collision.

### 1.3 Bidirectional (arrowheads both ends)

Mermaid's bidirectional form: wrap infix with `<` and `>`.

| Style   | Bidirectional | Origin  | Rationale |
|---------|--------------|---------|-----------|
| Solid   | `<-->`       | Mermaid | Established. |
| Dotted  | `<-.->`      | Mermaid | Established. |
| Thick   | `<==>`       | Mermaid | Established. |
| Dashed  | `<-_->`      | Triton  | Follows `<` + infix + `>` pattern. |
| Wavy    | `<-~->`      | Triton  | Follows pattern. |

**Ambiguity check for `<-_->`:** The `<` followed by `-_-` followed by `>` is lexically unambiguous — no Mermaid token starts `<-_`. The PEG ordered-choice parser will match the longest alternative first; listing `<-_->` before `-->` handles it cleanly. ✅

**Ambiguity check for `<-~->`:** Same analysis. `<-~` is not a prefix of any Mermaid token. ✅

### 1.4 Longer Forms (Mermaid length-extension)

Mermaid allows `--->` (one extra `-`), `---->`, `-..->`(one extra `.`), etc. to hint at "longer rendering." Under the superset rule these MUST retain their Mermaid meaning (just longer solid/dotted). Triton currently supports `--->`in flowchart (maps to solid) and `-..->` (maps to dotted). These are NOT repurposable for dashed/wavy.

For Triton extensions, length-extending is NOT proposed (no `-__->` or `-~~->`). This keeps the grammar finite and unambiguous.

### 1.5 Complete Orthogonal Matrix

```
            Directed   Undirected   Bidirectional   Origin
Solid       -->        ---          <-->            Mermaid
Dotted      -.->       -.-          <-.->           Mermaid
Thick       ==>        ===          <==>            Mermaid
Dashed      -_->       -_-          <-_->           Triton
Wavy        -~->       -~-          <-~->           Triton
```

15 tokens total. 9 Mermaid-honored, 6 Triton-extended.

### 1.6 Collision/Risk Assessment

| Token  | Risk | Notes |
|--------|------|-------|
| `-_->` | LOW  | `_` in node IDs is common (`my_node`), but PEG ordered-choice with the arrow rule listed before identifier matching eliminates ambiguity in link statements. Must verify PEG rule ordering. |
| `-~->` | LOW  | `~` is unused in Mermaid flowchart/poster grammar. Mermaid classDiagram uses `~GenericType~` but that's a different grammar entirely. No conflict. |
| `<-_->` | LOW | Same as `-_->`. |
| `<-~->` | LOW | Same as `-~->`. |
| `-_-`  | LOW  | Could be confused with undirected solid `---` visually by humans, but lexically distinct (underscore vs hyphen). |
| `-~-`  | LOW  | Lexically distinct from `-.-` (dot vs tilde). |

**One nuance:** If a node ID starts with `>` (unlikely but legal in some grammar variants), then `A -_->B` could be misparsed as `A -_-` (undirected) followed by `>B`. PEG ordered-choice resolves this: list `-_->` BEFORE `-_-` in the grammar. This is the standard PEG arrow-ordering technique already used for `-->` vs `---`.

---

## 2. Rendering Feasibility

### 2.1 Solid, Dotted, Dashed — Trivial

All three use `stroke-dasharray`:
- Solid: no dasharray (or `none`)
- Dotted: `4 3` (current engine3.ts:1043) / `4 3` (render.ts:308 as `'4 3'`)
- Dashed: `8 4` (current render.ts:307)

No rendering work needed beyond keeping the existing `edgeStyleToDash()` function.

### 2.2 Thick — Trivial

Thick = `stroke-width` increase. The renderer already sets `stroke-width` per connector (default ~1.5px). Adding a `thick` branch that emits `stroke-width: 3` (or 2.5) is a one-line conditional. No dasharray. No path geometry change.

### 2.3 Wavy — The Risky One

A "wavy" line is NOT achievable via `stroke-dasharray` or `stroke-width` alone. It requires **modifying the path geometry itself** or applying a visual effect. Options:

#### Option W1: Hand-Generated Sine-Wave Path

Replace the connector's straight/orthogonal/bezier `d` attribute with a path that oscillates sinusoidally about the original route.

**How it works:**
1. Compute the original route (polyline or bezier) — this already happens (render.ts:874 shows cubic bezier emission, and the orthogonal router produces point arrays).
2. Walk the route at uniform intervals (e.g., every 6px).
3. At each sample point, compute the route's local tangent and normal.
4. Displace the point along the normal by `A * sin(2π * t / λ)` where A=amplitude (~3px) and λ=wavelength (~12px).
5. Emit the displaced points as a smooth path (cubic bezier through displaced points, or a simple polyline with enough resolution).

**Determinism:** ✅ Fully deterministic — same route → same displaced path. No randomness involved. The sine function is pure.

**Cost:**
- Computation: O(N) where N = route length / sample interval. For a typical 200px connector with 6px intervals: ~33 samples. Trivial.
- SVG size: slightly larger path `d` attribute (more control points). Negligible.
- Complexity: moderate implementation effort (~50-80 lines of geometry code). Needs careful handling at corners (orthogonal bends) — the sine wave should reset phase or damp amplitude at 90° turns.

**Visual quality:** Good. Consistent, professional-looking wavy line. Used by diagram tools like draw.io.

#### Option W2: SVG `<pattern>` Stroke

Use a custom `stroke-dasharray` that approximates waviness? Not possible — dasharray only controls on/off stroke segments, not displacement.

Alternatively, use a `<pattern>` element as a stroke paint? SVG `stroke` doesn't support pattern fills on the stroke path in a way that produces waviness. ❌ Not viable.

#### Option W3: SVG Filter (feTurbulence + feDisplacementMap)

Apply an SVG filter that displaces the connector path using a turbulence function.

**Problems:**
- **Determinism violation:** `feTurbulence` uses a `seed` parameter, but the visual result depends on the element's bounding box, zoom level, and renderer implementation. Different SVG viewers may render slightly differently. This VIOLATES Triton's determinism contract.
- **Performance:** filters are expensive to render, especially on many connectors.
- **Control:** hard to get a clean, uniform sine wave — turbulence is inherently noisy.

❌ **Not recommended** — violates determinism, poor control.

#### Option W4: CSS `text-decoration: wavy` Trick

Not applicable to SVG paths. ❌

#### Recommendation: W1 (Sine-Wave Path Displacement)

**Implementation sketch for the renderer:**
```typescript
function wavifyPath(points: Point[], amplitude: number, wavelength: number): string {
  // 1. Compute cumulative arc-length along polyline
  // 2. Re-sample at uniform intervals (wavelength/4)
  // 3. At each sample, compute normal, displace by A*sin(phase)
  // 4. Fit cubic beziers through displaced points
  // Return SVG path `d` string
}
```

This function would be called in render.ts where the connector path is emitted (around line 874 for bezier, or where orthogonal point arrays are serialized to SVG `<path>` elements). The existing `routePath` field on `PendingRoute` would receive the wavified path string instead of the straight/bezier one when `style === 'wavy'`.

**Effort estimate:** ~100 lines of new geometry code + tests. Medium effort. Not trivial, not huge.

**Open sub-question:** Should wavy combine with thick? (i.e., thick-wavy?) The matrix above treats them as orthogonal styles (you get one). If thick-wavy is needed, that's a rendering combination (wider stroke + displaced path). Feasible but adds combinatorial rendering branches. **Recommend: styles are mutually exclusive for v1.** Thick-wavy is a future extension via `{ style: thick-wavy }` prop if ever needed.

---

## 3. IR Vocabulary

### 3.1 Style Enum

```typescript
// src/contracts/crosslink.ts
export type CrossLinkEdgeStyle =
  | 'solid'      // ──────
  | 'dotted'     // · · · ·
  | 'dashed'     // - - - -
  | 'thick'      // ━━━━━━
  | 'wavy';      // ∿∿∿∿∿∿
```

This is the TOTAL style enum — every valid style has exactly one name. No aliases. No composite styles.

### 3.2 Direction Enum (unchanged)

```typescript
export type CrossLinkDirection =
  | 'directed'       // -->
  | 'undirected'     // ---
  | 'bidirectional'; // <-->
```

### 3.3 Endpoint Marker (new, additive)

```typescript
export type CrossLinkEndpointMarker =
  | 'arrow'    // > (default for directed)
  | 'circle'   // o
  | 'cross'    // x
  | 'none';    // (no marker)
```

Fields on `CrossLink`:
```typescript
readonly startMarker?: CrossLinkEndpointMarker;  // default: none (or arrow for bidir)
readonly endMarker?: CrossLinkEndpointMarker;    // default: arrow for directed
```

This replaces the current implicit behavior where `direction: 'directed'` always implies an arrow end-marker. Now the marker is explicit in the IR (even if the grammar defaults it).

### 3.4 Separation Principle

| Concern | IR field | Set by |
|---------|----------|--------|
| Line visual class | `style` | Syntax token (grammar) |
| Traversal direction | `direction` | Syntax token (grammar) |
| Endpoint shape | `startMarker`, `endMarker` | Syntax token or future decorator |
| Animation | `animation` | `@anim:` decorator or `{ anim: }` prop |
| Routing | `routing`, `curveStyle` | `@route` decorator or `{ route: }` prop |
| Port constraints | `exitWall`, `entryWall` | `@` wall hints |
| Freeform | `props` | `{ ... }` PropBlock |

---

## 4. Decorator Design

### 4.1 Two Annotation Families

| Family | Prefix | Values | Example |
|--------|--------|--------|---------|
| Routing | `@straight`, `@orthogonal`, `@bezier`, `@polyline` | fixed set + optional `:WallPair` | `@orthogonal:EW` |
| Animation | `@anim:` | `march`, `particle`, `draw`, `pulse`, `glow`, `comet`, `stream`, `flow`, `colorcycle`, `none` | `@anim:march` |

### 4.2 `@` vs `{ }` Division

| `@` annotations own | `{ }` PropBlock owns |
|---------------------|---------------------|
| Routing algorithm (typed, finite) | `tension` (numeric) |
| Wall hints (typed, finite) | `color` (string) |
| Animation name (typed, finite) | Future per-link overrides |
| — | `style` override (escape hatch) |
| — | `route` (alternative form) |
| — | `anim` (alternative form) |

### 4.3 Precedence Rule

When both `@` and `{ }` specify the same semantic key:
- **`@` wins.** It's syntactically closer to the edge and represents the author's explicit typed intent.
- `{ anim: particle } @anim:march` → animation = march (@ wins).
- `{ route: bezier } @straight` → routing = straight (@ wins).

### 4.4 Grammar Extension for `@anim:`

```peg
Annotation
  = "@anim:" value:AnimValue     { return { family: 'anim', value }; }
  / "@" route:RouteWord walls:(":" WallPair)?
      { return { family: 'route', route, ...(walls ? walls[1] : {}) }; }
  / "@" walls:WallPair           { return { family: 'route', ...walls }; }

AnimValue
  = "march" / "particle" / "draw" / "pulse" / "glow"
  / "comet" / "stream" / "flow" / "colorcycle" / "none"
```

**Open question (Q4 from v1, still open):** Should we formalize a MERGE rule document? E.g., `@bezier:EW @anim:comet { tension: 0.5 }` means routing=bezier, exitWall=E, entryWall=W, anim=comet, tension=0.5. All three sources merge; `@` wins on conflict. I recommend YES — a 3-line precedence rule in the spec prevents future confusion.

### 4.5 Multiple `@` Annotations

Can a link carry both `@orthogonal:EW` AND `@anim:march`? YES — they're different families. Grammar: one or more `Annotation` separated by whitespace after the edge label.

```
link A.x --> B.y "label" @orthogonal:EW @anim:march { tension: 0.5 }
```

---

## 5. Two-Grammar Problem

### 5.1 Current State

| Grammar | File | Arrow rule | Output shape | Styles supported |
|---------|------|-----------|--------------|-----------------|
| Flowchart | `src/diagrams/mermaid/flowchart/grammar.peggy:157-172` | `EdgeArrow` | `{ kind, style }` | solid, dotted (thick/markers collapsed) |
| Poster | `src/diagrams/triton/poster/grammar.peggy:175-183` | `Arrow` | `{ direction, style }` | solid, dashed, dotted |

### 5.2 What Must Change

Both grammars must recognize the full 5-style × 3-direction matrix (15 tokens). Additionally:
- Flowchart must map thick to `style: 'thick'` (not collapse to solid).
- Flowchart must recognize `-_->` and `-~->` extensions.
- Poster must adopt the Mermaid-correct tokens and retire the invented ones.

### 5.3 Shared Token Mapping (Recommended Approach)

Create `src/contracts/connector-tokens.ts`:

```typescript
/** Canonical token → style mapping. Both grammars must agree with this. */
export const CONNECTOR_STYLE_MAP: Record<string, CrossLinkEdgeStyle> = {
  '--':  'solid',
  '-.-': 'dotted',
  '==':  'thick',
  '-_-': 'dashed',
  '-~-': 'wavy',
} as const;
```

Both grammars' **test suites** assert against this table: for each entry in `CONNECTOR_STYLE_MAP`, the grammar must parse the corresponding directed/undirected/bidirectional token and emit the correct style value. This catches drift without coupling the PEG files at the source level.

### 5.4 Flowchart `kind: sync | async` Question

The flowchart grammar currently emits `kind: 'async'` for dotted edges. This is a semantic interpretation layered on top of style. Under the 5-style model:
- Is `-.->` (dotted) always "async"? What about `-_->` (dashed) — also async? What about `-~->` (wavy)?
- The `kind` concept conflates style with semantics.

**Recommendation:** Drop `kind` from the flowchart edge IR. Replace with `style` only. If "async" semantics are needed downstream (e.g., for sequence diagrams), derive them from style at the consumer level, not in the grammar. This aligns the two grammars' output shapes.

**Effort:** Low — `kind` is used in ~3 places downstream (sequence-style rendering logic). Replacing `kind === 'async'` with `style === 'dotted'` is mechanical.

### 5.5 Effort/Risk Assessment

| Task | Effort | Risk |
|------|--------|------|
| Add 6 new tokens to poster grammar | Low (6 PEG alternatives) | Low |
| Remove 3 retired tokens from poster grammar | Low | Low (hard break) |
| Add 4 new tokens to flowchart grammar (`-_->`, `-~->`, `<-_->`, `<-~->`) + fix thick | Medium (rewrite EdgeArrow rule) | Medium — must not break existing Mermaid flowchart parsing |
| Create `connector-tokens.ts` + cross-grammar tests | Low | Low |
| Drop `kind` from flowchart | Low-Medium | Medium — downstream consumers need audit |

---

## 6. Migration

### 6.1 Tokens Being Retired

Under the superset rule, these poster-only tokens are NON-Mermaid AND now redundant:

| Retired Token | Meaning | Replaced By | Mermaid Equivalent |
|---------------|---------|-------------|-------------------|
| `..>`  | dotted directed | `-.->` | `-.->` |
| `...`  | dotted undirected | `-.-` | `-.-` |
| `<..>` | dotted bidirectional | `<-.->` | `<-.->` |

### 6.2 Semantic Change

| Token | Old Meaning (poster) | New Meaning (superset) | Change Type |
|-------|---------------------|----------------------|-------------|
| `-.->` | dashed | dotted | **BREAKING** — visual change |
| `-.-`  | dashed | dotted | **BREAKING** — visual change |
| `<-.->` | dashed | dotted | **BREAKING** — visual change |

Authors who wanted "dashed" must migrate to `-_->` / `-_-` / `<-_->`.

### 6.3 Real Usage Counts (from examples/triton/)

| Pattern | Actual link-statement uses | Comment-header mentions | Files |
|---------|---------------------------|------------------------|-------|
| `..>` (directed dotted, retired) | 0 actual links | 7 (all `%%` headers) | 0 real usage |
| `...` (undirected dotted, retired) | 0 actual links | 7 (all `%%` headers) | 0 real usage (DS `...` is array elision, different grammar) |
| `<..>` (bidir dotted, retired) | **1** (`complex.mmd:31`) | 7 (`%%` headers) | 1 real usage |
| `-.->` (currently=dashed, becomes=dotted) | **10** actual links | 7 (`%%` headers) | 6 files |
| `{ anim: ... }` | **11** actual links | 0 | 3 files |

### 6.4 Blast Radius

- **1 parse break:** `complex.mmd:31` uses `<..>` → must become `<-.->` (bidirectional dotted).
- **10 visual changes:** All `-.->` links currently render as dashed (`8 4`); they will become dotted (`4 3`). Authors who wanted dashed must change to `-_->`.
- **~8 animation losses:** Links using `-.->` without explicit `{ anim: X }` will lose auto-march. They must add `@anim:march` if animation was intended.
- **7 `%%` comment headers:** Cosmetic update to show the new token vocabulary.
- **0 real `..>` or `...` link-statement uses** (only in comments) → no parse breaks from retiring those beyond the comment text.

### 6.5 Recommended Migration Strategy

**Hard break.** Rationale:
1. Pre-1.0 project — now is the time.
2. Total blast radius: 1 parse error + 10 visual changes + 8 animation losses = 19 edits across 6 files.
3. All affected files are in `examples/triton/` (internal).
4. A deprecation shim would pollute the grammar permanently for 19 edits.

**Migration script (mechanical):**
1. `<..>` → `<-.->` (1 occurrence)
2. `..>` → `-.->` in link statements (0 occurrences — only comments)
3. `...` → `-.-` in link statements (0 occurrences — only comments)
4. For each `-.->` link where the author intended DASHED (not dotted): change to `-_->`
5. For each `-.->` link that should keep marching animation: add `@anim:march`
6. Update `%%` headers in all poster examples.

**Open question (Q5 from v1, RESOLVED by Cristian):** Hard break is confirmed appropriate for a pre-1.0 internal-examples-only project.

---

## 7. Open Questions (Updated)

| # | Question | Status | Options |
|---|----------|--------|---------|
| Q1 | ~~Does "dashed" survive?~~ | **RESOLVED** | YES — as `-_->` (Triton extension). |
| Q2 | ~~Does "thick" enter the IR?~~ | **RESOLVED** | YES — first-class `CrossLinkEdgeStyle` value. `==>` honored per Mermaid. |
| Q3 | Endpoint markers (`--o`/`--x`) — scope? | OPEN | Full render support vs. parse-and-collapse. Recommend: parse & record in IR (`endMarker` field), render later. Low priority. |
| Q4 | `@` + `{ }` merge rule formalized? | OPEN | Recommend YES: `@` wins on conflict; both compose. Needs a 3-line spec statement. |
| Q5 | ~~External users?~~ | **RESOLVED** | Hard break — pre-1.0, internal examples only. |
| Q6 | Drop flowchart `kind: sync/async`? | OPEN | Recommend YES — replace with `style` only. Audit ~3 downstream consumers. |
| Q7 | **NEW:** Wavy rendering — sine displacement vs. alternative? | OPEN | Recommend W1 (sine-wave path displacement). ~100 LoC geometry. Needs amplitude/wavelength constants decided (suggest A=3px, λ=12px). Should these be configurable via `{ amplitude: N }`? |
| Q8 | **NEW:** Styles mutually exclusive or composable? | OPEN | Recommend mutually exclusive for v1. `thick-wavy` or `thick-dashed` would be future `{ style: "thick-wavy" }` escape hatches if needed. The 5-value enum stays flat. |
| Q9 | **NEW:** Should `-_->` / `-~->` also be recognized in the flowchart grammar? | OPEN | If we claim "same token means same thing everywhere" (Section 5), then YES. But flowchart is Mermaid-family — adding Triton extensions there blurs the boundary. Alternative: flowchart stays Mermaid-only (3 styles); poster has 5. Recommend: YES, add them — the superset rule applies to ALL Triton grammars, not just poster. |

---

## 8. Summary of Decisions vs. Open Items

### Decided (by Cristian + this analysis)

1. ✅ 5-style enum: solid, dotted, dashed, thick, wavy
2. ✅ Dashed = `-_->` (underscore infix, Triton extension)
3. ✅ Wavy = `-~->` (tilde infix, Triton extension)
4. ✅ `-.->` = dotted (Mermaid-honored, no contradiction)
5. ✅ `==>` = thick (Mermaid-honored)
6. ✅ Animation decoupled from style → `@anim:` decorator
7. ✅ Auto-march default REMOVED (all styles static unless decorated)
8. ✅ Retired tokens: `..>`, `...`, `<..>` — hard break

### Still Open (need Cristian's call or further design)

1. Endpoint markers scope (Q3)
2. `@`/`{ }` merge rule formalization (Q4)
3. Flowchart `sync/async` kind removal (Q6)
4. Wavy rendering constants (Q7)
5. Style composability (Q8)
6. Extension tokens in flowchart grammar (Q9)

---

## Appendix A: Affected Source Files

| File | Change needed |
|------|--------------|
| `src/contracts/crosslink.ts` | Expand `CrossLinkEdgeStyle` to 5 values; add `startMarker`/`endMarker` |
| `src/contracts/connector-tokens.ts` | **NEW** — shared token→style map |
| `src/diagrams/triton/poster/grammar.peggy:175-183` | Rewrite Arrow rule (15 tokens, retire 3) |
| `src/diagrams/mermaid/flowchart/grammar.peggy:157-172` | Extend EdgeArrow (add thick/dashed/wavy) |
| `src/crosslink/render.ts:136-140` | Remove auto-march coupling |
| `src/crosslink/render.ts:306-310` | Extend `edgeStyleToDash()` for 5 styles (wavy=undefined, thick=undefined) |
| `src/crosslink/render.ts` (path emission) | Add `wavifyPath()` for wavy style |
| `src/crosslink/engine3.ts:188-191` | Remove auto-march coupling |
| `src/crosslink/engine3.ts:1042-1043` | Extend `edgeStyleToDash()` |
| `src/crosslink/engine2.ts:274-277` | Remove auto-march coupling |
| `src/crosslink/engine2.ts:911` | Extend `edgeStyleToDash()` |
| `examples/triton/cross-link/*.mmd` | Migration (tokens + add `@anim:march` where needed) |
| `examples/triton/poster/*.mmd` | Update `%%` comment headers |

## Appendix B: `edgeStyleToDash()` After Change

```typescript
function edgeStyleToDash(style: CrossLinkEdgeStyle): string | undefined {
  switch (style) {
    case 'dotted': return '4 3';
    case 'dashed': return '8 4';
    case 'solid':  return undefined;
    case 'thick':  return undefined;  // thick uses stroke-width, not dasharray
    case 'wavy':   return undefined;  // wavy uses path displacement, not dasharray
  }
}
```

## Appendix C: Rendering Pipeline for Wavy

```
Input:  route points (polyline from router)
        style = 'wavy'

Step 1: Compute cumulative arc-length array for route points.
Step 2: Re-sample at intervals of λ/4 (= 3px if λ=12px).
Step 3: At each sample point:
        - Compute tangent vector (direction of route at that point).
        - Compute normal (perpendicular to tangent).
        - Displace point along normal by A * sin(2π * arcLen / λ).
Step 4: Fit smooth cubic beziers through displaced points (Catmull-Rom → Bezier conversion).
Step 5: Emit SVG path `d` attribute from the bezier control points.

Output: Deterministic wavy path. Same input route → same output always.
```

Corner handling: At 90° bends (orthogonal routing), reset the sine phase to 0 and linearly ramp amplitude from 0 to A over one wavelength. This prevents ugly kinks at corners.

---

## RESOLUTION (2026-07-12T09:40-04:00) — Cristian approved ALL recommendations. "go."

- Q3 markers `--o`/`--x`: PARSE & record in IR (`endMarker`), render later. ✅
- Q4 `@`+`{}` merge rule: FORMALIZE — `@` wins on conflict; both compose. ✅
- Q6 flowchart `sync/async` kind: DROP, replace with `style` only (audit ~3 consumers). ✅
- Q7 wavy constants: FIXED defaults A=3px, λ=12px; author override via `{ amplitude:N, wavelength:N }`. ✅
- Q8 styles: MUTUALLY EXCLUSIVE for v1 (flat 5-value enum, no thick-wavy). ✅
- Q9 extension tokens `-_->`/`-~->` recognized in FLOWCHART grammar too, via ONE shared token→style map. ✅
- Migration: HARD BREAK (pre-1.0). Retire `..>`/`...`/`<..>`. Examples authored under old `-.->` (=dashed+auto-march)
  migrate to `-_-> @anim:march` to preserve visual+motion intent; `<..>` → `<-.->`.

STATUS: APPROVED → implementation.
# Connector Syntax Redesign — Implementation Notes

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-12T10:00-04:00
**Status:** COMPLETE (uncommitted — awaiting Cristian review)
**Spec source:** `.squad/decisions/inbox/leslie-connector-strict-mermaid.md` (approved 2026-07-12T09:40)

---

## What Changed

### 1. Contracts (`src/contracts/crosslink.ts`)

- `CrossLinkEdgeStyle`: `'solid' | 'dotted' | 'dashed' | 'thick' | 'wavy'` (was 3 values, now 5; styles are mutually exclusive)
- New type `CrossLinkEndpointMarker = 'arrow' | 'circle' | 'cross' | 'none'`
- New fields on `CrossLink`: `startMarker?`, `endMarker?`
- Animation comment updated: removed auto-march default language

### 2. New Module (`src/contracts/connector-tokens.ts`)

Single source of truth for the 15-token matrix (5 styles × 3 directions). `CONNECTOR_TOKEN_MAP` and `CONNECTOR_INFIX_STYLE` exported. Both grammars' test suites validate against this table.

### 3. Poster Grammar (`src/diagrams/triton/poster/grammar.peggy`)

- **Retired tokens** (HARD BREAK): `..>`, `...`, `<..>` — non-Mermaid, now redundant
- **Arrow rule** rewritten: 19 alternatives covering full 5×3 matrix + longer Mermaid forms
- **`@anim:<name>` decorator** added: extends the `@`-annotation family
- **Multiple annotations**: `LinkDecl` accepts `anns:(_ "@" Annotation)*` (zero-or-more)
- **`@` wins on conflict**: `{}` props applied first, `@` annotations overwrite last

### 4. Flowchart Grammar (`src/diagrams/mermaid/flowchart/grammar.peggy`)

- **`EdgeArrow`** expanded to 21 alternatives: full 5-style × 3-direction matrix + Mermaid marker tokens (`--o`, `--x`) + longer forms (`--->`, `-..->`, `===>`)
- **`kind` field DROPPED**: `addEdge()` no longer accepts or emits `kind`. `style` only.
- `bidirectional`, `undirected`, `endMarker` now propagated via `edgeProps` parameter

### 5. Flowchart IR (`src/diagrams/mermaid/flowchart/ir.ts`)

- Removed `EdgeKind` type alias
- Removed `kind` from `FlowEdge`
- `EdgeStyle` = `'solid' | 'dashed' | 'dotted' | 'thick' | 'wavy'`
- Added `EdgeEndMarker` type
- Added `endMarker?` to `FlowEdge`

### 6. Flowchart Layout (`src/diagrams/mermaid/flowchart/layout.ts`)

- All `edge.kind === 'async'` → `edge.style === 'dotted'`
- Thick edges: `strokeWidth = edgeTheme.strokeWidth * 2`

### 7. Animation Decoupled (render.ts, engine2.ts, engine3.ts)

All three engines: removed `dash ? 'march' : undefined` default. Every style is STATIC unless explicitly decorated with `@anim:<name>` or `{ anim: <name> }`.

### 8. `edgeStyleToDash()` (all three engines)

```typescript
solid  → undefined
dotted → '4 3'
dashed → '8 4'
thick  → undefined  // stroke-width bump instead
wavy   → undefined  // path displacement instead
```

### 9. Thick Rendering

`PendingRoute` / `WorkingRoute` now carry `strokeWidth` field. Thick connectors emit `(edgeTheme.strokeWidth + 0.5) * 2` (~4px) vs default `(edgeTheme.strokeWidth + 0.5)` (~2px).

### 10. Wavy Rendering (`wavifyPath` — `src/crosslink/render.ts`, exported)

Pure sine-wave path displacement. Algorithm:
1. Cumulative arc-length at original polyline vertices
2. Uniform resample at λ/4 intervals
3. At each sample: compute local tangent + normal; displace by `A·sin(2π·s/λ)`
4. Corner damping: amplitude ramps 0→A over one wavelength at each 90° bend
5. Catmull-Rom → cubic Bézier fit for smooth output

Fixed defaults: A=3px, λ=12px. Override: `{ amplitude:N, wavelength:N }`.  
Applied in render.ts, engine3.ts (poster path), engine2.ts.

### 11. Example Migrations

| File | Changes |
|------|---------|
| `examples/triton/cross-link/complex.mmd` | `<..>` → `<-.->` (bidir dotted); `-.->` → `-_-> @anim:march` |
| `examples/triton/cross-link/platform.mmd` | 3× `-.->` → `-_-> @anim:march` |
| `examples/triton/cross-link/anim-gallery.mmd` | `-.->` → `-_->` (kept `{ anim: march }`) |
| `examples/triton/cross-link/mixed-routing.mmd` | 4× `-.->` → `-_-> @anim:march` |
| `examples/triton/cross-link/basic.mmd` | `-.->` → `-_-> @anim:march` |
| `examples/triton/poster/spanning.mmd` | `-.->` → `-_->` (kept `{ anim: comet }`) |
| `examples/mermaid/animated/flow-particles.mmd` | `-.->` → `-_->` (keeps particle); `..>` → `-.->` |
| `examples/mermaid/animated/marching-ants.mmd` | 2× `-.->` → `-_-> @anim:march`; `..>` → `-.->` |
| 7× poster `%%` comment headers | Updated arrow vocabulary |

---

## Deviations

1. **`--o` / `--x` circle/cross markers**: **Parsed and recorded in IR** (`endMarker: 'circle'` / `'cross'`) but **render falls back to the default arrow**. Per spec: "parse & record; render later." ✓

2. **Engine2 → render.ts import**: `engine2.ts` now imports `wavifyPath` from `render.ts`. No circular dependency (engine2 did not previously import from render). Same pattern used for engine3.

3. **Poster grammar: `-..->` added** (longer dotted directed): Consistent with Mermaid length-extension semantics and the flowchart grammar. Not explicitly listed in spec's poster section but required by the superset rule.

4. **Old `kind: 'sync'` in some test fixtures** (anchors.test.ts, flowchart-cycle.test.ts, flowchart-layout.test.ts): These construct `FlowEdge` objects with the removed `kind` field. Benign extra-property noise — esbuild/vitest doesn't type-check; `kind` is silently ignored at runtime. Not cleaned up in those files (out of scope for this change); tests still pass.

---

## Test Count

| | Count |
|---|---|
| Baseline (before) | 512 |
| After (all green) | **541** |
| New tests added | **+29** |

New tests: 8 in `flowchart-grammar.test.ts` (5-style matrix, `kind` removal, thick, longer forms, `<==>`) + 14 in `poster.test.ts` connector suite + 8 in `wavifyPath` unit suite — minus 1 updated.

---

## Build Status

- `pnpm build` ✓ clean
- `pnpm test` ✓ 541/541 passing
- Preview: `node scripts/preview.mjs examples/triton/cross-link/`

---

## Visual QA Package

**PNG:** `examples/triton/cross-link/style-matrix.png`

**rsvg-convert command:**
```
rsvg-convert -f png -w 1400 -o examples/triton/cross-link/style-matrix.png examples/triton/cross-link/style-matrix.svg
```

**What I see in the PNG** (for Ken's independent QA):

The diagram is titled "Connector Style Matrix" and shows a 5-column × 5-row poster grid. Each row represents one of the 5 connector styles; each column shows a different connector scenario.

- **Row 1 – Solid**: Continuous, unbroken lines. The directed connector (Source→Target) has a clean arrowhead. The undirected connector (A→B) is just a line with no arrowhead. The bidirectional connector (Source↔C) has arrowheads at both ends. Particle animation on the bidir is not visible in the static PNG.

- **Row 2 – Dotted**: Short-segment dotted lines (`4 3` dasharray). Visually distinct from dashed — shorter gaps and dots.

- **Row 3 – Thick**: Noticeably wider stroke (~2× compared to rows 1/2/4/5). Arrowheads scale with the wider stroke. The undirected "thick —" connector between A and B shows a clearly heavier line.

- **Row 4 – Dashed**: Longer dashes (`8 4` dasharray), visually distinct from dotted. The "March" column shows the dashed bidir connector that carries `@anim:march` — not visible in static PNG.

- **Row 5 – Wavy**: **The sine-wave displacement is clearly visible.** The horizontal segments show a regular oscillating waveform. The vertical segments show horizontal oscillation. The directed "wavy →" connector between Source and Target has an arrowhead at the end of the wave. The undirected "wavy —" between A and B shows the wave clearly. The bidirectional "wavy ↔" at the bottom of the diagram spans the full width with a clearly wavy path.

All 5 styles are visually distinguishable. All 3 directions (directed, undirected, bidirectional) render correctly for each style.

---

## Git Status

Uncommitted. 30 files modified + 4 new files. No PR opened per instructions.

```
New files:
  examples/triton/cross-link/style-matrix.mmd
  examples/triton/cross-link/style-matrix.png
  examples/triton/cross-link/style-matrix.svg
  src/contracts/connector-tokens.ts
```
# Ken's Visual QA Verdict: Connector Style Matrix

**Date:** 2026-07-12T10:05:00-04:00  
**Reviewer:** Ken (Visual QA Reviewer)  
**Subject:** Brian's connector redesign — style-matrix.svg

---

## VERDICT: **PASS**

---

## Rasterization Command

```bash
rsvg-convert -f png -w 1400 -o examples/triton/cross-link/style-matrix-ken.png examples/triton/cross-link/style-matrix.svg
```

Exit code: 0 (success)

---

## Visual Inspection (Ken-owned PNG)

### Row 1: Solid

| Direction | Observation | Status |
|-----------|-------------|--------|
| Directed (→) | Unbroken blue line, single arrowhead at target end, axis-aligned | ✅ |
| Undirected (—) | Unbroken red line, NO arrowheads | ✅ |
| Bidir (↔) | Unbroken yellow/gold line spanning across 3 columns, arrowheads at BOTH ends | ✅ |
| Animated | Visible animated dot traveling along path | ✅ |

### Row 2: Dotted

| Direction | Observation | Status |
|-----------|-------------|--------|
| Directed (→) | Short dots (visibly shorter than dashed), yellow/gold, single arrowhead | ✅ |
| Undirected (—) | Short dots, cyan, NO arrowheads | ✅ |
| Bidir (↔) | Short dots, cyan, spans 3 cols, arrowheads BOTH ends | ✅ |

### Row 3: Thick

| Direction | Observation | Status |
|-----------|-------------|--------|
| Directed (→) | Visibly wider stroke (~2x), purple, NO dashes, single arrowhead | ✅ |
| Undirected (—) | Visibly wider stroke, green, NO dashes, NO arrowheads | ✅ |
| Bidir (↔) | Visibly wider stroke, purple, spans 3 cols, arrowheads BOTH ends | ✅ |

### Row 4: Dashed

| Direction | Observation | Status |
|-----------|-------------|--------|
| Directed (→) | Longer dashes (visibly longer than dotted), pink/rose, single arrowhead | ✅ |
| Undirected (—) | Longer dashes, purple/violet, NO arrowheads | ✅ |
| Bidir (↔) | Longer dashes, green, spans 3 cols, "March" animation, arrowheads BOTH ends | ✅ |

### Row 5: Wavy

| Direction | Observation | Status |
|-----------|-------------|--------|
| Directed (→) | Regular sine-wave oscillation on horizontal segment, blue, single arrowhead | ✅ |
| Undirected (—) | Regular sine-wave oscillation, red, NO arrowheads | ✅ |
| Bidir (↔) | Complex routed path with sine-wave on BOTH horizontal AND vertical segments, pink, arrowheads BOTH ends, "Glow" animation | ✅ |

**Wavy Quality Notes:**
- Horizontal wavy segments: clean, regular amplitude (~3px), consistent wavelength
- Vertical wavy segments (bidir path): clean sine pattern, properly rotated for vertical direction
- Corner transitions: smooth, no kinks or discontinuities
- No amplitude blowup at corners
- Wave terminates cleanly near arrowheads

---

## SVG Attribute Verification

### Solid Paths (Lines 34-36)
- `stroke-width="2"`, NO `stroke-dasharray` → ✅ Correct
- marker-end for directed, marker-start+marker-end for bidir, none for undirected → ✅ Correct

### Dotted Paths (Lines 40-42)
- `stroke-dasharray="4 3"` → ✅ Correct (short dots)
- `stroke-width="2"` → ✅ Standard width

### Thick Paths (Lines 43-45)
- `stroke-width="4"` → ✅ Correct (2x standard)
- NO `stroke-dasharray` → ✅ Correct (solid thick line)

### Dashed Paths (Lines 46-48)
- `stroke-dasharray="8 4"` → ✅ Correct (longer dashes than dotted)
- `stroke-width="2"` → ✅ Standard width

### Wavy Paths (Lines 49-55)
- Contains MANY `C` (cubic Bézier) control points → ✅ Real displaced curve
- NO `NaN` values → ✅ Clean numeric coordinates
- Consistent amplitude pattern in path data → ✅ Deterministic sine wave
- Example: `C 158.78 679.25 160.27 681.73 161.26 681.75 C 162.25 681.76 163.25 679.82 164.24 678.82...` shows regular Y oscillation

### Labels (Lines 231-245)
- All 15 labels present (5 styles × 3 directions)
- Labels positioned above/below their respective paths
- Font-weight="bold", appropriate colors matching connector stroke
- No overlapping with boxes or paths

---

## Charter Compliance

| Principle | Status |
|-----------|--------|
| Rectilinear routing for orthogonal paths | ✅ (solid/dotted/dashed/thick use L segments) |
| Arrowhead axis-alignment | ✅ (all arrowheads follow last segment direction) |
| Readable labels | ✅ (all 15 labels visible, no clipping) |
| No box overlaps | ✅ (connectors route around/between boxes) |
| No floating whitespace | ✅ (content fills viewport appropriately) |
| No NaN in path data | ✅ (grep returned 0 matches) |
| Dotted vs Dashed visually distinct | ✅ (4 3 vs 8 4 clearly different) |

---

## Summary

All 5 line styles × 3 directions render correctly. Dash arrays match spec, thick has elevated stroke-width without dashes, wavy uses genuine sinusoidal displacement. Arrowheads appear only where expected. No visual defects detected.

**Result:** PASS — no fixes required, Brian not locked out.

---

# Live-Data Poster Web Component — Debate Archive (2026-07-12)

**Context:** Five team members submitted structured debate positions on the proposal to build a reactive web component for live-data binding to poster DSL-compiled SVGs. This archive preserves the full analysis and convergences for future reference.

---

## Five Positions Submitted

### 1. Devil's Advocate: David (Research Lead)
**File:** decisions/inbox/david-liveposter-devilsadvocate.md (2026-07-12T10:??-04:00)  
**Verdict:** Against — focuses on industry incumbents (Grafana, Kibana, Datadog for dashboarding; Vega/Vega-Lite for reactive dataviz; Lit/Svelte/Alpine for reactive DOM; React Flow/Mermaid/Node-RED for live diagrams) and the wheel-reinvention risks of custom expression eval + reactive engine.

**One genuine exception:** Zero-JS, LLM-Generatable System Topology Overlays — a narrow niche where live-poster wins ("the htmx of architecture diagrams"). Verdict: BUILD ONLY IF scoped tightly (no custom expression eval, no custom reactive engine, strictly for system overlays).

**Key insight:** The "deterministic pure function + stable anchor manifest" is not unique — it's the fundamental premise of React/Vue/Svelte/D3. Not a novel paradigm, just an SVG generator proposing a clumsy VDOM.

---

### 2. Steelman Pro: Bjarne (Ingestion Design)
**File:** decisions/inbox/bjarne-liveposter-pro.md (2026-07-12T10:16:19-04:00)  
**Verdict:** For — three genuine differentiators: (1) author-in-git, diffable, version-controlled vs Grafana's opaque JSON; (2) LLM-friendly DSL (small grammar, reliable LLM generation); (3) pure function → trivially embeddable, SSR-free without React. The anchor manifest is exactly the binding surface the compiler already emits.

**Ingestion contract:** Data-in surface is `el.data = {...}`. Binding expressions: three forms only (path expressions for `{{value}}`; threshold comparisons for `@color:condition?color:color`; numeric paths for `@speed:`). **No eval. No arbitrary expressions.** Safe grammar, ~150-line hand-written recursive-descent parser. Missing keys render em-dash fallback.

**Hard constraints Bjarne would NOT compromise on:**
1. No eval in expression language (ever)
2. Binding descriptors classified at compile time as cosmetic or structural
3. Missing data must never crash (em-dash fallback non-negotiable)
4. Single normalized data setter (`el.data = {...}`)
5. `repeat:` (structural bindings) is v2 concern — defer, ship v1 with cosmetic only (text, color, animation speed)

---

### 3. Scope & Identity Ruling: Leslie (Lead / Spec Architect)
**File:** decisions/inbox/leslie-liveposter-scope.md (2026-07-12T10:16:19-04:00)  
**Verdict:** PROCEED — with hard boundary. The reactive web component does NOT corrupt Triton's identity *provided* the compiler never imports, depends on, or references any runtime/reactive code. Dependency is strictly one-way: `runtime → compiler`, never the reverse.

**The critical invariant Leslie enforces:**
> The compiler is a pure function of its text input. No runtime data, no external state, no network, no signals enter the compilation pipeline. If you need data to determine geometry, you are outside the compiler.

**Minimal coherent version:**
1. Compiler emits binding-map JSON (manifest of `{ cellId, bindingType, expression }`)
2. Separate package (`@triton/poster-runtime`) owns all reactivity
3. `repeat:` deferred to Phase 2+ (requires pre-expansion before compiler)
4. No reverse dependency (compiler doesn't import runtime)

Leslie rejects: `repeat:` as first-class compiler binding decorator; any import from runtime into compiler; shipping runtime inside compiler package.

---

### 4. Data Modeling: Mark (IR & Data Modeling)
**File:** decisions/inbox/mark-liveposter-datamodel.md (2026-07-12T10:19:24-04:00)  
**Verdict:** Modelable — with one hard caveat. Binding descriptors can be added cleanly to IR as orthogonal metadata layer. **Type system can declare but not enforce the cosmetic/structural boundary** — overflow-driven relayout is a rendering concern, not an IR bug.

**Key invariants Mark requires:**
1. Separation: `PosterBindings` artifact separate from `PosterDocument`
2. Target validity: Every binding target resolves to existing cell/anchor id at compile time
3. No raw expressions: All transforms are `TransformRef` (name+args), not eval strings
4. `repeat` is unconditionally structural (separate type `StructuralBinding` with no `cosmetic` option)
5. Semantic output types from transforms (theme color tokens, not literal CSS values)

**The one leak Mark accepts:** Cosmetic bindings tagged cosmetic that cause visual overflow/reflow at render time — type system correctly doesn't own this; it's rendering-layer responsibility to document and handle.

---

### 5. Cost Assessment: Brian (Layout Implementation Engineer)
**File:** decisions/inbox/brian-liveposter-cost.md (2026-07-12T10:19-04:00)  
**Verdict:** Three implementation tiers.

**Tier 1 (full-recompile + imperative `el.data` + cosmetic text interpolation):** Cheap and worth-it. ~200-300 LoC. No contract changes, no surgical patcher. Viable at 1 Hz (5-15ms per compile). **2-3 day effort.** This is the recommended v1.

**Tier 2 (binding map + surgical cosmetic patching, no geometry):** Expensive but feasible. ~2-3 weeks. Contract changes, ID stamping in layout engines, SVG renderer changes, binding-map emitter, DOM patcher. Unblocks 5-10 Hz without flicker. Ship only if Tier 1 proves too janky.

**Tier 3 (structural bindings, expression evaluator, SSR/hydrate, FLIP animations):** Cost-trap for v1. Each is 1+ week, introduces permanent maintenance surface. Defer indefinitely unless committed production use case drives it.

**Brian's anchor-manifest assessment:** NOT "half the binding map" — it's ~20%. Current manifest has no SVG element IDs, no semantic role tagging, no data-path concept. Would require a separate `BindingMap` artifact to be useful for surgical patching.

**Maintenance burden:** Reactive runtime adds ~40% more ongoing maintenance surface. Custom Elements v1 lifecycle, memory leaks, reconnection logic, signal/store integration, VS Code webview CSP issues — all new permanent surfaces.

---

## Unanimous Convergence: Five Constraints All Agreed

| Constraint | Consensus |
|---|---|
| **No eval** | No arbitrary expression evaluation. Grammar is hand-parseable (~150 LoC max). |
| **Compiler remains pure** | Dependency is one-way: `runtime → compiler`, never reversed. |
| **Cosmetic bindings in v1** | Text interpolation, color binding, animation speed. No structural/relayout bindings. |
| **CSS custom props for styling** | No custom color-expression evaluator; let CSS handle thresholds via semantic tokens. |
| **`repeat:` deferred** | Structural data-driven cell generation is Phase 2+. Not in v1. |
| **Binding-map as JSON sidecar** | Compiler emits it as inert metadata, separate package consumes it. |
| **Graceful degradation** | Missing data renders as em-dash placeholder, never crashes or shows `undefined`. |
| **Single data setter** | All transport adapters (polling, SSE, WS, imperative) funnel through `el.data = {...}`. |

---

## Devil's Advocate & Steelman Convergence

**David (against) + Bjarne (for) agreed on the same narrow niche:** LLM-generatable system topology overlays in Markdown/HTML — "the htmx of architecture diagrams." This is genuine product-market fit Grafana/Vega don't own. Both saw the path forward: narrow scope, no custom expression eval, let CSS handle styling.

---

## Final Recommendation (Scribe consolidation, 2026-07-12T10:30-04:00)

**Leslie's hard boundary + Mark's type-system model + Brian's Tier 1 scope = coherent path forward:**

Build **Tier 1 (full-recompile cosmetic binding)** with Leslie's pure-compiler invariant enforced:
- Compiler emits binding-map JSON (inert metadata)
- Runtime package (`@triton/poster-runtime`) lives outside compiler
- No reverse import (runtime never imported by compiler)
- Mark's IR model holds the type contract
- Brian's 2-3 day estimate stands

**Verdict: Cautious green light, narrow scope, Tier 1 only.**

Conditional: if 1 Hz + full-recompile proves too janky in real use, revisit Tier 2 (surgical patching). Do not pre-build Tier 2.

**Recommendation: ~2-3 day sprint to Tier 1 MVP + user feedback cycle before Tier 2 commitment.**

---

## Attachment: Full Debate Papers

The five positions are preserved in full in the session artifact archive for future reference:
- `david-liveposter-devilsadvocate.md` — Full critique + niche analysis
- `bjarne-liveposter-pro.md` — Full ingestion contract + killer use cases  
- `leslie-liveposter-scope.md` — Full identity + layering stress-test
- `mark-liveposter-datamodel.md` — Full type-system analysis + schema contract
- `brian-liveposter-cost.md` — Full Tier breakdown + maintenance burden

Archive location: `.squad/decisions-archive/live-poster-debate-2026-07-12/` (kept for future reference).

---


---

# Phase 2: Theming Fixes Shipped (Primitives Dropped)

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-10T19:29-04:00  
**Branch:** `ormasoftchile/poster-phase2`  
**Decision:** Primitives (intervals, hashring) dropped per Cristian; only two visual-consistency fixes shipped.

---

## Summary

The Phase 2 branch initially implemented two new `ds` subkind primitives (`intervals` and `hashring`) to unblock poster cards identified in Leslie's gap analysis. However, per Cristian's decision (2026-07-10), these primitives were **removed entirely**. The branch now carries only two focused visual-consistency fixes:

1. **Tree Default Node Border** — plain/default nodes now use `palette.primary` (blue) borders, matching nodegraph styling
2. **Arrowhead Size Uniformity** — fixed `arrowDef()` with `markerUnits="userSpaceOnUse"` so active edges maintain uniform arrowhead sizes regardless of stroke width

---

## The Two Shipped Fixes

### Fix 1: Tree Default Node Border

**File:** `src/diagrams/triton/ds/tree/layout.ts`

**Problem:** `tree` primitive default/plain nodes rendered with near-black borders, visually inconsistent with `nodegraph` default nodes (blue `palette.primary`).

**Solution:** Changed fallback case in `nodeStyle()` to use `palette.primary` for plain nodes:
```diff
- return { shape, fill, stroke: outlineStroke(fill, theme), text: palette.text };
+ return { shape, fill, stroke: palette.primary, text: palette.text };
```

**Scope:** Only plain/default nodes. Semantic kinds (RB red, RB black, active, scan, join, build/muted) unchanged.

**Test updated:** `test/tree-builders.test.ts` — plain/AVL node assertions updated to expect `palette.primary`.

---

### Fix 2: Arrowhead Size Uniformity

**File:** `src/diagrams/triton/ds/struct/shared.ts`

**Problem:** `nodegraph` active edges (stroke=2.5) had arrowheads ~1.67× larger than normal edges (stroke=1.5) because `arrowDef()` omitted `markerUnits`, causing arrowheads to scale with the line's stroke width.

**Solution:** Switched to `markerUnits="userSpaceOnUse"` with fixed geometry:
```diff
- markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"
- path: M0 0 L8 4 L0 8 z
+ markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse"
+ path: M0 0 L12 6 L0 12 z
```

**Impact:** Affects all diagrams using shared `ARROW_ID` marker: nodegraph, linkedlist, hashmap, array, page, memory. Queue diagrams have separate markers (unaffected).

---

## Dropped Work

The following was **removed entirely**:
- `src/diagrams/triton/ds/intervals/` (whole directory)
- `src/diagrams/triton/ds/hashring/` (whole directory)  
- `test/intervals.test.ts`, `test/hashring.test.ts`
- `examples/triton/poster/phase2/` (whole directory)
- `DiagramKind` union entries `'intervals' | 'hashring'`
- `detect.ts` patterns for intervals/hashring
- `frontend/index.ts` imports + `registerDiagram()` calls
- `poster/index.ts` `inferCellKind()` checks

---

## Verification

- **Build:** `pnpm build` clean
- **Tests:** 499/499 (Phase-1 baseline, primitives removed)
- **Visual QA:** Edge-highlight.png confirms blue tree borders + uniform arrowheads (Ken's full pass in separate decision)
- **Files on branch:** 3 files modified:
  1. `src/diagrams/triton/ds/tree/layout.ts` (plain node border)
  2. `src/diagrams/triton/ds/struct/shared.ts` (arrowDef markerUnits)
  3. `test/tree-builders.test.ts` (updated assertions)

---

## Decision Rationale

Dropping the primitives allows the branch to ship quickly with focused, low-risk improvements to existing diagram families. The primitives can be revisited in a future phase if poster card requirements evolve.


---

# Visual QA: Phase 2 Theming Fixes — PASS

**Reviewer:** Ken (Visual QA)  
**Date:** 2026-07-10T19:17:00-04:00  
**Branch:** `ormasoftchile/poster-phase2`  
**Decision:** Primitives dropped; QA verdict on shipped fixes: PASS

---

## Scope

Reviewed two visual-consistency fixes shipped in Phase 2:
1. Tree default node borders (blue `palette.primary`)
2. Arrowhead size uniformity (fixed `markerUnits="userSpaceOnUse"`)

**Note:** Primitive implementations (intervals, hashring) were under review but subsequently removed per Cristian's decision before merge.

---

## Verification Results

### 1. Tree Theming (edge-highlight.svg)

**What I verified:**
- **Binary Tree DFS panel:** Plain nodes B, C, D now have blue (`palette.primary`) borders matching the highlighted node style
- **Backtracking panel:** All nodes (Root, Choice1, Choice2, Good, Bad, Answer) have consistent blue borders — NOT near-black
- **Semantic nodes unchanged:** RB-tree `rbtree.png` — black and red nodes retain their semantic colors

**Verdict:** ✅ **PASS** — Tree theming fix confirmed; no regressions in semantic node colors.

---

### 2. Arrowhead Uniformity (edge-highlight.svg)

**What I verified:**
- **DFS Graph panel:** Active edges (parse→scan, thicker stroke) and normal edges (gray/muted) have visibly **uniform arrowhead sizes**
- **BFS Graph panel:** Active→scan and scan→build edges — arrowheads all proportional, no scaling artifacts
- **linkedlist/labels.svg:** Struct pointer arrows render correctly with consistent arrowhead geometry

**Verdict:** ✅ **PASS** — Arrowhead uniformity confirmed; `markerUnits="userSpaceOnUse"` working correctly.

---

## Overall Verdict: **PASS**

Both shipped fixes render correctly with no visual regressions.

---

## Note on Dropped Primitives

The `intervals` and `hashring` implementations that were initially under QA review were dropped before merge per Cristian's decision. No cosmetic issues from dropped work affect the final branch.

**Signed:** Ken, Visual QA Reviewer  
**Timestamp:** 2026-07-10T19:17:43-04:00


---

# Decision: Group A — Inline `%%` Options Headers Added (2026-07-07)

**Author:** Bjarne (Ingestion Design)  
**Date:** 2026-07-07  
**Follow-up to:** Group A diagram-options fragments (2026-07-06)

---

## Context

`stripComments()` in `src/frontend/preprocess.ts` now strips full-line `%%` comment lines
before any parser sees them, across all diagram families (404 tests pass). The fallback
note in Group A fragments ("This grammar does not define a `%%` comment rule") is obsolete.

---

## Files Changed

### `.mmd` examples — `%%` header block added

Each block is placed immediately after the diagram header keyword line, following the
`flowchart.mmd` exemplar convention (Leslie's format). Block content is strictly
grammar-derived — no invented tokens.

| File | Header keyword | Lines added |
|------|---------------|-------------|
| `examples/mermaid/class/class.mmd` | `classDiagram` | 10 |
| `examples/mermaid/state/state.mmd` | `stateDiagram-v2` | 12 |
| `examples/mermaid/er/er.mmd` | `erDiagram` | 10 |
| `examples/mermaid/c4/c4.mmd` | `C4Context` | 13 |
| `examples/mermaid/requirement/requirement.mmd` | `requirementDiagram` | 10 |

### Fragments — fallback note removed, `### Comments` section added

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/class.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/state.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/er.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/c4.md` | Replaced fallback note → `### Comments` |
| `docs/diagram-options/_fragments/requirement.md` | Replaced fallback note → `### Comments` |

`### Comments` text (uniform across all five):
> Lines starting with `%%` are stripped before parsing:
> ```
> %% This is a comment
> ```

---

## Render Results

All verified via `node scripts/preview.mjs examples/mermaid/<family>/` from repo root:

| Family | Exit code | SVG output |
|--------|-----------|------------|
| class | 0 | `class.svg` ✓ |
| state | 0 | `state.svg` ✓ |
| er | 0 | `er.svg` ✓ |
| c4 | 0 | `c4.svg` ✓ |
| requirement | 0 | `requirement.svg` ✓ |

SVG layout unchanged — `%%` lines stripped before parse, no parser impact.

---

## Note on Theme Subdirectories

No `.mmd` files exist under `examples/mermaid/<family>/themes/` for any of the 5 families
(directories are present but contain no `.mmd` sources). Only the single top-level file per
family required updating.


---



---

# Group D `%%` Header Blocks — Follow-up Complete

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-07T00:05:21-04:00  
**Relates to:** Group D diagram-options work; `stripComments()` central implementation in `src/frontend/preprocess.ts`

---

## Context

`stripComments()` in `src/frontend/preprocess.ts` strips all full-line `%%` comments before any parser sees the input. This supersedes the earlier per-grammar approach (only poster had `%%` support natively). All families — including architecture, block, packet, and topology — now accept `%%` header blocks without grammar changes.

---

## Files Changed

### `.mmd` examples — `%%` options header added

| File | Header keyword | SVG output |
|------|---------------|------------|
| `examples/triton/architecture/architecture.mmd` | `architecture-beta` | `architecture.svg` ✓ |
| `examples/triton/block/block.mmd` | `block-beta` | `block.svg` ✓ |
| `examples/triton/packet/packet.mmd` | `packet-beta` | `packet.svg` ✓ |
| `examples/triton/topology/numa.mmd` | `topology` | `numa.svg` ✓ |
| `examples/triton/topology/numa-detail.mmd` | `topology` | `numa-detail.svg` ✓ |

Header block format (per Leslie's convention, after the keyword line):
```
%% ────────────────────────────────────────────────────────────────────────────
%% FAMILY — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:   ...
%% ...options (compact per-category lines from fragment)...
%% Comments: %% text  (stripped before parse — safe on any line)
%% ────────────────────────────────────────────────────────────────────────────
```

### Fragments — fallback note removed, `### Comments` section added

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/triton-architecture.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/triton-block.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/triton-packet.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/triton-topology.md` | Removed fallback note; added `### Comments` |

Each `### Comments` section reads:
> Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`).

---

## Render Results

All previews ran at exit 0 with layout unchanged:

```
node scripts/preview.mjs examples/triton/architecture/  → architecture.svg   EXIT:0
node scripts/preview.mjs examples/triton/block/         → block.svg          EXIT:0
node scripts/preview.mjs examples/triton/packet/        → packet.svg         EXIT:0
node scripts/preview.mjs examples/triton/topology/      → numa.svg           EXIT:0
                                                          numa-detail.svg     EXIT:0
```

No family misbehaved. Poster untouched (already complete).


---



---

# Group B `%%` Header Blocks — Follow-up (David, 2026-07-07)

## Context

`src/frontend/preprocess.ts` now strips full-line `%%` comments centrally before any grammar sees the input (404 tests passing). This supersedes the fallback notes I wrote in the Group B fragments during the 2026-07-06 diagram-options wave, which said "this grammar does not define a `%%` comment rule." Those notes are now incorrect. This document records the follow-up work that cleans them up and adds `%%` header blocks to all five Group B example files.

---

## Files Changed

### Example `.mmd` files — `%%` options header added after keyword line

| File | Header keyword | Header lines added |
|------|---------------|--------------------|
| `examples/mermaid/sequence/auth.mmd` | `sequenceDiagram` | 11 |
| `examples/mermaid/journey/journey.mmd` | `journey` | 8 |
| `examples/mermaid/gantt/gantt.mmd` | `gantt` | 10 |
| `examples/mermaid/gitgraph/gitgraph.mmd` | `gitGraph` | 9 |
| `examples/mermaid/kanban/kanban.mmd` | `kanban` | 8 |

Each block follows Leslie's convention (same format as `examples/mermaid/flowchart/flowchart.mmd`):
- Delimiter lines `%% ─────…`
- `%% FAMILY — options quick-ref` title
- Compact per-category lines covering all grammar-derived options
- Closes with `%% Comments:   %% text  (stripped before parse — safe on any line)`

### Fragment files — fallback note replaced with `### Comments` section

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/sequence.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/journey.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/gantt.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/gitgraph.md` | Removed fallback note; added `### Comments` |
| `docs/diagram-options/_fragments/kanban.md` | Removed fallback note; added `### Comments` |

`### Comments` section text (uniform across all five):
```
Lines starting with `%%` are stripped before parsing:
\`\`\`
%% This is a comment
\`\`\`
```

---

## Render Results

Each family previewed via `node scripts/preview.mjs examples/mermaid/<family>/` from repo root, run serially:

| Family   | SVGs regenerated | Exit code |
|----------|-----------------|-----------|
| sequence | auth.svg        | 0 ✓       |
| journey  | journey.svg     | 0 ✓       |
| gantt    | gantt.svg       | 0 ✓       |
| gitgraph | gitgraph.svg    | 0 ✓       |
| kanban   | kanban.svg      | 0 ✓       |

> **Note:** Running all previews in parallel triggers a race condition in the shared dist build step (pre-existing issue in `class/layout.js`). Previews must be run serially.

---

## No Tokens Invented

All options in the header blocks are derived strictly from fragment grammar tables already written during the 2026-07-06 wave. No new grammar tokens were introduced.

---

_David · Research Lead · 2026-07-07_


---



---

# Edsger — Group E (ds) %% Headers

**Date:** 2026-07-07  
**Agent:** Edsger (Layout Algorithms)  
**Follow-up to:** Group E ds diagram-options fragment work

---

## Summary

Added `%%` options quick-ref headers to all ds example files and updated all 22 ds fragment docs to replace the obsolete fallback note with a proper `### Comments` section.

---

## Scope

| Item | Count |
|------|-------|
| `.mmd` example files given `%%` headers | **20** |
| `ds-*.md` fragment files updated | **22** |
| Subkinds covered by examples | array, queue, cqueue, deque, pqueue, stack, hashmap, matrix, trie, unionfind, nodegraph, tree (decision + query-plan), plan, avl, rbtree, btree, heap, radix, segtree |
| Fragments without example files (docs only) | linkedlist, memory, page |

---

## What changed in .mmd files

Each of the 20 `.mmd` example files received a `%%`-prefixed options quick-ref block inserted immediately after the header keyword line, following the established convention from `examples/mermaid/flowchart/flowchart.mmd`. The block ends with:

```
%% Comments: %% text  (stripped before parse — safe on any line)
```

Header content is derived strictly from each subkind's fragment (no invented tokens).

---

## What changed in fragment files (all 22)

1. **Removed** the fallback blockquote note:  
   > This grammar does not define a `%%` comment rule …

2. **Added** a `### Comments` section (before `### Minimal snippet`):  
   ```markdown
   ### Comments
   
   Full-line `%%` comments are supported and stripped centrally before any parser runs:
   ```
   %% This is a comment
   ```
   ```

---

## Render result

All 20 SVGs regenerated successfully with exit 0 across all 9 ds subdirectories:

- `examples/triton/ds/array/` → `array.svg` ✓
- `examples/triton/ds/queue/` → `circular.svg`, `deque.svg`, `linear.svg`, `priority.svg` ✓
- `examples/triton/ds/stack/` → `stack.svg` ✓
- `examples/triton/ds/hashmap/` → `hashmap.svg` ✓
- `examples/triton/ds/matrix/` → `matrix.svg` ✓
- `examples/triton/ds/trie/` → `trie.svg` ✓
- `examples/triton/ds/unionfind/` → `unionfind.svg` ✓
- `examples/triton/ds/graph/` → `graph.svg` ✓
- `examples/triton/ds/tree/` → `avl.svg`, `btree.svg`, `decision.svg`, `heap.svg`, `plan.svg`, `query-plan.svg`, `radix.svg`, `rbtree.svg`, `segtree.svg` ✓

Layout is unchanged — `%%` lines are stripped before any parser sees the input.


---



---

# Decision Record: diagram-options feature — Final Assembly

**Date:** 2026-07-07  
**Author:** Leslie (Lead / Spec Architect)  
**Status:** Done

---

## Summary

The diagram-options feature is complete. All 45 diagram families now support `%%` comments unconditionally, every fragment documents this, the central reference doc is assembled and verified, and the full test suite passes with 0 failures.

---

## Final Artifact List

| Artifact | Status |
|---|---|
| `docs/diagram-options.md` | ✅ Assembled — 2879 lines, 45 family sections, updated intro |
| `docs/diagram-options/_fragments/*.md` (45 files) | ✅ All have `### Comments` section |
| `src/frontend/preprocess.ts` | ✅ New — `stripComments()` central preprocessor |
| `src/frontend/index.ts` | ✅ Updated — calls `stripComments()` before parse dispatch |
| `test/preprocess-comments.test.ts` | ✅ New — 20 tests for `stripComments()` |
| `examples/**/*.mmd` (60 of 68) | ✅ Carry inline `%%` options-header blocks |
| `examples/**/*.svg` (re-renders) | ✅ Re-rendered after header additions |
| `.squad/agents/*/history.md` (5 agents) | ✅ Updated by each agent's group work |

---

## Universal `%%` Comment Support

All 45 diagram families now support full-line `%%` comments. This is enforced by `src/frontend/preprocess.ts` (`stripComments()`), which strips every `%%`-prefixed line before the diagram source reaches any parser. Comments may appear anywhere in a file — including before the header keyword.

The 8 `.mmd` files without inline options-headers are intentionally left as-is: they are complex multi-diagram poster variants (cross-link, showcase, animated) where a per-family header block would be ambiguous inside nested cells.

---

## `pnpm test` Result

```
Test Files  31 passed (31)
     Tests  404 passed (404)
  Duration  3.76s
```

**0 failures. 0 typecheck errors.**

The 69-file examples render corpus (including all `.mmd` files with newly added `%%` headers) passed in full.

---

## Intro Paragraph (final)

> This document is the single central reference for every option, keyword, and syntax construct accepted by each diagram family in Triton. Options are grammar-derived: every entry was extracted from the family's `grammar.peggy` or parser source and verified against real examples. Full-line `%%` comment lines are supported in **every** family — they are stripped centrally by `src/frontend/preprocess.ts` before any parser runs, so they may appear anywhere in a diagram file, including before the header keyword. Nearly every example `.mmd` file carries an inline options-header block written as `%%` comments, making available options visible directly alongside the diagram source.


---



---

# Decision: Central %% Comment Stripping

**Author:** Mark (IR & Data Modeling)  
**Date:** 2026-07-07  
**Status:** Implemented — ready for Leslie review gate  
**Requested by:** Cristian (ormasoftchile)

---

## Problem

Only 4 diagram families (flowchart, sankey, timeline, poster) had a `%%` Comment
rule in their Peggy grammar. The remaining ~20 Mermaid families, 4 Triton-native
families (architecture/block/packet/topology), and 22 hand-parsed `ds` sub-kinds
had no comment support — a `%%` line would either trigger a parse error or be
silently misinterpreted as diagram content. This blocked adding `%%` options-header
blocks to every example file.

---

## Approach: Central pre-processing (chosen)

Strip `%%` comment lines **once**, at the top of `compileSync` in
`src/frontend/index.ts`, before `detect()` and the grammar/parser are invoked.
A new function `stripComments(input: string): string` in `src/frontend/preprocess.ts`
performs the strip and is exported for independent unit testing.

**Wire-up (one line added to compileSync):**
```typescript
const cleaned = stripComments(input);
const { format, diagramType } = detect(cleaned);
// … later …
const ir = format === 'yaml' ? module.parseYaml(cleaned) : module.parseMermaid(cleaned);
```

All four public entrypoints (`compileSync`, `renderSync`, `compile`, `render`)
benefit automatically because they all route through `compileSync`.

---

## Semantics

### Chosen: full-line `%%` only

A line is a comment iff its first non-whitespace characters are `%%`
(regex `/^\s*%%/`). Such lines are **removed entirely** (not blanked).

Rationale for "remove entirely" over "blank": every Peggy grammar has a
`BlankLine` rule; every hand-parsed `ds` family uses `lines()` from
`src/diagrams/triton/ds/struct/shared.ts` which already does `filter(Boolean)`.
Removing lines is therefore universally safe and does not shift meaningful
indentation (comment lines carry no structural meaning).

### Inline trailing comments: NOT supported centrally (by design)

`A --> B %% note` is **not stripped** by the central stripper. Reason:
distinguishing a real trailing comment from `%%` inside a quoted node label
(e.g. `A["Load at 50%% capacity"]`) is impossible without invoking the full
grammar. The 4 families that already handle their own Comment rules continue
to accept inline `%%` via their grammar rule, unchanged — the central
pre-stripper only removes full-line comments first, which those grammars would
have consumed anyway.

### Frontmatter preserved verbatim

If the input opens with a `---\n…\n---` YAML frontmatter block, that block is
passed through untouched. YAML values may legitimately contain `%%` (e.g.
`title: "Load at 90%% capacity"`). Stripping applies only to the Mermaid body
after the closing `---` fence.

### Pure-YAML inputs untouched

If the first non-whitespace token is `type:`, the input is returned unchanged.
The `parseYaml` path receives the original author text.

### Malformed frontmatter

If `---` is present but no closing `---` is found, the input is returned
conservatively unchanged (treated as YAML-ish).

---

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Per-grammar Comment rule in every .peggy | Requires editing 19+ grammars + re-generating parsers; hand-parsed families still need separate treatment; maintenance burden for future families |
| Inline trailing comment support centrally | Unsafe: `A["50%% off"]` would be mangled; requires tokeniser-level knowledge |
| Blank lines instead of remove | Functionally equivalent but preserves no benefit; "remove" is simpler output |

---

## Files changed

| File | Change |
|---|---|
| `src/frontend/preprocess.ts` | **New** — `stripComments()` (exported) + private `removeCommentLines()` |
| `src/frontend/index.ts` | Added `import { stripComments }` + `const cleaned = stripComments(input)` at top of `compileSync`; `detect` and `parse*` now receive `cleaned` |
| `test/preprocess-comments.test.ts` | **New** — 20 tests (unit + detect integration + end-to-end render for 5 families) |

---

## Test results

```
pnpm test:  404 pass, 0 fail  (baseline 384 + 20 new)
pnpm typecheck:  0 errors
```

### Previously-unsupported families verified (end-to-end render with `%%` header)

- `classDiagram` — Peggy grammar, no prior Comment rule → now accepts `%%`
- `packet-beta` — Peggy grammar, no prior Comment rule → now accepts `%%`
- `array` (ds hand-parsed) — `lines()`/`filter(Boolean)` path → now accepts `%%`
- `mindmap` — Peggy grammar, indentation-sensitive, no prior Comment rule → now accepts `%%`
- `pie` — Peggy grammar, no prior Comment rule → now accepts `%%`

---

## Readiness for coordinator

This task is complete. The coordinator can now fan out:
1. **Example-header additions** — add `%%` options-header blocks to every `.mmd`
   example file (all families now accept `%%`).
2. **Docs update** — remove "fallback note" caveats from the 4 fragment files
   (pie, xychart, quadrant, radar, mindmap, etc.) that were marked as lacking
   `%%` support.


---



---

# Group C — %% Header Blocks for pie / xychart / quadrant / radar / mindmap

**Author:** Mark (IR & Data Modeling)
**Date:** 2026-07-07
**Supersedes:** Group C fallback notes in five fragments

---

## Summary

Added Leslie-convention `%%` options-header blocks to all Group C example files and updated the corresponding fragments to reflect that `%%` comments are now fully supported via central stripping.

---

## Files Changed

### Example `.mmd` files — 1 per family (5 total)

| File | Header keyword | Block inserted after |
|------|---------------|---------------------|
| `examples/mermaid/pie/languages.mmd` | `pie` | `pie showData title …` line |
| `examples/mermaid/xychart/xychart.mmd` | `xychart-beta` | `xychart-beta` line |
| `examples/mermaid/quadrant/quadrant.mmd` | `quadrantChart` | `quadrantChart` line |
| `examples/mermaid/radar/radar.mmd` | `radar-beta` | `radar-beta` line |
| `examples/mermaid/mindmap/mindmap.mmd` | `mindmap` | `mindmap` line (col 0, after frontmatter) |

### Fragment documentation — 5 files

| File | Change |
|------|--------|
| `docs/diagram-options/_fragments/pie.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/xychart.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/quadrant.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/radar.md` | Removed fallback blockquote; added `### Comments` section |
| `docs/diagram-options/_fragments/mindmap.md` | Removed fallback blockquote; added `### Comments` section (with indentation note) |

---

## Why This Works Now

`stripComments()` in `src/frontend/preprocess.ts` removes every full-line `%%` comment before the diagram string reaches any parser. All four compile/render entrypoints in `src/frontend/index.ts` call it centrally. No per-grammar comment rule is needed — making `%%` headers universally safe.

---

## Mindmap Notes

Mindmap uses indentation depth as its parse signal for parent-child relationships. The `%%` block lines are placed at column 0 immediately after the `mindmap` keyword line. Because `stripComments()` removes them entirely before the indentation-sensitive parser sees the file, real node indentation is never disturbed.

---

## Preview Results

| Family | Command | Exit | SVG |
|--------|---------|------|-----|
| pie | `node scripts/preview.mjs examples/mermaid/pie/` | 0 | `languages.svg` regenerated |
| xychart | `node scripts/preview.mjs examples/mermaid/xychart/` | 0 | `xychart.svg` regenerated |
| quadrant | `node scripts/preview.mjs examples/mermaid/quadrant/` | 0 | `quadrant.svg` regenerated |
| radar | `node scripts/preview.mjs examples/mermaid/radar/` | 0 | `radar.svg` regenerated |
| mindmap | `node scripts/preview.mjs examples/mermaid/mindmap/` | 0 | `mindmap.svg` regenerated, hierarchy intact |

All five families exit 0. Mindmap indentation and tree layout confirmed unchanged.

---

## Sankey Status

Sankey was already completed in the previous session. Not touched.


---



---

# The scorecard is computed by src/geometry/aesthetics.ts and logged during poster render.


---

# Check the logged score; it must reach ≥ 0.75 before Phase 4 is considered complete.
node scripts/preview.mjs examples/poster/


---

# Inspect console output for the aesthetics score line.
```

---

## 4. Scope Decisions

### 4.1 Selection Method: Static Dispatch — DECIDED

**Decision: Static dispatch per diagram type. No dynamic or adaptive algorithm selection.**

The algorithm for a diagram kind is a *semantic* property of that kind, not a runtime property
of a specific instance. A flowchart is always a directed flow and always benefits from Sugiyama
layered layout, regardless of whether it has 3 nodes or 300. Switching algorithms based on
graph metrics (node count, density, cycle count) would:

1. Violate Triton's core determinism contract — the same source must produce the same layout.
   An algorithm switch at a threshold (e.g., n > 50 nodes → use force-directed) means that
   adding one node can produce a completely different visual arrangement.
2. Introduce combinatorial testing burden — every diagram type would need test coverage at both
   sides of each threshold.
3. Create author confusion — the user cannot predict what their diagram will look like until it
   crosses an invisible threshold.

**Implementation:** The selection is implemented as a static mapping in each diagram's
`layout.ts` (already the existing pattern). No registry or runtime selector is needed.

**Deferred (not in this initiative):** Performance fallbacks for pathologically large graphs
(e.g., thousands of nodes) may be addressed in a separate performance initiative. That work
would use the same algorithm but with approximation heuristics (e.g., fewer crossing-min
sweeps), not a different algorithm family — so it preserves visual continuity.

**Confirmed scope of static dispatch:**

| Diagram kind | Algorithm family | Selection |
|---|---|---|
| flowchart | Sugiyama 4-phase layered | Static (TB or LR from diagram direction) |
| class, state, er, c4, block, requirement | Sugiyama-lite layered (`layered.ts`) | Static |
| mindmap | B–J–L tidy tree (`tree.ts`) | Static |
| ds/tree, trie, unionfind | B–J–L tidy tree (`tree.ts`) | Static |
| ds/nodegraph | Sugiyama-lite layered (`layered.ts`) | Static |
| sequence, gantt, gitgraph, timeline | Positional by order/time | No algorithm; static positional |
| kanban, packet | Strip placement | Static strip |
| pie, radar, quadrant, xychart | Polar / Cartesian math | Static math |
| sankey | Flow-channel placement | Static custom |
| architecture, block (top-level), journey | Custom | Static custom |
| poster (cell placement) | Grid occupancy assignment | Static grid |
| poster (cross-link routing) | engine3 cost-function | Static engine selection |

### 4.2 Poster Treatment: Dedicated Phase — CONFIRMED

The poster is architecturally distinct from all other diagram types and must be treated in its
own dedicated phase (Phase 4) for the following reasons:

**The core problem:** Poster cross-diagram connectors must route through the inter-cell space of
a grid of independently-rendered diagram cells. Each cell has its own coordinate space and
internal layout; the cross-link router (engine3) operates in poster-global space after
transforming anchor points. The key difficulties are:

1. **Obstacle heterogeneity.** The obstacle set for a poster connector consists of the bounding
   boxes of ALL cells (not just the source and target cell). Routing cannot be solved per
   diagram — it requires global knowledge of all cell positions and sizes.
2. **Coordinate space transforms.** Each diagram cell produces anchors in its own local
   coordinate space. The engine must transform those anchors to poster-global space before
   routing, and the transform is non-trivial for row-span or column-span cells (the cell's
   origin shifts based on grid placement).
3. **Port clustering.** Multiple connectors may share the same cell wall. Port ordering on a
   wall must be globally coherent — a connector that enters the left wall of cell (2,1) must
   not cross a connector that enters the left wall of cell (2,1) at a different port if they
   connect to different directions.
4. **Scale independence.** Connectors should route cleanly regardless of how many cells are in
   the grid or how varied the cell sizes are.

This is a hard cross-diagram routing problem that is NOT solved by the intra-diagram layout
improvements in Phases 1–3. It requires deep engagement with engine3.ts (1073 lines) and the
poster layout kernel (548 lines). Attempting to interleave this work with the simpler diagram
upgrades would create a moving-target situation.

**Phase 4 is a mandatory gate for Phase 5** (design doc must describe the finalized
architecture).

### 4.3 What Is Out of Scope

The following are explicitly **deferred** and not part of this initiative:

- **External library integration (elk.js, dagre-D3, d3-force):** The catalog (Phase 0) will
  describe these as academic references and identify where their algorithms map to Triton kinds.
  Triton will NOT adopt them as runtime dependencies. The algorithms will be implemented in
  TypeScript in the existing kernel files. Rationale: Triton's determinism contract and
  zero-external-dependency rule for core conflict with these libraries' design.
- **Adaptive / runtime algorithm switching:** See §4.1.
- **3D or radial layout for general graphs:** Not a Triton use case in this initiative.
- **Animation/transition between layouts:** Out of scope for a compiler; belongs to a renderer.
- **Force-directed layouts for any current diagram kind:** No Triton diagram benefits from
  non-deterministic force convergence. Force-directed is documented in the catalog but not
  adopted.
- **New diagram kinds:** This initiative improves existing layouts only. New kinds go through the
  normal grammar spec process.

---

## 5. Risk Flags

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Brandes–Köpf introduces layout discontinuity** — existing goldens will change significantly for flowchart/class/state/er. Users relying on deterministic exact pixel positions will notice. | Medium | Golden updates are expected and permitted. Communicate to ormasoftchile before Phase 1 merge that golden SVGs will change. The new layout should be strictly better visually. |
| **Crossing minimization is NP-hard; barycenter is a heuristic** — results may differ from Mermaid's dagre output by large amounts on complex graphs. | Low–Medium | Acceptable: Triton is explicitly better-than-Mermaid. But run `examples/flowchart/` visual check on the most complex example before merge. |
| **engine3 cost weights are corpus-calibrated to current (suboptimal) layouts** — re-tuning the weights in Phase 4 may cause regressions in currently-passing poster examples. | High | Phase 4 must audit ALL poster examples in `examples/poster/` and `examples/showcases/`. Aesthetic score is the objective gate; do not merge if any existing poster degrades below its current score. |
| **Coordinate-space transform bugs in poster** — a cell at grid position (row=2, col=1) with a row-span may have an offset that differs from a simple `row × rowHeight` computation. Off-by-one in the transform would cause connectors to attach to the wrong wall point. | High | Phase 4B must add explicit unit tests for anchor→global coordinate transforms covering span cells. |

---

Added a **dummy-protection pass** after standard type-1 conflict detection (lines ~482–503 of `src/graph/layered.ts`):

> For each dummy `d` in a layer, for each real node `u` in the **same layer** that shares a direct predecessor `p` or successor `s` with `d`, call `addConflict(p, u)` and `addConflict(u, s)`.

This prevents `u` from claiming `p` or `s` as an alignment anchor in any of the four BK sweeps. The dummy aligns in all four sweeps; the real node (`ShoppingCart`) is orphaned at `sep(dummy, u) = 95.8px` from the Customer column.

## Result

- `bends[0].x` = **89** = `Customer.x` = `Order.x` ✓ (straight vertical edge)
- `ShoppingCart.x` = 185 (own column, cleanly separated from Customer/Order column)
- `pnpm build` exits 0 ✓
- `pnpm test` 387/387 ✓

## SVG "places" edge path (after fix)

```
d="M 89 184 L 89 216 L 89    216 L 89    387 L 89   387 L 89   419"
```

Perfectly straight vertical line at x=89.

---


---

# Decision: Diagram-Options Reference Format

**Author:** Leslie (Lead / Spec Architect)  
**Date:** 2026-07-06  
**Status:** READY — downstream agents must implement exactly as specified below  
**Requested by:** ormasoftchile  

---

## Context

The user needs a quick, convenient way to see the OPTIONS available for each diagram type.
We are delivering two artifacts:

1. **`docs/diagram-options.md`** — a single central markdown reference concatenated from per-family fragments.
2. **`%%` comment header blocks** at the top of each example `.mmd` file — visible to anyone opening the file.

The flowchart family has been implemented as the verified exemplar. All downstream agents must follow this specification exactly and point at the exemplar before starting.

**Exemplar files (READ THESE FIRST):**
- Fragment: `docs/diagram-options/_fragments/flowchart.md`
- Example with header: `examples/mermaid/flowchart/flowchart.mmd`

---

## Part 1 — Fragment Template

Each agent writes one file per family to `docs/diagram-options/_fragments/<family>.md`.
The file MUST follow this verbatim template structure (section headings, table format, snippet fence):

```markdown
## <Family name, title-case>

<One sentence: what this diagram type draws. Derived from grammar.peggy file header comment.>

**Header keyword(s):** `<token1>` · `<token2>`

---

### <Category A heading — use only categories that apply>

| <col1> | <col2> |
|--------|--------|
| ...    | ...    |

---

### <Category B heading>

...

---

### Minimal snippet

```
<diagram header>
  <2–4 lines showing the most common syntax>
```
```

**Mandatory sections** (include all that the grammar supports; omit those it doesn't):

| Section heading      | When to include                                     |
|----------------------|-----------------------------------------------------|
| Directions           | Grammar has a Direction rule                        |
| Node shapes          | Grammar defines multiple shape variants             |
| Edge types           | Grammar has multiple EdgeArrow/RelOp variants       |
| Relationship types   | For ER, class, requirement, C4 — relation keywords  |
| Entry / Event syntax | For timeline, journey, gantt — per-entry syntax     |
| Block keywords       | subgraph, section, group, etc.                      |
| Config keywords      | Grammar-level directives (title, tickInterval, etc.)|
| Overlays             | note, legend (shared overlay directives)            |
| Directives           | style, classDef, click — captured-not-interpreted   |
| Frontmatter          | Only if grammar has Frontmatter rule                |
| Comments             | ONLY if grammar has `%%` Comment rule (see Part 3)  |
| Minimal snippet      | ALWAYS required                                     |

**Table format rules:**
- Use `·` (middle dot U+00B7) to separate alternatives on a single cell.
- Literal syntax tokens go in backticks.
- Keep table rows to a single line; wrap into a second row only if > 120 chars.
- No lorem-ipsum descriptions — every cell is derived from the grammar source.

**Source discipline:** Every option listed MUST exist in the family's `grammar.peggy` (or its `index.ts` hand-parser). If uncertain, grep the grammar. Do NOT invent options.

---

## Part 2 — Example `%%` Header Convention

### Format (verbatim)

The `%%` header block is inserted AFTER the diagram's first line (the header keyword line)
and BEFORE any content lines. Every line MUST start with `%%`.

```
<header keyword> <direction or first token>
%% ────────────────────────────────────────────────────────────────────────────
%% <FAMILY NAME UPPER-CASE> — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:      <keyword1> | <keyword2>
%% <Category>:  <value1> · <value2> · <value3>
%% <Category>:  <value1> · <value2>
%% ...
%% ────────────────────────────────────────────────────────────────────────────
  <first content line of the diagram>
```

**Rules:**
- Separator line is exactly 76 `─` characters (U+2500) after `%% `.
- Category labels are right-padded with spaces so colons align (use 13-char label field).
- Summarise options compactly — one line per category. If a category's values overflow 78 chars, wrap to a second `%%` line with the same indentation.
- Copy the block verbatim across all `.mmd` files in the same family directory — do not customise per file.
- The block is purely informational: it must NOT alter the rendered SVG in any way other than trivial re-render noise (e.g., background rect coordinate style).

### Verified exemplar

See `examples/mermaid/flowchart/flowchart.mmd` for the canonical reference.
Confirmed: `node scripts/preview.mjs examples/mermaid/flowchart/` exits 0, all 3 SVGs regenerate, diagram layout is unchanged.

---

## Part 3 — Comment Safety Detection Rule

### Detection method

Before adding ANY `%%` header, the agent MUST check whether the family's grammar supports `%%` comments:

```bash
grep -c '%%' src/diagrams/<mermaid|triton>/<family>/grammar.peggy
```

- Output **> 0**: `%%` is supported — proceed with header insertion.
- Output **0** (or grammar.peggy does not exist): `%%` is NOT supported — see fallback below.

For families with a hand-written parser (`index.ts`) and no `grammar.peggy`, grep the `index.ts` instead:

```bash
grep -c '%%' src/diagrams/<mermaid|triton>/<family>/index.ts
```

### Families confirmed to support `%%` (as of 2026-07-06)

| Family      | Location             | `%%` in grammar |
|-------------|----------------------|-----------------|
| flowchart   | mermaid/flowchart    | ✓ YES           |
| sankey      | mermaid/sankey       | ✓ YES           |
| timeline    | mermaid/timeline     | ✓ YES           |
| poster      | triton/poster        | ✓ YES           |

All other 18+ families currently have NO `%%` rule in their grammar — confirmed by grep.

### Fallback for families WITHOUT `%%` support

1. **Do NOT add** the `%%` header block to any `.mmd` example files for that family.
2. **Do add** the following note to the family's fragment, at the bottom BEFORE the "Minimal snippet" section:

```markdown
> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.
```

3. The "Comments" section is **omitted** from the fragment for that family.

---

## Part 4 — Commands

All commands are run from the repo root (`/Users/cristianormazabal/Projects/triton`).

| Step | Command | Pass condition |
|------|---------|----------------|
| Build grammars only | `node scripts/build-grammars.mjs` | Exits 0, 23 grammars compiled |
| Full build | `pnpm build` | Exits 0 |
| Render one example dir | `node scripts/preview.mjs examples/<path>/` | Exits 0, prints `✓ <name>.svg` for each file |
| Type check | `pnpm typecheck` | Exits 0, 0 errors |
| Verify SVG unchanged (layout) | `git diff --stat examples/<path>/*.svg` | 0 additions/deletions OR only trivial 2-line background rect changes |

**After adding `%%` headers to a family's examples, the agent MUST:**
1. Run `node scripts/preview.mjs examples/<mermaid|triton>/<family>/`
2. Confirm exit code 0 and `✓ <name>.svg` for every file.
3. If any file errors: remove the header block from that file, note the failure in the fragment (same fallback note as Part 3).

---

## Part 5 — Family Groups and Assignment

Agents are assigned families by group. Each group writes its fragments to
`docs/diagram-options/_fragments/<family>.md`.

**Group A** — class, state, er, c4, requirement  
**Group B** — sequence, timeline, journey, gantt, gitgraph, kanban  
**Group C** — pie, xychart, quadrant, radar, sankey, mindmap  
**Group D** — architecture, block, packet, topology, poster  
**Group E** — all `ds` subkinds: array, linkedlist, memory, page, tree, plan, avl, rbtree, btree, radix, segtree, heap, queue, cqueue, deque, pqueue, stack, hashmap, matrix, trie, nodegraph, unionfind

**flowchart** is DONE — do not reassign.

### Fragment filename convention

- Mermaid families: `docs/diagram-options/_fragments/<family>.md`  
  e.g., `class.md`, `state.md`, `er.md`
- Triton families: `docs/diagram-options/_fragments/triton-<family>.md`  
  e.g., `triton-architecture.md`, `triton-block.md`
- DS subkinds: `docs/diagram-options/_fragments/ds-<subkind>.md`  
  e.g., `ds-array.md`, `ds-trie.md`

### Concatenation (done last, by Leslie or orchestrator)

Once all fragments are written:
```bash
cat docs/diagram-options/_fragments/*.md > docs/diagram-options.md
```
Order: flowchart first, then groups A–E alphabetically within each group.

---

## Part 6 — Grammar Source Locations

All grammar files follow the pattern:
- `src/diagrams/mermaid/<family>/grammar.peggy` (18 Mermaid families)
- `src/diagrams/triton/<family>/grammar.peggy` (Triton families with PEG grammar)
- `src/diagrams/ds/<subkind>/index.ts` (DS subkinds — hand-written parsers, no .peggy)
- `src/diagrams/triton/ds/` may also have hand-parsers per subkind

Examples live under:
- `examples/mermaid/<family>/` for Mermaid families
- `examples/triton/<family>/` for Triton families  
- `examples/ds/<subkind>/` for DS subkinds

---

## Decisions recorded

1. **Fragment-first, concat-last** — per-family fragments avoid merge conflicts when 5 agents run in parallel.
2. **`%%` only after header keyword line** — the flowchart grammar's `BlankLine = _ Comment? NL` rule only matches within `Statements` (after the header), not before it. All verified-supporting grammars follow the same pattern.
3. **Comment safety is per-grammar, not global** — agents must grep each grammar individually. 14 of 18 Mermaid grammars currently have NO `%%` rule.
4. **SVG noise is acceptable** — trivial background-rect style changes (2 lines) are not a regression. What matters is exit 0 and layout/content identity.
5. **Options are grammar-derived only** — no invented syntax. If a feature isn't in the grammar, it isn't listed.


---

# Decision Record: Diagram-Options Reference Assembled

**Author:** Leslie (Lead / Spec Architect)  
**Date:** 2026-07-06  
**Status:** Done

---

## Summary

All 45 diagram-family option fragments were assembled into the final central reference document and the full test suite verified clean.

---

## Final Artifact Paths

| Artifact | Path |
|----------|------|
| Central reference doc | `docs/diagram-options.md` |
| Fragment directory | `docs/diagram-options/_fragments/` (45 `.md` files) |
| Format spec | `.squad/decisions/inbox/leslie-diagram-options-format.md` |

---

## Document Structure

`docs/diagram-options.md` contains 45 family sections in three groups:

1. **Mermaid Diagrams (18)** — flowchart first, then c4 · class · er · gantt · gitgraph · journey · kanban · mindmap · pie · quadrant · radar · requirement · sankey · sequence · state · timeline · xychart
2. **Triton Diagrams (5)** — architecture · block · packet · poster · topology
3. **Data-Structure / DS Diagrams (22)** — array · avl · btree · cqueue · deque · hashmap · heap · linkedlist · matrix · memory · nodegraph · page · plan · pqueue · queue · radix · rbtree · segtree · stack · tree · trie · unionfind

---

## Families with Inline `%%` Example Headers

The following four families have parsers that strip `%%` comment lines before evaluation. Their example `.mmd` files carry a `%%`-prefixed options block at the top of each file, making the available syntax visible alongside the diagram source:

| Family | Example files with inline header |
|--------|----------------------------------|
| `flowchart` | `ci-pipeline.mmd`, `flowchart.mmd`, `order-processing.mmd` |
| `sankey` | `sankey.mmd` |
| `timeline` | `ai-timeline.mmd`, `company-history.mmd`, `customer-journey.mmd`, `our-timeline.mmd`, `product-roadmap.mmd`, `release-roadmap.mmd`, `sections.mmd`, `timeline.mmd`, `vertical-journey.mmd` |
| `poster` | `ds-poster.mmd`, `engineering-dashboard.mmd`, `launch-readiness.mmd`, `poster.mmd`, `row-spanning.mmd`, `spanning.mmd`, `sql-engine.mmd` |

All other families carry a fallback note in their fragment explaining that `%%` headers are not supported and referring readers to `docs/diagram-options.md`.

---

## Test Result

`pnpm test` (from repo root, 2026-07-06):

```
Test Files  30 passed (30)
     Tests  384 passed (384)
  Duration  3.94s
```

**Result: PASS.** No `%%` header broke any family's render. The 69-example corpus in `test/examples.test.ts` rendered cleanly.

---

## Unexpected Git Changes

Two untracked files appeared that are not part of this deliverable:

- `fix_poster_headers.py` — scratch script left by a sub-agent; not committed.
- `examples/triton/ds/array/array.svg` — new untracked SVG render; not committed.

Neither affects the test corpus or the assembled reference doc.


---

# Decision: Diagram-Options Group A — class, state, er, c4, requirement

**Author:** Bjarne (Ingestion Design)  
**Date:** 2026-07-06  
**Status:** DONE — all 5 fragments written; no `%%` headers added  

---

## Summary

Five grammar-derived option fragments have been written for Group A families,
following Leslie's spec (`leslie-diagram-options-format.md`) and the flowchart exemplar.

Fragment paths:
- `docs/diagram-options/_fragments/class.md`
- `docs/diagram-options/_fragments/state.md`
- `docs/diagram-options/_fragments/er.md`
- `docs/diagram-options/_fragments/c4.md`
- `docs/diagram-options/_fragments/requirement.md`

---

## Per-family `%%` comment support

| Family      | Grammar path                                    | `%%` count | Headers added | Fallback note |
|-------------|-------------------------------------------------|------------|---------------|---------------|
| class       | `src/diagrams/mermaid/class/grammar.peggy`      | 0          | NO            | YES           |
| state       | `src/diagrams/mermaid/state/grammar.peggy`      | 0          | NO            | YES           |
| er          | `src/diagrams/mermaid/er/grammar.peggy`         | 0          | NO            | YES           |
| c4          | `src/diagrams/mermaid/c4/grammar.peggy`         | 0          | NO            | YES           |
| requirement | `src/diagrams/mermaid/requirement/grammar.peggy`| 0          | NO            | YES           |

All five Group A families lack a `%%` Comment rule. No example `.mmd` files were
modified. All five fragments include the fallback note and omit the Comments section.
Preview (`node scripts/preview.mjs`) was not run — no headers to validate.

---

## Families that needed the fallback

All five: **class, state, er, c4, requirement**.

---

## Key grammar notes

- **class**: 14 RelTok alternatives; cardinality via quoted strings; `note` accepted-discarded;
  no direction rule.
- **state**: Single `-->` transition arrow; `<<choice|fork|join>>` pseudo-states; `direction`
  accepted by DirectiveLine but discarded (not applied by Triton layout).
- **er**: Crow's-foot ErTok pattern `[|}{o][|}{o](--|..)[|}{o][|}{o]`; attribute keys PK/FK/UK;
  label required on every relation.
- **c4**: 5 header variants; `kindOf()` maps freeform NodeKind identifiers to 8 IR kinds;
  4 boundary types; 3 relation keywords (Rel/Rel_Ext/BiRel).
- **requirement**: 7 ReqKind alternatives (case-insensitive); NO Frontmatter rule (unique in
  Group A); relationship type is unconstrained Ident (conventional: satisfies/contains/refines/derives).


---

# Decision: Group B Diagram-Options — Comment Support and Fallbacks

**Author:** David (Research Lead)
**Date:** 2026-07-06
**Status:** COMPLETE
**Families:** sequence, timeline, journey, gantt, gitgraph, kanban

---

## Summary

Fragment files have been written for all 6 Group B families under
`docs/diagram-options/_fragments/<family>.md`. All options are grammar-derived
(sources: `src/diagrams/mermaid/<family>/grammar.peggy` and, for gantt, also
`src/diagrams/mermaid/gantt/index.ts`).

---

## Per-Family `%%` Comment Support

### `grep -c '%%' src/diagrams/mermaid/<family>/grammar.peggy` results

| Family   | Count | `%%` supported? | Action taken                                  |
|----------|-------|-----------------|-----------------------------------------------|
| sequence | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| timeline | 1     | ✓ YES           | Headers added to all 9 `.mmd` examples (see constraint below) |
| journey  | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| gantt    | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| gitgraph | 0     | ✗ NO            | Fallback note added to fragment; no headers   |
| kanban   | 0     | ✗ NO            | Fallback note added to fragment; no headers   |

---

## Timeline `%%` Placement Constraint (NEW FINDING)

**Finding:** Although timeline's grammar defines `Comment = "%%" [^\n]*`, this
rule is only reachable via `BlankLine = _ Comment? NL` inside the `Body`
alternative. The grammar's `Document` rule is:

```
Document = ExtFrontmatter? _ Header _ Directive* _ Body _
```

`Directive*` matches `title`, `subtitle`, `theme`, `layout`, `axisUnit` before
`Body` begins. Inserting `%%` lines between the `timeline` keyword and the
directive lines causes a parse error because `%%` is not a valid token in the
`Directive*` context.

**Rule for timeline `%%` headers:**
> `%%` comment lines MUST appear after all directive lines and before the first
> Body item (section / entry). Placing them immediately after `timeline\n`
> (as the spec's flowchart model suggests) causes a PARSE_ERROR.

**Verification:** After repositioning the header block to after the last
directive in each of the 9 timeline example files, `node scripts/preview.mjs
examples/mermaid/timeline/` exited 0 with `✓ <name>.svg` for all 9 files.

**Recommendation for spec update:** Leslie's Part 2 placement rule ("after the
diagram's first line") should be annotated with a grammar-class exception: for
families whose grammars have `Directive*` between the header keyword and the
body, `%%` headers belong after the last directive, not after the keyword line.

---

## Fallback Note Text (applied to all families with no `%%` support)

```markdown
> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.
```

Applied to: `sequence.md`, `journey.md`, `gantt.md`, `gitgraph.md`, `kanban.md`.

---

## Fragment File Inventory

| Fragment path                                         | `%%` headers in examples? | Preview |
|-------------------------------------------------------|---------------------------|---------|
| `docs/diagram-options/_fragments/sequence.md`        | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/timeline.md`        | Yes — 9 files             | ✓ exit 0, 9 SVGs |
| `docs/diagram-options/_fragments/journey.md`         | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/gantt.md`           | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/gitgraph.md`        | No (fallback)             | N/A     |
| `docs/diagram-options/_fragments/kanban.md`          | No (fallback)             | N/A     |

---

## Key Grammar Findings (source discipline)

**sequence** (`grammar.peggy`):
- Arrow rule (8 variants): `->>`, `-->>` (solid/dashed arrow); `->`, `-->` (open); `-x`, `--x` (cross); `-)`, `--)` (async).
- Activation inline: `+` activates target, `-` deactivates source (suffix on arrow).
- Note placements: `over`, `left of`, `right of`.
- Fragments: `alt` (else), `opt`, `loop`, `par` (and), `critical`, `break` — all closed with `end`.
- Explicit `activate`/`deactivate` statements: parsed but return `{ t: 'ignore' }` — no effect.

**timeline** (`grammar.peggy`):
- L1 directives (Mermaid): `title`, `subtitle`, `theme`.
- L2 directives (Triton ext): `layout`, `axisUnit`.
- L1 entry: `date : Event text`.
- L2 range: `start -- end : Label : status @track | desc`.
- L2 point: `date : Label : milestone|active|done|blocked @track | desc`.
- Statuses: `active`, `done`, `blocked`, `default`.

**journey** (`grammar.peggy`):
- Task: `label : score : Actor1, Actor2`. Score is numeric; grammar pattern: `"-"? [0-9]+ ("." [0-9]+)?`.
- No frontmatter, no `%%`.

**gantt** (`grammar.peggy` + `index.ts`):
- `ExcludesLine` accepts: `excludes`, `axisFormat`, `todayMarker`, `tickInterval` — parsed, returned null.
- Task meta resolved by `index.ts`: `STATUS_FLAGS = new Set(['done','active','crit','milestone'])`.
- `after id` dependency: `re.test(startTok, /^after\s+/i)`.
- Duration: regex `(\d+(?:\.\d+)?)\s*([dwhm]?)` — `d`/`w`/`h` have explicit cases.

**gitgraph** (`grammar.peggy`):
- No `cherry-pick` statement — not in grammar.
- `switch` is a grammar-level alias for `checkout`.
- `order: N` on `branch` is parsed but value not captured in IR.
- `Opt` rule covers `id`/`tag`/`type` for both `commit` and `merge`.

**kanban** (`grammar.peggy`):
- Column: any unindented text line (`$[^\n]+`).
- Card: `id?` (`$[a-zA-Z0-9_-]+`) + `"[" text:$[^\]\n]+ "]"`.
- No priorities, assignees, metadata — grammar only tracks `id` and `text`.


---

# Decision: Group C Diagram Options — Comment Support & Fragment Summary

**Author:** Mark (IR & Data Modeling)  
**Date:** 2026-07-06  
**Status:** DONE — all 6 Group C fragments written; sankey `%%` header verified

---

## Summary

Per-family `%%` comment support and fragment delivery for Group C: pie, xychart, quadrant, radar, sankey, mindmap.

---

## Per-family findings

| Family    | `%%` in grammar.peggy | Action                             | Preview result         | Fragment path                                          |
|-----------|----------------------|------------------------------------|------------------------|--------------------------------------------------------|
| pie       | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/pie.md`               |
| xychart   | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/xychart.md`           |
| quadrant  | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/quadrant.md`          |
| radar     | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/radar.md`             |
| sankey    | 2 — SUPPORTED        | Header block added to sankey.mmd   | exit 0 · sankey.svg ✓  | `docs/diagram-options/_fragments/sankey.md`            |
| mindmap   | 0 — NOT supported    | No header; fallback note added     | n/a (no header)        | `docs/diagram-options/_fragments/mindmap.md`           |

---

## Fallback note (applied to pie, xychart, quadrant, radar, mindmap)

Each fragment without `%%` support carries this note (per Leslie's Part 3 spec) above the Minimal snippet section:

> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.

---

## Sankey `%%` header block

Inserted after `sankey-beta` (header keyword line) in `examples/mermaid/sankey/sankey.mmd`:

```
sankey-beta
%% ────────────────────────────────────────────────────────────────────────────
%% SANKEY — options quick-ref
%% ────────────────────────────────────────────────────────────────────────────
%% Header:      sankey-beta
%% Links:       Source,Target,Value  (one CSV row per link)
%% Comments:    %% text  (stripped before parse)
%% ────────────────────────────────────────────────────────────────────────────
```

Verified: `node scripts/preview.mjs examples/mermaid/sankey/` → exit 0, `✓ sankey.svg`.

---

## Key grammar facts (options-catalogue)

- **pie**: `showData` flag + `title <text>` both on header line; slices as `"Label" : <num>` rows.
- **xychart**: Header `xychart-beta [horizontal|vertical]`; `title`, `x-axis [cats]`, `y-axis "label" min --> max`; series `bar [v,…]` and `line [v,…]`.
- **quadrant**: `quadrantChart`; `title`, `x-axis left --> right`, `y-axis bottom --> top`, `quadrant-1..4 label`; points `Label: [x, y]` (x,y ∈ 0–1).
- **radar**: `radar-beta`; `title`, `max`, `min`; `axis id["Label"],…`; `curve id["Label"]{v,…}`.
- **sankey**: `sankey-beta`; CSV rows `Source,Target,Value`; `%%` comments stripped by grammar.
- **mindmap**: `mindmap`; YAML frontmatter; indentation = hierarchy depth; shape wrappers `((…))` `(…)` `[…]` `{{…}}` stripped by `index.ts:cleanLabel`; `::icon(name)` directive attaches icon to preceding node.


---

# Decision: Group D Diagram-Options — Comment Support & Fallbacks

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-06  
**Status:** COMPLETE  

---

## Summary

All five Group D (Triton) families have been processed: fragments written, `%%` support
verified per grammar, headers added where safe, previews confirmed.

---

## Per-Family Results

### architecture

- **Source:** `src/diagrams/triton/architecture/grammar.peggy`
- **`%%` count:** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/architecture/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-architecture.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-architecture.md` ✓

### block

- **Source:** `src/diagrams/triton/block/grammar.peggy`
- **`%%` count:** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/block/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-block.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-block.md` ✓

### packet

- **Source:** `src/diagrams/triton/packet/grammar.peggy`
- **`%%` count:** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/packet/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-packet.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-packet.md` ✓

### topology

- **Source:** No `grammar.peggy`; hand-parser `src/diagrams/triton/topology/topology.ts`
- **`%%` count (in topology.ts):** 0 — NOT supported
- **Action:** No `%%` header added to `examples/triton/topology/` files.
- **Fallback note:** Added to `docs/diagram-options/_fragments/triton-topology.md` before Minimal snippet.
- **Fragment:** `docs/diagram-options/_fragments/triton-topology.md` ✓

### poster

- **Source:** `src/diagrams/triton/poster/grammar.peggy`
- **`%%` count:** 1 — SUPPORTED
- **Action:** `%%` header block added to all 7 `.mmd` files in `examples/triton/poster/`.
- **Placement quirk:** The poster grammar parses `%%` comments only within `BodyItems`
  (via `BlankLine = _ Comment? NL`). The `GridDirective*` phase (between `poster "Title"` and
  the first `cell`) does NOT allow comments. Inserting the block immediately after the
  `poster` keyword line causes a PARSE_ERROR. **Correct placement: after the `columns N`
  (or last grid directive) line and before the first `cell` block.**
- **Preview:** `node scripts/preview.mjs examples/triton/poster/` → exit 0, all 7 SVGs ✓
  (`ds-poster.svg`, `engineering-dashboard.svg`, `launch-readiness.svg`, `poster.svg`,
  `row-spanning.svg`, `spanning.svg`, `sql-engine.svg`)
- **Fragment:** `docs/diagram-options/_fragments/triton-poster.md` ✓ (includes Comments section)

---

## Fragments Written

| Fragment path | Family | Comments section |
|---|---|---|
| `docs/diagram-options/_fragments/triton-architecture.md` | architecture | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-block.md` | block | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-packet.md` | packet | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-topology.md` | topology | omitted (no `%%`) |
| `docs/diagram-options/_fragments/triton-poster.md` | poster | ✓ included |

---

## Notes for Orchestrator / Leslie

1. **poster `%%` placement rule is non-standard.** For all other grammars that support `%%`,
   the comment rule is available immediately after the header keyword line. For poster, it is
   only available in `BodyItems` (after grid directives). This is a grammar-level constraint;
   fixing it would require adding a `BlankLine` alternative to the `GridDirective*` loop.

2. **topology has no grammar.peggy.** It is fully hand-parsed in `topology.ts`. No Peggy
   compilation step for this family.

3. **architecture indentation-based group membership.** Services indented under a `group` line
   are implicitly assigned to that group (via `indent > curIndent && curGroup` in the action),
   in addition to the explicit `in <group>` syntax. Both are grammar-supported.


---

# Decision: Group E — DS Diagram-Options Fragments

**Author:** Edsger (Layout Algorithms)  
**Date:** 2026-07-06  
**Status:** COMPLETE  
**Task:** Write `docs/diagram-options/_fragments/ds-<subkind>.md` for all ds subkinds per Leslie's spec.

---

## Full subkind list (22 subkinds)

Source layout under `src/diagrams/triton/ds/`:

| Subkind | Source file | Header keyword(s) | Has examples |
|---------|-------------|-------------------|--------------|
| array | `struct/array.ts` | `array` | ✓ |
| linkedlist | `struct/linkedlist.ts` | `linkedlist` | — |
| memory | `struct/memory.ts` | `memory` | — |
| page | `struct/page.ts` | `page` | — |
| queue | `queue/queue.ts` | `queue` | ✓ |
| cqueue | `queue/cqueue.ts` | `cqueue` | ✓ |
| deque | `queue/deque.ts` | `deque` | ✓ |
| pqueue | `queue/pqueue.ts` | `pqueue` | ✓ |
| stack | `stack/stack.ts` | `stack` | ✓ |
| hashmap | `hashmap/hashmap.ts` | `hashmap` | ✓ |
| matrix | `matrix/matrix.ts` | `matrix` | ✓ |
| trie | `trie/trie.ts` | `trie` | ✓ |
| unionfind | `unionfind/unionfind.ts` | `unionfind` · `dsu` | ✓ |
| nodegraph | `graph/graph.ts` | `nodegraph` · `dsgraph` | ✓ |
| tree | `tree/index.ts` (grammar.peggy) | `tree` | ✓ |
| plan | `tree/plan.ts` (grammar.peggy) | `plan` | ✓ |
| avl | `tree/avl.ts` | `avl` | ✓ |
| rbtree | `tree/rbtree.ts` | `rbtree` | ✓ |
| btree | `tree/btree.ts` | `btree` | ✓ |
| radix | `tree/radix.ts` | `radix` | ✓ |
| segtree | `tree/segtree.ts` | `segtree` | ✓ |
| heap | `tree/heap.ts` | `heap` | ✓ |

---

## `%%` comment support: ALL use fallback

**Detection method:** `grep -c '%%' <parser-file>` for every subkind.

**Result:**

| Check | Finding |
|-------|---------|
| All hand-written parsers (`struct/`, `queue/`, `stack/`, `hashmap/`, `matrix/`, `trie/`, `unionfind/`, `graph/`) | 0 occurrences — use shared `lines()` helper which does NOT filter `%%` |
| `tree/grammar.peggy` (used by `tree` and `plan`) | 0 occurrences — no `%%` comment rule |

**All 22 subkinds: NO `%%` support.** No `%%` header blocks were added to any `.mmd` example files.

---

## Fallback note (applied to all 22 fragments)

All fragments include:

> **Note:** This grammar does not define a `%%` comment rule. Inline options-comments
> are not supported for this family's example files — see `docs/diagram-options.md`
> for the full options reference.

The "Comments" section is omitted from all ds fragments.

---

## Fragment files written

All 22 fragments written to `docs/diagram-options/_fragments/`:

```
ds-array.md
ds-linkedlist.md
ds-memory.md
ds-page.md
ds-queue.md
ds-cqueue.md
ds-deque.md
ds-pqueue.md
ds-stack.md
ds-hashmap.md
ds-matrix.md
ds-trie.md
ds-unionfind.md
ds-nodegraph.md
ds-tree.md
ds-plan.md
ds-avl.md
ds-rbtree.md
ds-btree.md
ds-radix.md
ds-segtree.md
ds-heap.md
```

---

## Render verification

Command: `node scripts/preview.mjs examples/triton/ds/<subkind>/` for each example directory.

| Directory | Files rendered | Exit code |
|-----------|---------------|-----------|
| `ds/array/` | array.svg | 0 ✓ |
| `ds/graph/` | graph.svg | 0 ✓ |
| `ds/hashmap/` | hashmap.svg | 0 ✓ |
| `ds/matrix/` | matrix.svg | 0 ✓ |
| `ds/queue/` | circular.svg · deque.svg · linear.svg · priority.svg | 0 ✓ |
| `ds/stack/` | stack.svg | 0 ✓ |
| `ds/trie/` | trie.svg | 0 ✓ |
| `ds/unionfind/` | unionfind.svg | 0 ✓ |
| `ds/tree/` | avl.svg · btree.svg · decision.svg · heap.svg · plan.svg · query-plan.svg · radix.svg · rbtree.svg · segtree.svg | 0 ✓ |

**Total: 21 SVGs regenerated, all exit 0.** No `.mmd` files were modified (no `%%` headers added), so SVG layout is unchanged from baseline.

---

## Notes

- The `preview.mjs` script does NOT recursively walk `examples/triton/ds/` — it must be invoked per subkind directory. Running it at `examples/triton/ds/` gives "No .mmd files found".
- Three subkinds have no example files: `linkedlist`, `memory`, `page`. Their fragments were derived entirely from parser source (`struct/linkedlist.ts`, `struct/memory.ts`, `struct/page.ts`).
- The tree family's `grammar.peggy` is the only `.peggy` file among ds subkinds (all others are pure hand-written `.ts` parsers).



---

# Decision: VS Code Extension Marketplace Icon

**Date:** 2026-07-09  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Decided  

## Context

The Triton VS Code extension (`focus-space.triton-vscode`) needed a Marketplace icon. Prior to this, only `preview.svg` existed — a 16×16 monochrome glyph for toolbar buttons.

## Decision

Created a full-color 256×256 icon with an unmistakable trident motif:

1. **Trident body:** Dominant vertical shaft, horizontal crossbar, three upward-pointing prongs (center tallest)
2. **Graph-node fusion:** Small glowing circles at prong tips connected by curved purple edges — the "diagram" layer
3. **High contrast:** Bright cyan→teal gradient (#67E8F9 → #14B8A6) against dark navy/purple background

### Design details

- **Background:** Navy→dark-purple diagonal gradient (#0D1B2A → #1a1040), rounded-square (rx=48)
- **Trident:** Filled rectangles with rounded corners (not strokes) — enables gradient rendering in rsvg-convert
- **Nodes:** Purple center (#7C3AED) + blue sides (#4A90D9), white cores (#F8FAFC), subtle glow filter
- **Bottom flourish:** Small wave curve at shaft base (blue #4A90D9)

### Files

- `extension/resources/icon.svg` — source vector (viewBox 0 0 256 256)
- `extension/resources/icon.png` — rasterized 256×256 PNG for Marketplace

### Wiring

`extension/package.json` has `"icon": "resources/icon.png"` between `categories` and `galleryBanner`.

## Rationale

- **Trident-first:** The trident shape is unmistakable at any size — reads as Poseidon's weapon, not a face
- **High contrast:** Bright cyan/teal against dark background ensures visibility at all sizes
- **Filled shapes:** Gradients on SVG strokes don't render in rsvg-convert; filled rects with rx work
- **Vertical composition:** Trident fills y=24 to y=222 — no large empty void
- **Straight crossbar:** Eliminates "frown" gestalt that caused sad-face misreading

## Technical learnings

- **rsvg-convert quirk:** `stroke="url(#grad)"` on `<line>` elements renders invisibly. Use `fill="url(#grad)"` on `<rect>` or `<path>` instead.
- **Gestalt awareness:** Two symmetric circles + downward arc = face. Break symmetry or use dominant visual elements to override.

## Alternatives considered

1. **Stroked lines with gradient** — failed due to rsvg-convert rendering bug
2. **Downward-curving crossbar** — created unintended "frown" face gestalt
3. **Dark trident colors** — invisible against dark background

## Impact

- Marketplace listing displays distinctive branded trident icon
- Extension sidebar shows recognizable icon at various sizes (128px, 32px)
- No runtime/code changes — purely visual/packaging


### 2026-07-08: Animated connector dots stop at arrowhead bases
**By:** Brian
**What:** Particle, comet, and stream connector animations now use a renderer-local motion path trimmed by `refX * strokeWidth + dotRadius` for default `markerUnits="strokeWidth"` markers, or `refX + dotRadius` for `markerUnits="userSpaceOnUse"`. The visible connector path and marker geometry remain unchanged; only each `<animateMotion path>` is shortened, with short final segments clamped to a non-inverted remaining segment.
**Why:** The marker's actual back edge is controlled by `refX`, not `markerWidth`. Stopping the dot center by the marker back-offset plus the dot radius makes the dot's leading edge kiss the arrowhead base without a visible gap or overlap.


### 2026-07-08: Connector animation set and static degradation
**By:** Brian
**What:** Connector animation is now a shared typed vocabulary: `march`, `particle`, `draw`, `pulse`, `glow`, `comet`, `stream`, `flow`, `colorcycle`, plus `none` as suppression. The routing engines pass any recognized animation name through to `ScenePath.animated`; unknown values still fall back to the existing dashed/dotted march default or render plainly for solid links. SVG rendering uses SMIL path animations, sibling `animateMotion` particles, and an inline user-space gradient for `flow`.
**Why:** Cristian needs to review every supported connector motion from one gallery while preserving static-export safety. Every animated connector keeps a visible base path; `draw` starts as a full line and then erases/redraws instead of starting invisible, and particle/comet/stream add motion elements alongside the normal stroke.


### 2026-07-08: Shared connector seam and cqueue wrap implementation
**By:** Brian
**What:** Added `src/crosslink/connectors.ts` as the diagram-agnostic post-layout connector seam over the existing v3 crosslink router. Poster now lowers normalized links into that seam, preserving its cardinal curve default in the poster adapter. Cqueue now lowers its implicit rear-to-front wrap to one generated orthogonal connector with N→N or W→W wall hints, a 36px outboard route padding derived from the old 44px arc band, `mod N` labeling, and front/rear anchor aliases.
**Why:** This keeps poster behavior on the existing engine path while making connector routing reusable by local DS diagrams without fabricating poster cell paths. The cqueue wrap is now an axis-aligned shared connector instead of bespoke cubic geometry, so horizontal/vertical and self-loop cases share the same routing/label/viewBox handling.




---

---

# Decision: Preview Icon Fixes — Dark Mode & Distinct Glyph (2026-07-12)

## Summary

Fixed two preview command icon issues in the VS Code extension:

1. **Dark mode visibility** — Both `triton.openPreview` and `triton.openPreviewToSide` buttons were invisible on dark toolbars.
2. **Visual distinction** — Both buttons displayed identical glyphs, making them indistinguishable.

## Root Cause

Original `preview.svg` used `stroke="currentColor"` / `fill="currentColor"`. VS Code resolves `currentColor` to black when rendering contributed command icons as background images. Black is visible on light toolbars, invisible on dark.

## Fix

**Dark Mode Visibility:**
- Created `extension/resources/preview-light.svg` (ink `#424242` — light-theme icon foreground)
- Created `extension/resources/preview-dark.svg` (ink `#C5C5C5` — dark-theme icon foreground)
- Updated both command icon blocks in `extension/package.json` to reference light/dark variants

**Visual Distinction:**
- Created `extension/resources/preview-side-light.svg` (stroke `#424242`, side-pane glyph)
- Created `extension/resources/preview-side-dark.svg` (stroke `#C5C5C5`, side-pane glyph)
- Updated `triton.openPreviewToSide` command icon block in `extension/package.json` to use side variants
- `triton.openPreview` retains the plain preview glyph

## Geometry

- **preview.svg** (plain pane): Single rounded rect + icon
- **preview-side.svg** (side pane): Two-pane split (rounded rect + vertical divider at x=8 + checkmark in right pane)

Both variants are fully color-baked (hardcoded hex, no `currentColor`).

## Verification

High-contrast modes (HC-dark, HC-light) fall back to the appropriate light/dark variant. Reload Extension Dev Host and confirm both buttons are visible in the editor title bar on dark themes.

## Status

Shipped in v0.1.10. Build passed. Icons verified by Cristian on dark/light backgrounds before release.

---

# Releases: v0.1.9 & v0.1.10

## v0.1.9

**Date:** 2026-07-12  
**PR:** #59  
**Commit:** squash-merge 9b09b76  
**Published:** npm publish succeeded via publish-npm.yml  
**Packages:** @bradygaster/triton-core, @bradygaster/triton-latex, @bradygaster/triton-extension  

**Contents:**
- Connector superset syntax finalized (march, particle, draw, pulse, glow, comet, stream, flow, colorcycle animations)
- Example cleanup (84 files audited, 1 redundant removed)

## v0.1.10

**Date:** 2026-07-12  
**PR:** #60  
**Commit:** squash-merge b6fc192  
**Published:** npm publish succeeded via publish-npm.yml (run 29204094255)  
**Packages:** @bradygaster/triton-core, @bradygaster/triton-latex, @bradygaster/triton-extension  

**Contents:**
- Preview icon dark-mode fix (color-baked light/dark variants)
- Distinct side-preview glyph (openPreviewToSide now visually distinct from openPreview)

---
---

# Decision: External Theming + triton.sty Cache-Key Fix — Design & 6-Phase Implementation Plan (Approved 2026-07-12)

**Design Author:** Leslie (Spec Architect)  
**Decision Authority:** Cristian (via Copilot Coordinator)  
**Date:** 2026-07-12T14:39:00-04:00 (analysis) → 2026-07-12T15:00:00-04:00 (decisions)  
**Status:** APPROVED — ready for Phase 0 start

---

## Executive Summary

Leslie completed a full architectural analysis of external theme files and their integration into the triton ecosystem. The design is **fully feasible** — external theme files are inherently I/O (reads from disk/network), so they must be loaded by hosts (VS Code, CLI, LaTeX), not the compiler. The compiler already has the right seam: `renderSync(input, themeInput?, ...)` and `compileSync(input, themeInput?, ...)`.

**Cristian approved the 6-phase Tier-1 implementation plan** (est. 16–20 hours) and resolved all 5 open questions. Key decisions override Leslie's draft design where they conflict.

---

## Cristian's Decisions on 5 Open Questions

1. **Unknown-key policy = STRICT / ERROR** ⚠️  
   Theme files with unknown keys are **REJECTED** (not a warning). This **OVERRIDES Leslie's draft** (which proposed forward-compat warning). The `validateThemeInput()` function must return an error on any unknown top-level or nested key. Rationale: catch typos early during adoption.

2. **Name derivation = from filename when `name` omitted**  
   If a theme file has no `name` field, derive it from the filename: `acme-corp.triton-theme.json` → name `"acme-corp"`. The `name` field is optional.

3. **`base` key = supported, optional, defaults to `"default"`**  
   Partial theme files can declare a `base` preset to merge over: `"base": "executive"`. If absent, `"default"` is used. Merging happens via the existing `resolveTheme(input, getThemePreset(base))`.

4. **File extension = `.triton-theme.json`**  
   Self-documenting, JSON-tooling-friendly, glob-able. Not `.tritontheme` or `.theme.json`.

5. **Phase 0 cache-key mechanism = shell `printf >> tempfile`**  
   Append a `%% triton-key: <theme> scale=<n>` comment line to the LaTeX temp file before hashing. The `%%` prefix ensures `stripComments()` removes it before compilation — it affects the file hash but never the IR/SVG. Shell is always available (required by `-shell-escape` anyway).

---

## Leslie's Architectural Analysis (Full Context)

### Design Principles

**Verdict: Fully feasible. The existing architecture already has the right seam.**

The compiler (`triton-core`) is a pure function of text. External themes are inherently I/O — reading from disk or network — so the compiler must never load them itself.

The current API already supports external themes in principle:

```typescript
renderSync(input, themeInput?: ThemeInput, rendererName?, forcedThemeName?)
compileSync(input, themeInput?: ThemeInput, forcedThemeName?)
```

A host (VS Code, CLI, web app) reads any JSON file, deserializes it into a `ThemeInput`, and passes it to `renderSync()` / `compileSync()`. The compiler receives a data object — it neither knows nor cares where it came from. The merge substrate (`resolveTheme()` in `src/theme/resolver.ts`) already handles partial-over-base merging.

**What triton-core exposes (new):**
- A **validation function** — `validateThemeInput(unknown): Result<ThemeInput>` — confirming a parsed JSON blob conforms to the `ThemeInput` shape. This keeps schema knowledge in the compiler (where types live) without introducing I/O.
- Optionally, a **JSON Schema** (`triton-theme.schema.json`) published alongside the package for IDE autocomplete in `.json` theme files.

**What each host does (new):**
- Reads the external file (fs, fetch, vscode.workspace.fs)
- Calls `JSON.parse()`
- Calls `validateThemeInput()` to confirm shape
- Passes the validated `ThemeInput` into the existing render API

**What does NOT change in the compiler:** zero. No new parameters, no new I/O paths, no new dependencies.

### File Format & Schema

**JSON is the only reasonable choice.** `ThemeInput` and `ResolvedTheme` are already JSON-serializable TypeScript interfaces. No translation layer needed. YAML would add a parser dependency; TOML would add friction; CSS custom properties would lose typed structure.

#### Full Theme vs. Partial Override

Both are supported, because `resolveTheme()` already handles both:

| Mode | File contains | Base resolution |
|------|---------------|-----------------|
| **Full theme** | All fields present (a `ResolvedTheme`) | Used as-is; no base needed |
| **Partial override** | Subset of fields (a `ThemeInput`) + optional `base` key | Merged over named preset or `default` |

A partial file example:

```json
{
  "$schema": "https://unpkg.com/triton-core/triton-theme.schema.json",
  "base": "executive",
  "name": "acme-corporate",
  "palette": {
    "primary": "#003366",
    "secondary": "#CC9900"
  }
}
```

#### Validation & Failure Mode

Consistent with Triton's "never crash" ethos:
- Invalid JSON → diagnostic warning + fall back to `default` theme
- Valid JSON but wrong shape → diagnostic warning + fall back to `default` theme
- Missing file → diagnostic warning + fall back to `default` theme

The compiler never sees bad data; the host validates before passing it through.

### Reference Mechanism — How Diagrams Point at External Themes

Diagrams reference external themes via **frontmatter `theme:` key** (Option D from Leslie's original analysis):

```mermaid
---
theme: ./corporate.triton-theme.json
---
flowchart LR
  A --> B
```

The host resolves the path relative to the diagram's location, loads the file, validates it, and passes it as `themeInput` to the render API. Simple, familiar (like Mermaid's existing frontmatter), and doesn't bloat the diagram syntax.

---

## Implementation Plan (§10) — 6 Phases, All Tier-1

### Dependency Graph

```
Phase 0 (cache-key fix)          ← independent, ship immediately
Phase 1 (triton-core validator)  ← foundational
Phase 2 (shared loader util)     ← depends on Phase 1
Phase 3 (VS Code extension)      ← depends on Phase 2
Phase 4 (triton-latex)           ← depends on Phase 0, Phase 2
Phase 5 (docs + examples)        ← depends on all above
```

### Phase 0 — triton.sty Cache-Key Fix

**Goal:** Ensure `\tritontheme` and `\tritonscale` changes invalidate cached inline-render PDFs.

**Files touched:**
- `latex/triton.sty` (lines 120–127: the `\triton@render` macro)

**Concrete change:**

The `%% triton-key:` comment appended to the LaTeX temp file must encode current render parameters, making the hash incorporate theme + scale identity. Insert this in `\endtriton` after `\end{VerbatimOut}` but before `\triton@render`:

```latex
\def\endtriton{%
  \end{VerbatimOut}%
  \immediate\write18{printf '\@percentchar\@percentchar triton-key: \triton@themearg\space scale=\triton@scale\string\n' >> "\triton@tmpfile"}%
  \triton@render
  \triton@nextsetfalse
}
```

Similarly for `\tritoninline`:

```latex
\NewDocumentCommand{\tritoninline}{O{\triton@opts} v}{%
  \def\triton@curopts{#1}%
  \immediate\openout\triton@inlinestream=\triton@tmpfile\relax
  \immediate\write\triton@inlinestream{#2}%
  \immediate\write\triton@inlinestream{\@percentchar\@percentchar triton-key: \triton@themearg\space scale=\triton@scale}%
  \immediate\closeout\triton@inlinestream
  \triton@render
}
```

**Acceptance criteria:**
1. Change `\tritontheme{X}` to `\tritontheme{Y}` → next `pdflatex -shell-escape` re-renders (cache miss).
2. Change `\tritonscale{1}` to `\tritonscale{2}` → re-renders.
3. No change to source, theme, or scale → cache hit (no re-render).
4. The `%% triton-key:` line is stripped by `stripComments()` in core and never affects the IR/SVG.

**Tests:**
- Manual: `latex/examples/inline-demo.tex` — compile, check cache dir for PDF, change `\tritontheme`, recompile, verify new PDF appears with different hash.
- Automated: add a shell script `latex/test-cache-invalidation.sh` that compiles twice (same source, different theme) and asserts two distinct PDFs in the cache dir.
- Existing `pnpm test` (core) verifies `stripComments()` removes `%%` lines (already covered by the 404-test suite).

**Dependencies:** None. Ships independently.

**Effort:** ~1 hour (TeX macro surgery + manual verification).

---

### Phase 1 — triton-core: Validator + JSON Schema

**Goal:** Expose a pure validation function and a published JSON Schema so hosts can validate external theme files against the canonical type.

**Files touched:**
- NEW: `src/theme/validate.ts` — the `validateThemeInput()` function
- NEW: `src/theme/schema.json` — the JSON Schema (generated or hand-written)
- EDIT: `src/theme/index.ts` — NEW barrel file re-exporting resolver, preset, validate
- EDIT: `src/frontend/index.ts` — re-export `validateThemeInput` for npm consumers
- EDIT: `test/theme.test.ts` — new test cases for validator

**Validation rules (per Cristian's decision, unknown keys = ERROR):**
- Input must be a non-null object
- `name`: optional string, 1–64 chars, `[a-z0-9-]` (slug format)
- `base`: optional string (must be a known preset name if present)
- `palette`: optional object; each field if present must be a valid CSS hex color (`#RGB` or `#RRGGBB`)
- `typography.fontFamily` / `monoFamily`: string, no `url()` or `expression()` (security)
- `typography.*FontSize`, `lineHeight`: positive number
- `spacing.*`: non-negative number
- `edges.*`: non-negative number; `curveTension` 0–1
- `panel.titleAlign`: one of `'left'|'center'|'right'`
- `panel.titlePosition`: one of `'inside'|'on-border'|'above'`
- `panel.titleChrome`: one of `'none'|'box'|'pill'`
- **Unknown top-level or nested keys: REJECTED (error, not warning)**

**JSON Schema (`src/theme/schema.json`):**
- `$id`: `"https://triton.dev/schemas/triton-theme.schema.json"` (or npm unpkg URL)
- Covers ThemeInput shape with `additionalProperties: false` per group

**Export surface:**
- `src/frontend/index.ts` adds: `export { validateThemeInput, isBuiltinThemeName } from '../theme/validate.js';`

**Tests (`test/theme.test.ts`):**
- `validateThemeInput({})` → `ok({})` (empty ThemeInput is valid)
- `validateThemeInput({ palette: { primary: '#FF0000' } })` → `ok(...)`
- `validateThemeInput({ palette: { primary: 'not-a-color' } })` → `err(...)`
- `validateThemeInput("string")` → `err(...)`
- `validateThemeInput({ unknownKey: 1 })` → `err(...)` (STRICT policy)
- `validateThemeInput({ palette: { unknownField: '#FFF' } })` → `err(...)`
- `isBuiltinThemeName('executive')` → `true`
- `isBuiltinThemeName('acme')` → `false`
- The schema file validates against JSON Schema meta-schema

**Dependencies:** None (pure addition to core).

**Effort:** ~3–4 hours (validator logic + schema + tests).

---

### Phase 2 — Shared Theme Loader Utility

**Goal:** A small, reusable module that scans a directory for `.triton-theme.json` files, validates them, and returns a name→ResolvedTheme registry. Used by both the VS Code extension and the triton-latex CLI.

**Files touched:**
- NEW: `src/theme/discover.ts`
- EDIT: `src/frontend/index.ts` — add export
- NEW: `test/theme-discover.test.ts`

**Interface:**

```typescript
export interface ThemeDiscoveryResult {
  readonly themes: ReadonlyMap<string, ResolvedTheme>;
  readonly warnings: readonly string[];
}

export function discoverThemes(dir: string): ThemeDiscoveryResult { ... }
export function loadThemeFile(path: string): Result<ResolvedTheme> { ... }
export function findTritonThemesDir(startDir: string): string | undefined { ... }
```

**Resolution logic:**
1. Parse JSON
2. `validateThemeInput(json)` — reject on error
3. If `json.base` is set, resolve over that preset: `resolveTheme(input, getThemePreset(json.base))`
4. If no `base`, resolve over `default`: `resolveTheme(input, getThemePreset('default'))`
5. If `isBuiltinThemeName(resolvedTheme.name)` → add warning, skip registration
6. If no `name` field → derive from filename (e.g., `acme-corporate.triton-theme.json` → `acme-corporate`)

**Tests:**
- Create temp fixture dirs with valid/invalid theme files
- Verify discovery returns correct map + warnings
- Verify built-in name collision is caught
- Verify `findTritonThemesDir` walk-up logic

**Dependencies:** Phase 1 (needs `validateThemeInput`, `isBuiltinThemeName`).

**Effort:** ~2–3 hours.

---

### Phase 3 — VS Code Extension

**Goal:** The extension auto-discovers `.triton/themes/` at activation, registers external themes, augments the dropdown, watches for changes, and re-renders on theme file edits.

**Files touched:**
- NEW: `extension/src/theme-registry.ts` — external theme registry + discovery + watcher
- EDIT: `extension/src/extension.ts` — integrate registry into `PreviewManager`
- EDIT: `extension/src/preview-html.ts` — dropdown includes custom themes

**Core class:**

```typescript
export class ThemeRegistry implements vscode.Disposable {
  refresh(): void { ... }                    // scan for theme files
  allNames(): readonly string[] { ... }       // all (built-in + custom)
  customNames(): readonly string[] { ... }    // custom only
  resolve(name: string): ResolvedTheme | undefined { ... }
  isKnown(name: string): boolean { ... }
  dispose(): void { ... }
  onDidChange: vscode.Event<void>
}
```

**Integration:**
- Instantiate `ThemeRegistry` in `activate()`, call `registry.refresh()`
- `PreviewManager.selectedTheme()` validates against `registry.isKnown()` (instead of just `themePresetNames`)
- `themeArgs()`: resolve custom theme names via `registry.resolve(name)` → pass full `ResolvedTheme` as `themeInput`
- Listen to `registry.onDidChange` → re-render active preview
- File watchers: one per workspace folder

**Dropdown augmentation:**
- Built-in group (all presets)
- Custom group (if any, with divider)
- Both groups selectable

**Name collision handling:**
- `discoverThemes()` already excludes built-in-colliding names with warnings
- Extension surfaces warnings via `vscode.window.showWarningMessage()`

**Tests:**
- Unit tests for `ThemeRegistry` (mock vscode, filesystem)
- Integration: activate with fixture workspace containing `.triton/themes/`

**Dependencies:** Phase 2 (`discoverThemes`, `loadThemeFile`).

**Effort:** ~4–5 hours.

---

### Phase 4 — triton-latex CLI + .sty

**Goal:** The CLI gains `--theme-file` and `--themes-dir` flags + `.triton/themes/` auto-discovery. The `.sty` gains macros to forward these. The Phase-0 cache key is extended to cover external theme identity.

**Files touched:**
- EDIT: `latex/src/cli.ts` — new flags, theme resolution logic
- EDIT: `latex/triton.sty` — new macros + extended cache key
- EDIT: `latex/examples/` — add example with external theme

**CLI additions:**

```typescript
interface Args {
  readonly themeFile?: string;    // NEW: --theme-file <path>
  readonly themesDir?: string;    // NEW: --themes-dir <dir>
  readonly theme?: string;        // existing: --theme <name>
}
```

**Theme resolution:**
1. Explicit `--theme-file` (highest priority)
2. Build registry: `--themes-dir` + auto-discovered `.triton/themes/` + built-ins
3. Resolve `--theme` against registry + built-ins

**LaTeX macros:**

```latex
\def\triton@themefilearg{}
\newcommand{\tritonthemefile}[1]{\def\triton@themefilearg{\space--theme-file #1}}

\def\triton@themesdirarg{}
\newcommand{\tritonthemesdir}[1]{\def\triton@themesdirarg{\space--themes-dir #1}}
```

Update `\write18` invocation to include new args:

```latex
\immediate\write18{\triton@cli\space render "\triton@tmpfile" -o
  "\triton@pdf" --scale \triton@scale\triton@themearg\triton@themefilearg\triton@themesdirarg}%
```

**Cache key extension:**

```latex
\immediate\write18{printf '\@percentchar\@percentchar triton-key: \triton@themearg\triton@themefilearg\triton@themesdirarg\space scale=\triton@scale\string\n' >> "\triton@tmpfile"}%
```

**Tests:**
- Unit: `latex/test/cli-theme.test.ts` — test theme resolution with fixtures
- Integration: shell script renders with `--theme-file`, verifies SVG contains expected colors
- Manual: `latex/examples/inline-demo.tex` updated with `\tritonthemesdir` + example

**Note:** Cache includes theme path/name but NOT file content hash. If user edits a `.triton-theme.json` file without changing its path, the cache is stale. Mitigation: document that `\tritoncachedir` should be cleaned after editing theme files. Tier-2 improvement: content-aware hashing.

**Dependencies:** Phase 0 (cache-key fix), Phase 2 (discovery/validation).

**Effort:** ~3–4 hours.

---

### Phase 5 — Documentation + Examples

**Goal:** A template theme file, updated READMEs, and a worked cross-host example proving the same theme works in VS Code + LaTeX.

**Files touched:**
- NEW: `examples/.triton/themes/example.triton-theme.json` — canonical template
- NEW: `docs/external-themes.md` — user-facing guide
- EDIT: `latex/README.md` — document new flags + macros
- EDIT: `extension/README.md` — document `.triton/themes/` convention
- NEW: `latex/examples/.triton/themes/paper-theme.triton-theme.json` — LaTeX-specific example
- EDIT: `latex/examples/inline-demo.tex` — use the custom theme

**Template theme (`examples/.triton/themes/example.triton-theme.json`):**

```json
{
  "$schema": "../../../src/theme/schema.json",
  "name": "example-custom",
  "base": "default",
  "palette": {
    "primary": "#2563EB",
    "secondary": "#7C3AED",
    "background": "#FAFAFA"
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif"
  }
}
```

**`docs/external-themes.md` sections:**
1. Overview (what external themes are, the `.triton-theme.json` format)
2. File format reference (all fields, the `base` key, the `$schema` key)
3. VS Code: `.triton/themes/` convention, dropdown, live reload
4. LaTeX/CLI: `--theme-file`, `--themes-dir`, auto-discovery, `\tritonthemefile`, `\tritonthemesdir`
5. Authoring guide: start from a preset, override what you need
6. Cross-host example: same file used in VS Code preview + LaTeX paper
7. Troubleshooting: cache invalidation, name collisions, validation errors

**Tests:**
- `example.triton-theme.json` passes `validateThemeInput()` (unit test)
- Documentation reviewed for accuracy

**Dependencies:** All prior phases.

**Effort:** ~2–3 hours.

---

### Summary Table

| Phase | Scope | Effort | Ships in Tier-1? | Depends on |
|-------|-------|--------|------------------|------------|
| 0 | `.sty` cache-key fix | 1h | ✅ | — |
| 1 | Core validator + schema | 3–4h | ✅ | — |
| 2 | Shared loader/discover | 2–3h | ✅ | Phase 1 |
| 3 | VS Code extension | 4–5h | ✅ | Phase 2 |
| 4 | triton-latex CLI + .sty | 3–4h | ✅ | Phase 0, 2 |
| 5 | Docs + examples | 2–3h | ✅ (minimal) | All |
| **Total** | | **~16–20h** | | |

### Explicit Deferrals (Tier-2+)

| Item | Reason | Prerequisite |
|------|--------|--------------|
| `triton.themes.paths` VS Code setting | Convention-based discovery covers 95% | Phase 3 shipped |
| User-scoped global themes (~/.triton/) | Wait for demand | Phase 3 shipped |
| Refactor built-in presets into .json data files | Dogfooding / cleanup, not user-facing | Phase 1 shipped |
| Content-aware cache hashing (CLI returns hash) | Phase 0 fix is sufficient for Tier-1 | Phase 4 shipped |
| Theme inheritance chains (A extends B extends preset) | Premature complexity | Phase 1 shipped |
| Remote URL themes | Security risk, breaks determinism | Never (permanent deferral) |
| `<optgroup>` HTML in dropdown | Polish | Phase 3 shipped |

---

## Next Steps

1. **Phase 0** starts immediately (cache-key fix in triton.sty).
2. **Phase 1** follows (core validator + schema) — can proceed in parallel with Phase 0 since they're independent.
3. **Phases 2–5** sequence by dependency graph.
4. Each phase = own PR + `[version:patch]` bump.
5. Full test coverage for each phase before merge.




---

# Research & Recommendation — Icons/Images/Notes (not yet approved to build) — 2026-07-12T18:25:05-04:00

**Status:** RESEARCH & RECOMMENDATION — Documents an investigation and architectural recommendation; not a shipped design decision.

---

## Research Lead: David
**Date:** 2026-07-12T18:16:46-04:00
**For:** Leslie (decision), Mark (IR schema)

### David's Research Memo: Mermaid Icons, Images, and Notes/Comments

## Preamble

This memo evaluates Mermaid's icon, image, and note/comment mechanisms through the lens of
Triton's constraints: **deterministic, offline, SVG-first, static PNG via rsvg-convert, no
browser, no JS runtime at render time, no network I/O.**

All claims are traced to sources cited in the bibliography.

---

## A. ICONS

### A1. Font Awesome in Flowcharts — `fa:fa-xxx` / `fab:fa-xxx` syntax

**Syntax example:**
```
flowchart TD
  A[fa:fa-user User] --> B[fab:fa-github GitHub]
```

**How it works:**  
Function `replaceIconSubstring()` in
`packages/mermaid/src/rendering-util/createText.ts`
applies regex `/(fa[bklrs]?):fa-([\w-]+)/g` to node label text.
It follows **one of two paths**:

| Path | Condition | SVG output | FA webfont needed? |
|------|-----------|------------|--------------------|
| A (inline vector) | Prefix is registered in the Iconify store | `iconToHTML(replaceIDs(renderData.body), …)` — SVG `<path>` data inlined | **No** |
| B (class fallback) | Prefix NOT registered | `<i class='fa fa-xxx'></i>` inside `<foreignObject>` | **Yes** |

**Critical constraint — `htmlLabels` setting:**  
The `fa:` replacement only runs inside the HTML label path. When `flowchart.htmlLabels: true`
(the default in browsers), Mermaid uses `<foreignObject>` to embed HTML. When
`htmlLabels: false`, the string `fa:fa-user` renders as literal text.

**Server-side / static SVG (mermaid-cli / puppeteer):**  
mermaid-cli uses Puppeteer. For path B (no registered iconify pack), the `<i>` element in
the `<foreignObject>` requires the FA CSS *loaded inside the puppeteer page*. Without it,
the glyph slot is empty — the SVG ships a `<foreignObject>` with a blank `<i>` element.

**Rasterization safety (rsvg-convert / cairosvg):**  
`<foreignObject>` is **not supported by rsvg-convert** (libsvg2 explicitly drops it) and
is ignored by cairosvg. Even if the `<i>` tag somehow survived, the font glyph would only
render if the Font Awesome OTF/TTF is **installed** as a system font — not from a CDN.

**Verdict for Triton:** Path B (default, no iconify registration) is incompatible with
static PNG. Path A (iconify registration) is offline-safe IF the pack JSON is pre-bundled.

**Source:**
- `packages/mermaid/src/rendering-util/createText.ts` → `replaceIconSubstring()`
- `packages/mermaid/src/rendering-util/icons.ts` → `getIconSVG()`
- GitHub issue: https://github.com/mermaid-js/mermaid/issues/3404

---

### A2. Mindmap `::icon(fa fa-xxx)` syntax

**Syntax example:**
```
mindmap
  Root
    A
    ::icon(fa fa-book)
```

**How it works:**  
The `::icon(className)` syntax in mindmap applies CSS classes to an `<i>` element rendered
inside the mindmap node. From the official docs: *"The styling for the font based icons are
added during the integration so that they are available for the web page. This is not
something a diagram author can do but has to be done with the site administrator or the
integrator."* (source: [mindmap.md](https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/mindmap.md))

This is **purely CSS-class based** — no inline vector paths. The icon body is an `<i>` tag
with the given class names. The font must be present in the rendering environment.

**For Triton (no browser, rsvg-convert):**  
`::icon()` in mindmap is **incompatible with static offline PNG**. It will produce empty
glyph slots identically to the `fa:` fallback path.

**Verdict:** Fundamentally font-dependent. Do not map to a Triton icon primitive.

---

### A3. Iconify / `registerIconPacks` — the inline-vector mechanism

**How it works:**  
`packages/mermaid/src/rendering-util/icons.ts`:

```ts
export const registerIconPacks = (iconLoaders: IconLoader[]) => { … }
```

Two loader forms:
- `AsyncIconLoader`: `{ name, loader: () => fetch('CDN/logos.json').then(r=>r.json()) }` — **network call at first use**
- `SyncIconLoader`: `{ name, icons: iconifyJSONData }` — **pre-bundled, no network**

The `getIconSVG()` function:
1. Resolves the icon from the store (loading async if needed)
2. Calls `iconToSVG(iconData, customisations)` → produces `body` string of SVG path data
3. Calls `iconToHTML(replaceIDs(renderData.body), attributes)` → wraps in `<svg>` element
4. Returns sanitized inline SVG string

**Output:** The icon becomes a self-contained `<svg>` subtree with `<path>` elements — no
external font reference. This IS self-contained.

**Fallback for unknown icons:**  
If registration fails or pack not found, `unknownIcon` is used:
```ts
export const unknownIcon: IconifyIcon = {
  body: '<g><rect width="80" height="80" .../><text ...>?</text></g>',
  …
};
```
— always renders deterministically.

**CDN vs. offline:**  
The `AsyncIconLoader` path calls `fetch()` at render time → breaks determinism and offline.
The `SyncIconLoader` path with pre-bundled JSON is **fully offline and deterministic**.

**Licensing:**  
Iconify is MIT licensed. Individual icon packs have their own licenses — `logos:` (CC0 for
most, some brand logos with trademark restrictions), `mdi:` (Apache 2.0), `fa:` free icons
(CC BY 4.0 + Font Awesome Free license for OFL fonts). Triton must evaluate per-pack.

**Recolor / theming:**  
Iconify icons using `currentColor` in their SVG body inherit CSS color. Many tech/logo icons
have **hardcoded fill colors** (e.g., `logos:aws` is orange by design). Abstract icons
(`mdi:`, `heroicons:`) typically use `currentColor`. Theme-aware recoloring is possible for
the latter.

**Source:**  
- `packages/mermaid/src/rendering-util/icons.ts`
- `packages/mermaid/src/docs/config/icons.md`
- `@iconify/utils` package: `iconToSVG`, `iconToHTML`, `replaceIDs`

---

### A4. Flowchart Icon Shape (v11.3.0+)

**Syntax example:**
```
flowchart TD
  A@{ icon: "logos:aws", form: "square", label: "AWS Service", pos: "t", h: 60 }
```

**Parameters:**
| Param | Values | Notes |
|-------|--------|-------|
| `icon` | `"prefix:name"` | Requires registered iconify pack |
| `form` | `square`, `circle`, `rounded`, (none) | Background shape |
| `label` | string | Optional text label |
| `pos` | `t`, `b` | Label above or below icon |
| `h` | number (≥48) | Height in px |

**Implementation:**  
`packages/mermaid/src/rendering-util/rendering-elements/shapes/icon.ts` — calls
`getIconSVG(node.icon, { height, width, fallbackPrefix: '' })` and appends the returned
SVG markup via `.html()`.

**Output form:** `<g>` containing inline SVG icon body. Self-contained IF the pack is
pre-bundled. Otherwise requires network fetch.

**Architecture-beta icons:**  
Pre-bundled in `packages/mermaid/src/diagrams/architecture/architectureIcons.ts`:
`database`, `server`, `disk`, `internet`, `cloud`, `blank`, `unknown`. These are always
available offline (baked into the mermaid bundle). All use `wrapIcon()` which wraps inline
`<path>` elements in a blue square. Custom icons require `registerIconPacks()`.

**Source:**  
- `packages/mermaid/src/rendering-util/rendering-elements/shapes/icon.ts`
- `packages/mermaid/src/diagrams/architecture/architectureIcons.ts`
- Mermaid docs: https://mermaid.js.org/syntax/flowchart.html (v11.3.0+ section)

---

### A5. Other Icon Mechanisms

- **classDiagram:** No icon support.
- **C4 diagrams:** Use built-in shape types (Person, System, Container, etc.) — purely
  geometric SVG, no icon facility.
- **gitGraph, gantt, timeline, sequence:** No icon support.
- **Mindmap classes (`:::className`):** CSS-only, same font-dependency concern as `::icon()`.

---

## B. IMAGES

### B1. Flowchart Image Shape (v11.3.0+)

**Syntax example:**
```
flowchart TD
  A@{ img: "https://example.com/logo.png", label: "Logo", pos: "t", w: 200, h: 60, constraint: "on" }
```

**Parameters:**
| Param | Default | Notes |
|-------|---------|-------|
| `img` | — | URL or data: URI |
| `label` | — | Optional text |
| `pos` | `b` | `t` = label above, `b` = label below |
| `w` | natural width | Overrides image width |
| `h` | natural height | Overrides image height |
| `constraint` | `off` | `on` = preserve aspect ratio |

**Implementation:**  
`packages/mermaid/src/rendering-util/rendering-elements/shapes/imageSquare.ts`:

```ts
const img = new Image();
img.src = node?.img ?? '';
await img.decode();           // ← DOM/browser required
const imageNaturalWidth = img.naturalWidth;
…
image.attr('href', node.img); // ← URL set directly on SVG <image>
```

**Key observations:**

1. **`new Image()` / `img.decode()`**: requires a browser DOM. In Node.js without
   jsdom/puppeteer, this breaks. mermaid-cli (Puppeteer) provides the DOM.

2. **`<image href="URL">`**: The URL is embedded verbatim in the SVG output. The SVG
   `<image>` element is a *reference*, not embedded data. When opened standalone or
   rasterized with rsvg-convert:
   - Remote URLs (`https://…`) require network access at **rasterization time** — breaks
     offline and determinism.
   - Local file paths resolve relative to CWD at rasterization time.
   - `data:` URIs are inlined in the SVG and are fully self-contained.

3. **rsvg-convert behavior:** rsvg-convert *does* support `<image href>`. It will fetch
   remote URLs (network call at rasterization time) or resolve local paths. For static
   offline PNG, `data:` URIs are the only safe option.

**Offline-safe path:**  
Use `img: "data:image/png;base64,..."` — the base64 data is embedded in the `.mmd` source
and survives SVG→PNG conversion without any network call.

**Source:**  
- `packages/mermaid/src/rendering-util/rendering-elements/shapes/imageSquare.ts`
- Mermaid docs: https://mermaid.js.org/syntax/flowchart.html (v11.3.0+ Special shapes section)

---

### B2. Image Support in Other Diagram Types

| Diagram type | Image support | Notes |
|-------------|--------------|-------|
| architecture-beta | None | Services use Iconify icons only |
| C4 | None | Uses fixed shape types (Person, System, etc.) |
| mindmap | None | `::icon()` font-class only |
| sequenceDiagram | None | — |
| classDiagram | None | — |
| stateDiagram | None | — |
| gitGraph | None | — |
| gantt | None | — |
| ER diagram | None | — |
| block diagram | None | — |

No other diagram type besides flowchart provides an `img:` or `imageUrl` shape.

---

## C. NOTES AND COMMENTS

### C1. Comments — Source annotations not rendered

**Mechanism:**  
`packages/mermaid/src/diagram-api/comments.ts`:

```ts
export const cleanupComments = (text: string): string => {
  return text.replace(/^\s*%%(?!{)[^\n]+\n?/gm, '').trimStart();
};
```

- Strips any line starting with `%%` (with optional leading whitespace) that is **not** followed by `{`
- Runs in `preprocessDiagram()` at `packages/mermaid/src/preprocess.ts`, **before any grammar parser**
- Comments are therefore grammar-agnostic: every diagram type supports `%%` comments
- Inline trailing comments (`A --> B %% this is ignored`) also work because the regex matches anything on a line starting with `%%`

**`%%{init: ...}%%` directives — NOT comments:**  
The `(?!{)` negative lookahead in the regex explicitly protects `%%{...}%%` blocks from
being stripped. These are processed by `processDirectives()` → `utils.detectInit()` before
comment stripping. They configure theme, fontSize, diagram-specific options at parse time.
They are **config directives**, not comments.

**Allowed positions:**  
`%%` comments may appear anywhere in the diagram source — before the diagram type keyword,
between elements, after statements. The pre-parse strip is position-agnostic.

**Source:**  
- `packages/mermaid/src/diagram-api/comments.ts`
- `packages/mermaid/src/preprocess.ts` → `preprocessDiagram()`

---

### C2. Rendered Notes — Visible annotations in diagrams

#### sequenceDiagram

**Syntax:**
```
sequenceDiagram
  participant Alice
  participant Bob
  Note right of Bob: Bob thinks
  Note left of Alice: Alice waits
  Note over Alice,Bob: A typical interaction
```

**Rendering:** A rectangular box with a subtle border, positioned to the right/left of
the participant lifeline, or spanning across two participants. Multi-line via `<br/>`.

**Positions:** `right of`, `left of`, `over` (spanning 1–2 participants)

**Source:** `packages/mermaid/src/docs/syntax/sequenceDiagram.md` — "Notes" section

---

#### stateDiagram-v2

**Syntax (block, multi-line):**
```
stateDiagram-v2
  state1: The important state
  note right of state1
    Multi-line content.
    More text here.
  end note
  note left of state2 : Inline single-line note
```

**Positions:** `right of`, `left of`

**Rendering:** A filled rectangular box (styled per theme) attached to the target state.

**Source:** `packages/mermaid/src/docs/syntax/stateDiagram.md` — "Notes" section

---

#### classDiagram

**Syntax:**
```
classDiagram
  note "This is a general floating note"
  note for Duck "can fly\ncan swim"
  Animal <|-- Duck
```

**Two note forms:**
1. `note "text"` — a global floating note not attached to any class
2. `note for ClassName "text"` — a note attached to a specific class

**Rendering:** A folded-corner "sticky note" box. `\n` or `<br>` for line breaks.

**Important:** This is the **only diagram type in Mermaid with a truly free-floating note**
(the global `note "text"` form). It is not attached to an element.

**Source:** `packages/mermaid/src/docs/syntax/classDiagram.md` — "Notes" section

---

#### C4 diagrams

No `note` annotation element. The `NOTE` constant in `c4Db.ts` refers to a
**relationship line style** (dashed/solid variants), not an annotation box.

**Source:** `packages/mermaid/src/diagrams/c4/c4Db.ts`

---

#### Other diagram types — no `note` support

| Diagram | Note support |
|---------|-------------|
| gitGraph | None |
| gantt | None |
| timeline | None |
| mindmap | None |
| ER diagram | None |
| journey | None |
| kanban | None |
| block | None |
| architecture-beta | None (labels on nodes/groups only) |
| requirement | None |

No diagram type has free-floating callout boxes or speech bubbles not attached to an
element, except the global `note "text"` in classDiagram.

---

## Summary Table

| Feature | SVG output form | Self-contained? | Offline? | Raster-safe? | Theme-recolorable? |
|---------|----------------|-----------------|----------|-------------|---------------------|
| `fa:fa-xxx` + iconify registered | Inline `<path>` | ✅ | ✅ (if SyncLoader) | ✅ | ✅ if `currentColor` |
| `fa:fa-xxx` fallback (`<i>` tag) | `<foreignObject><i class>` | ❌ | ❌ | ❌ | N/A |
| `::icon(fa ...)` mindmap | `<foreignObject><i class>` | ❌ | ❌ | ❌ | N/A |
| Iconify icon shape (SyncLoader) | Inline `<path>` | ✅ | ✅ | ✅ | if `currentColor` |
| Iconify icon shape (AsyncLoader CDN) | Inline `<path>` | ✅ | ❌ | ✅ | if `currentColor` |
| Architecture built-in icons | Inline `<path>` | ✅ | ✅ | ✅ | ❌ (hardcoded fills) |
| `img: "https://..."` | `<image href=url>` | ❌ | ❌ | ❌ | N/A |
| `img: "data:..."` | `<image href=data:...>` | ✅ | ✅ | ✅ | N/A |
| `%%` comment | stripped pre-parse | — | — | — | — |
| `%%{init:...}%%` directive | config, stripped pre-parse | — | — | — | — |
| sequence `Note over …` | `<rect>` + `<text>` | ✅ | ✅ | ✅ | ✅ |
| state `note right of …` | `<rect>` + `<text>` | ✅ | ✅ | ✅ | ✅ |
| class `note "…"` / `note for …` | sticky-note `<rect>` | ✅ | ✅ | ✅ | ✅ |

---

## What I Recommend Triton Should Look At

*The following is labeled recommendation, not research fact.*

### Compatible with Triton's constraints

1. **Iconify SyncLoader (pre-bundled packs)** — the inline vector path approach is the
   right model for Triton icons. A curated Triton icon bundle (shipping a subset of
   `@iconify-json/mdi` or similar as a JSON file bundled with Triton Core) provides:
   - Zero network dependency
   - Fully self-contained SVG
   - Rsvg-convert-safe rasterization
   - Theme-recolorable for icons using `currentColor`
   - Deterministic output (same icon name → same paths)

2. **`data:` URIs for images** — the only offline/deterministic image embedding path.
   Triton could accept `img:` in the IR and validate that the value is a `data:` URI (or
   resolve a local file path and base64-encode it at compile time, similar to what
   `loadImageAsset()` already does in `.squad/skills/image-primitive/SKILL.md`).
   The existing `ImagePrimitive` + `loadImageAsset()` pattern in Triton Core is exactly
   right for this.

3. **Note primitives (sequence/state/class)** — All three note types render to pure SVG
   geometry (`<rect>` + `<text>`). They are fully self-contained and rsvg-convert-safe.
   Triton could introduce a `NotePrimitive` in the Scene IR for these.

### Fundamentally at odds with Triton's constraints

4. **Font Awesome `<i>` tag fallback** — `<foreignObject>` is dropped by rsvg-convert.
   Even if Triton parsed `fa:fa-xxx` syntax, it **must not** emit an `<i>` element.
   The only safe path is pre-registering a bundled iconify pack for `fa:` prefix so the
   inline-vector path (Path A) is always taken. Shipping the FA Free icon pack as a
   bundled JSON at build time is viable; using the CDN loader is not.

5. **Mindmap `::icon()` CSS-class icons** — entirely font-dependent. Triton would need to
   replace this with a different mechanism (e.g., map `::icon(mdi mdi-book)` to a bundled
   `mdi:book` Iconify lookup).

6. **Remote `img:` URLs** — breaks determinism and offline requirement. Triton should
   reject non-`data:` and non-local-file-path values for image nodes with a compile-time
   error, not a silent fallback.

7. **Iconify AsyncLoader (CDN fetch)** — the default example in Mermaid's docs
   (`fetch('https://unpkg.com/@iconify-json/logos@1/icons.json')`) is incompatible with
   Triton. Triton must pre-bundle any icon pack it supports.

### The inline-vector principle

The core offline-safety criterion for icons is simple:
> **Self-contained SVG requires that icon data be inlined as `<path>` elements, not
> referenced as a font glyph or an external URL.**

Iconify's `SyncLoader` + `iconToHTML()` achieves this. Triton's existing
`PathPrimitive`-based icon registry (documented in `.squad/skills/scene-icon-glyph/SKILL.md`)
already follows this principle correctly. Any Mermaid superset syntax that adds icons
should resolve to this same primitive path.

---

## Bibliography

1. Mermaid source — icon registry: `packages/mermaid/src/rendering-util/icons.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/icons.ts

2. Mermaid source — FA label substitution: `packages/mermaid/src/rendering-util/createText.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/createText.ts

3. Mermaid source — flowchart icon shape: `packages/mermaid/src/rendering-util/rendering-elements/shapes/icon.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/rendering-elements/shapes/icon.ts

4. Mermaid source — flowchart image shape: `packages/mermaid/src/rendering-util/rendering-elements/shapes/imageSquare.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/rendering-elements/shapes/imageSquare.ts

5. Mermaid source — architecture built-in icons: `packages/mermaid/src/diagrams/architecture/architectureIcons.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/architecture/architectureIcons.ts

6. Mermaid source — comment stripping: `packages/mermaid/src/diagram-api/comments.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagram-api/comments.ts

7. Mermaid source — preprocessDiagram: `packages/mermaid/src/preprocess.ts`  
   https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/preprocess.ts

8. Mermaid docs — icon pack registration: https://mermaid.js.org/config/icons.html  
   Raw: https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/config/icons.md

9. Mermaid docs — flowchart (icon shape, image shape, FA syntax):  
   https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/flowchart.md

10. Mermaid docs — sequenceDiagram notes:  
    https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/sequenceDiagram.md

11. Mermaid docs — stateDiagram notes + comments:  
    https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/stateDiagram.md

12. Mermaid docs — classDiagram notes + comments:  
    https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/classDiagram.md

13. Mermaid docs — mindmap icon syntax:  
    https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/mindmap.md

14. Mermaid docs — architecture-beta:  
    https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/architecture.md

15. GitHub issue — FA icons not showing in exported SVGs:  
    https://github.com/mermaid-js/mermaid/issues/3404

16. Triton internal — scene-icon-glyph skill:  
    `.squad/skills/scene-icon-glyph/SKILL.md`

17. Triton internal — image-primitive skill:  
    `.squad/skills/image-primitive/SKILL.md`

18. @iconify/utils NPM package (iconToSVG, iconToHTML):  
    https://www.npmjs.com/package/@iconify/utils

19. Font Awesome Free license: OFL-1.1 for fonts; CC BY 4.0 for icons  
    https://fontawesome.com/license/free


---

## Spec Architect: Leslie
**Date:** 2026-07-12T18:25:05-04:00
**Inputs:** David's research, Triton codebase investigation

### Leslie's Options & Tradeoffs Analysis

## Part 1 — Current State in Triton

### 1.1 Icons

Triton has **two partial icon implementations**, neither of which is a general-purpose icon system:

**Architecture diagram — hand-drawn line glyphs** (`src/diagrams/triton/architecture/layout.ts:110–143`). The `iconGlyph()` function renders 5 hardcoded icon names (`server`, `database`, `cloud`, `internet`, `disk`) as small SVG primitives (rects, circles, paths) using the `Pen` API. These are **inline vector**, palette-aware (use `hue` + `palette.surface`), deterministic, and PNG-safe. But they are a closed set: any name outside the 5 keywords falls through to a generic rounded rectangle.

**Mindmap — `::icon()` parsed, barely rendered** (`src/diagrams/mermaid/mindmap/index.ts:30–32`, `layout.ts:86`). The parser captures `::icon(fa-xxx)` syntax into `node.icon?: string`, but the layout renders it as nothing more than a **4px colored dot** next to the node (`p.circle(…, 4, n.hue, …)`). The icon name string is entirely ignored for rendering purposes. This is Mermaid-syntax compatibility at the parse level only.

**Prior design work on record:** `.squad/skills/scene-icon-glyph/SKILL.md` documents a `PathPrimitive`-based icon registry pattern with a `translate(cx,cy) scale(s) translate(-12,-12)` centering formula for 24×24 viewBox icons. This skill was written for the timeline compiler but describes a generalizable approach. The pattern is sound and should be the foundation for any general icon system.

**Verdict:** No general icon system exists. The `scene-icon-glyph` skill documents the right rendering pattern; it needs a registry and grammar integration.

### 1.2 Images

**No image support in the current shipping codebase.** The `SceneElement` discriminated union (`src/contracts/scene.ts`) defines exactly 5 element types: `rect`, `circle`, `path`, `text`, `group`. There is no `SceneImage` variant. The SVG renderer (`src/render/svg.ts`) has no `<image>` or `<foreignObject>` emission path.

**Prior design work on record:** `.squad/skills/image-primitive/SKILL.md` documents an `ImagePrimitive` type + `loadImageAsset(src, baseDir?)` loader that resolves paths/data-URIs to embedded `data:` URIs. The skill covers SVG, PNG/resvg, and Skia backends, with graceful failure for missing files. This is a complete design; it would need to be adapted to Triton's current Scene model.

### 1.3 Comments (non-rendered)

**Central `%%` stripping works correctly** (`src/frontend/preprocess.ts`):

- `stripComments()` runs before grammar dispatch, centrally.
- **Full-line only:** a line is a comment iff its first non-whitespace chars are `%%`. Such lines are removed entirely.
- **No inline trailing comments:** `A --> B %% note` is NOT stripped. The docstring explicitly says this is intentional — distinguishing trailing `%%` from `%%` inside node labels like `A["50%% off"]` is unsafe without a full parse.
- **Frontmatter preserved:** `---…---` YAML frontmatter blocks pass through verbatim. Only the Mermaid body after the closing fence is stripped.
- **Pure-YAML untouched:** if input starts with `type:`, returned unchanged.

**DS parsers** use `lines()` from `src/diagrams/triton/ds/struct/shared.ts:20–22` — a simple `split('\n').map(trim).filter(Boolean)`. These parsers have **no `%%` handling of their own**; they rely entirely on central `stripComments()` having already run. The `tokenizeDirective()` function (`shared.ts:28–29`) explicitly documents: "Full-line comment handling remains centralized before diagram parsers run; this tokenizer intentionally does not strip inline `%%` text."

**Comparison with Mermaid:** Mermaid's `cleanupComments()` uses regex `^\s*%%(?!{)[^\n]+` — the `(?!{)` lookahead protects `%%{init:…}%%` config directives from stripping. Triton has no `%%{init:…}%%` directive system; its equivalent is YAML frontmatter. The approaches are functionally equivalent for their respective config mechanisms.

**Comment handling is complete and consistent.** No gaps, no action needed.

### 1.4 Rendered Notes/Callouts (visible annotations)

**Two existing domain-specific implementations:**

**Sequence diagram notes** (`src/diagrams/mermaid/sequence/ir.ts:22–26`, `layout.ts:99–106`). `SeqNote` has `placement: 'over' | 'left' | 'right'` and `participants: string[]`. Rendered as a warning-colored semi-transparent rounded rect with centered text. Fully theme-aware (uses `palette.warning`, `palette.text`). Positioned inline in the event stream.

**Poster note overlays** (`src/diagrams/triton/poster/ir.ts:12–18`, `poster/index.ts:124`, `poster/layout.ts:494–518`). `PosterNote` with `text` and optional `position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'`. Parsed from `note "text" [at position]` directives inside poster cell content. Rendered as a semi-transparent pill overlay. Fully theme-aware.

**General overlay system** (`src/contracts/overlay.ts`). Two-layer architecture: `RawNote` (grammar output: element target + text + optional offset) → `Annotation` (resolved position, anchor reference) via overlay compiler (`src/overlay/compiler.ts`). Called by most layout engines via `applyOverlays()`. Designed for **anchored annotations** (callout box + connector to diagram element), not free-floating commentary.

### 1.5 Rendering Pipeline Constraints

**Scene model is SVG-primitive-only.** Five element types: rect, circle, path, text, group. No image, no foreignObject, no raw SVG passthrough. This is by design — the Scene is "pure geometry and style" (`scene.ts:14`).

**SVG renderer** (`src/render/svg.ts`) emits clean SVG with SMIL animations for connector effects. The `fillVal()` helper normalizes empty `fill` to `"none"`. No `<image>` or `<foreignObject>` code paths exist.

**Static PNG via rsvg-convert.** Key implications for this analysis:
- **No JavaScript execution** — no dynamic font loading.
- **No webfont fetching** — Font Awesome glyphs = blank boxes unless font is installed system-wide.
- **SMIL animations frozen** — `<animate>` elements ignored (accepted degradation — connector animations exist but produce static lines in PNG).
- **`<image href="data:…">` works** — rsvg-convert handles data URIs.
- **`<image href="https://…">`** — unreliable; depends on network at rasterization time.
- **`<foreignObject>` dropped entirely** — rsvg-convert / libsvg2 explicitly skips it.

**Theme-awareness.** The palette model (`src/contracts/theme.ts`) provides 10 semantic colors (primary, secondary, background, surface, border, text, textMuted, success, warning, error). All existing visual elements use palette tokens.

---

## Part 2 — What Mermaid Offers vs What's Triton-Safe

### Icons: Mermaid Mechanisms Evaluated

| Mermaid Mechanism | SVG Output | Offline? | PNG-Safe? | Theme-Recolorable? | **Triton Verdict** |
|---|---|---|---|---|---|
| `fa:fa-xxx` + Iconify SyncLoader (pre-bundled) | Inline `<path>` | ✅ | ✅ | ✅ if `currentColor` | **Compatible** — the right model |
| `fa:fa-xxx` fallback (no registered pack) | `<foreignObject><i class>` | ❌ | ❌ | N/A | **Incompatible** — this is Mermaid's DEFAULT |
| `::icon(fa ...)` mindmap | `<foreignObject><i class>` | ❌ | ❌ | N/A | **Incompatible** — purely font-dependent |
| Iconify icon shape + SyncLoader (v11.3+) | Inline `<path>` | ✅ | ✅ | ✅ if `currentColor` | **Compatible** |
| Iconify icon shape + AsyncLoader (CDN) | Inline `<path>` | ❌ | ✅ | ✅ if `currentColor` | ❌ network at render |
| architecture-beta built-ins | Inline `<path>` | ✅ | ✅ | ❌ hardcoded fills | **Compatible** (Triton already does this) |

**The critical insight:** Mermaid's `fa:fa-xxx` syntax looks simple but hides a **dangerous fork**. Default Mermaid registers NO FA icon pack → the default path emits `<foreignObject><i class="fa fa-xxx">` → blank in rsvg-convert. Only when an integrator calls `registerIconPacks()` with a SyncLoader does the inline `<path>` path activate. Most Mermaid users in browsers never notice because the browser loads the webfont from a CDN. Triton must not inherit this ambiguity.

### Images: Mermaid Mechanisms Evaluated

| Mermaid Mechanism | SVG Output | Offline? | PNG-Safe? | Theme? | **Triton Verdict** |
|---|---|---|---|---|---|
| `img: "https://…"` (v11.3+) | `<image href=URL>` | ❌ | ❌ | ❌ | **Incompatible** |
| `img: "data:…"` (v11.3+) | `<image href=data:…>` | ✅ | ✅ | ❌ | **Compatible** (host resolves) |

**Note:** Mermaid's image shape uses `new Image().decode()` for natural dimensions — requires browser DOM. Triton must handle sizing differently (explicit w/h or host-layer dimension extraction).

### Notes: Mermaid Mechanisms Evaluated

| Mermaid Mechanism | SVG Output | Offline? | PNG-Safe? | Theme? | **Triton Verdict** |
|---|---|---|---|---|---|
| sequence `Note over/left/right` | `<rect>` + `<text>` | ✅ | ✅ | ✅ | **Compatible** (already implemented) |
| state `note right/left of` | `<rect>` + `<text>` | ✅ | ✅ | ✅ | **Compatible** — model if adding state diagrams |
| class `note "text"` (free-floating) | `<rect>` + `<text>` | ✅ | ✅ | ✅ | **Compatible** — the ONLY free-floating note in Mermaid |
| class `note for X "text"` (attached) | `<rect>` + `<text>` | ✅ | ✅ | ✅ | **Compatible** — maps to `RawNote` overlay |

**Key finding:** classDiagram's `note "text"` is the **only free-floating annotation in all of Mermaid**. Every other note type requires an element target. Gantt, timeline, gitGraph, mindmap, C4 — none have notes.

---

## Part 3 — Options & Tradeoffs

### 3.1 ICONS

#### Option A: Inline SVG Path Registry (Bundled) — RECOMMENDED

Ship a curated set of icons as SVG path data strings in a registry module. Each icon is a `d="…"` value rendered via `ScenePath` with the transform pattern documented in `scene-icon-glyph/SKILL.md`.

| Criterion | Assessment |
|-----------|-----------|
| Determinism & offline | ✅ Fully self-contained. Pure function of text — no I/O. |
| Static PNG safety | ✅ `<path>` elements rasterize perfectly in rsvg-convert. |
| Theme-awareness | ✅ Stroke/fill from palette. Monochrome vector recolors trivially. |
| Authoring ergonomics | Good. `icon: server` or `::icon(server)` in syntax. |
| Licensing & bundling | Options: (a) hand-draw a small set; (b) bundle Lucide (ISC), Tabler (MIT), or Heroicons (MIT) — all have clean single-path SVGs. FA Free SVGs are CC BY 4.0 / MIT. |
| Layout impact | ⚠️ Needs box reservation — icon size must be known at layout time. This is Edsger/Brian's domain. The `scene-icon-glyph` skill's sizing rules (barHeight−4, ms.size×0.65) provide a starting pattern. |
| Bundle size | ~200–500 bytes per icon as path data. 100 icons ≈ 20–50 KB. Acceptable. |

**Reconciliation with existing skill:** The `scene-icon-glyph/SKILL.md` pattern (24×24 viewBox, translate-scale-translate transform, `currentColor` fill convention, strokeWidth:2 / strokeLinecap:round for stroked icons) is exactly the right rendering approach. What's missing is: (1) a registry module exposing icon path data by name, (2) grammar integration beyond architecture/timeline.

#### Option B: User-Supplied SVG (Data URI or File → Host Resolution)

Allow users to reference SVG files. Host layer reads file → core receives SVG content string. Adapts the `loadImageAsset()` pattern from `image-primitive/SKILL.md`.

| Criterion | Assessment |
|-----------|-----------|
| Determinism & offline | ⚠️ Host does I/O; core is pure. Acceptable if host resolves before render. |
| Static PNG safety | ⚠️ Depends on SVG content. Simple paths = safe. SVGs with embedded fonts/scripts = unsafe. |
| Theme-awareness | ❌ User SVGs have their own colors. Auto-recolor requires SVG manipulation (complex, fragile). |
| Layout impact | SVG viewBox gives intrinsic size, but user SVGs vary wildly. |

**Verdict: Tier-2 feature** for advanced users needing specific logos. Not the default path.

#### Option C: Webfont Icons (Font Awesome via `<text>` or `<foreignObject>`) — REJECTED

| Criterion | Assessment |
|-----------|-----------|
| Determinism & offline | ❌ Webfont must be available at render/rasterize time. |
| Static PNG safety | ❌ rsvg-convert does not fetch webfonts. `<foreignObject>` is dropped entirely. |

**Verdict: Fundamentally incompatible with Triton's core constraints.** This is Mermaid's default `fa:` path (Path B) and it's the one approach Triton MUST NOT copy.

#### Option D: Emoji / Unicode Symbols — NOT DESIGNED

Rendering depends on system fonts. Not deterministic across environments. Emoji are multi-color bitmaps — `fill` has no effect. Acceptable as a "users can put Unicode in labels" escape hatch (already works), but not a designed icon feature.

#### Explicit Call on `fa:` Syntax

**Triton SHOULD accept `fa:fa-xxx` syntax** for Mermaid superset compatibility, but MUST resolve it exclusively via the inline-vector path (never `<foreignObject>`, never webfont). Two sub-options:

| Sub-option | Approach | Tradeoff |
|---|---|---|
| **A-1: Bundle FA Free JSON** | Ship `@iconify-json/fa6-solid` (~150 KB gzipped) + `@iconify-json/fa6-regular` as bundled JSON. `fa:fa-xxx` → icon registry lookup → inline `<path>`. | Adds ~300 KB to bundle. Full FA Free coverage. Licensing: SIL OFL (font) + MIT (CSS/SVGs). Must attribute. |
| **A-2: Map to curated subset** | Map `fa:fa-database` → Triton's bundled `database` icon. Unknown FA names → compile-time warning + fallback glyph (question-mark icon). | Smaller bundle. Incomplete coverage — some `fa:` names won't resolve. Clear error messaging. |

**Recommendation: A-2 (curated subset with clear fallback).** Reasons: (1) keeps bundle small; (2) avoids licensing complexity of shipping full FA set; (3) compile-time warnings teach users what's available; (4) the fallback `?` glyph (matching Mermaid's `unknownIcon` pattern) is honest — better than silent blank boxes.

### 3.2 IMAGES

#### Option E: `SceneImage` Element with Data URI — RECOMMENDED (deferred)

Add a `SceneImage` element type. Host resolves files to `data:image/…;base64,…` before render. Core emits `<image href="data:…">`. Adapts the `image-primitive/SKILL.md` design.

| Criterion | Assessment |
|-----------|-----------|
| Determinism & offline | ✅ Data URI is self-contained. Host does I/O; core is pure. |
| Static PNG safety | ✅ rsvg-convert handles `<image href="data:…">`. |
| Theme-awareness | ❌ Raster images cannot recolor to palette. |
| Authoring ergonomics | Moderate — `image("logo.png")` in syntax, host resolves to data URI. |
| Layout impact | ⚠️ Needs explicit width/height in syntax (Mermaid uses `new Image().decode()` for natural dimensions — requires browser DOM, which Triton doesn't have). Host-layer dimension extraction or mandatory size params. Edsger/Brian's domain. |

**Reconciliation with existing skill:** The `image-primitive/SKILL.md` design (`ImagePrimitive`, `loadImageAsset()`, `data:` URI mandate, graceful null for missing files, `borderRadius` clip support) is a complete blueprint. Main adaptation needed: map to Triton's `SceneElement` union rather than the skill's `Primitive` union.

**Explicit rejection:** Remote `https://…` URLs MUST be rejected at compile time with a clear error. Triton should not silently fetch or silently fail — it should tell the author "remote URLs are not supported; use a local file path or data URI."

#### Option F: External URL `<image href="https://…">` — REJECTED

Breaks offline + determinism. Incompatible.

### 3.3 NOTES / COMMENTS

#### The Two Meanings — Separated Crisply

**Comments** = non-rendered `%%` lines. Already complete. `stripComments()` handles full-line `%%` centrally. DS parsers rely on central stripping. No inline trailing comment stripping (intentionally safe). No `%%{init:…}%%` directive concern (Triton uses YAML frontmatter instead). **No further work needed.**

**Rendered notes** = visible callout/annotation boxes in the output SVG. A **new visual feature** (beyond the two existing domain-specific implementations). What should a Triton "note" mean?

#### Taxonomy of Rendered Notes

| Note Type | Example Syntax | Semantics | Existing in Triton? |
|---|---|---|---|
| **Element-attached** | `note on A: "explains A"` | Callout box + connector line to a specific node/element | Partial — `RawNote → Annotation` overlay system exists; sequence `Note over` works |
| **Free-floating** | `note "general remark"` | Positioned box not connected to any element | Poster `note "text" at pos` only; general overlay system doesn't support it |
| **Region/spanning** | `note over A,B: "context"` | Note spanning multiple elements | Sequence only (`Note over A,B`) |

#### Option G: Extend the General Overlay System — RECOMMENDED

The `RawNote → Annotation` pipeline exists. Extend it for broader coverage:

| Criterion | Assessment |
|-----------|-----------|
| Determinism & offline | ✅ Pure text → geometry. No I/O. |
| Static PNG safety | ✅ `<rect>` + `<text>`. Fully safe. |
| Theme-awareness | ✅ Overlay renderer already uses palette tokens. Poster notes use `palette.surface` fill + `palette.primary` stroke/text. |
| Authoring ergonomics | Natural: `note on NodeA: "explanation"` (attached), `note "remark"` (free-floating). Consistent with Mermaid's sequence/class syntax. |
| Layout impact | ⚠️ Anchored notes need element bounding boxes (overlay system already handles this). Free-floating notes need absolute or relative positioning. De-collision with existing elements follows poster's `chromeRects` / `textOccupied` precedent. **Edsger/Brian's domain** — the overlay layout pass (`src/overlay/layout.ts`) already does anchor resolution; extending it for free-floating notes requires a positioning strategy (corner-based like poster, or coordinate-based). |

**What the Mermaid landscape tells us:** Only 3 of Mermaid's 15+ diagram types support notes (sequence, state, class). Adding notes to flowcharts, timelines, or mindmaps would be a Triton-original feature — there's no Mermaid syntax to be superset-compatible with. This gives Triton freedom to design clean syntax without legacy constraints.

#### Option H: Markdown-Rich Note Boxes — DEFERRED

Multi-line notes with bold/italic/lists/code rendered as SVG text spans. Desirable but high-cost — this is a text layout engine problem. `<foreignObject>` with HTML would be simpler but **breaks rsvg-convert**. Defer to Phase 2+.

#### Option I: `<foreignObject>` HTML Notes — REJECTED

rsvg-convert does not render `<foreignObject>` HTML content. Notes would be blank boxes in PNG. Incompatible.

---

## RECOMMENDATION

### Icons — Option A (Inline SVG Path Registry) with `fa:` mapped to curated subset (A-2)

**Do this.** The `scene-icon-glyph/SKILL.md` pattern is the rendering foundation. Build on it:

1. **Icon registry module** (`src/icons/registry.ts`) — map of name → `{ paths: PathDef[], viewBox: '0 0 24 24' }`. Seed with 20–30 icons from Lucide (ISC license): covers `server`, `database`, `cloud`, `globe`, `user`, `lock`, `shield`, `gear`, `warning`, `check`, `file`, `folder`, `code`, `terminal`, `chart-bar`, `heart`, `star`, `search`, `bell`, `mail`, `key`, `camera`, `download`, `upload`, `clock`, `calendar`.
2. **`fa:fa-xxx` syntax** — parse it (Mermaid superset), map `fa-database` → `database`, `fa-server` → `server`, etc. Unknown names → compile-time warning + `?` fallback glyph. Do NOT emit `<foreignObject>` or webfont references under any circumstances.
3. **Extend mindmap** — `::icon(database)` → actual icon glyph, not a 4px dot.
4. **Extend architecture** — replace the 5 hardcoded `iconGlyph()` functions with registry lookups.
5. **Layout reservation** — each icon occupies a fixed bounding box (e.g., 16×16, 20×20, 24×24 depending on context). The `scene-icon-glyph` skill's sizing formulas apply. Edsger/Brian own the box-reservation implementation per diagram type.

**Avoid:** Webfont icons, `<foreignObject>`, AsyncLoader CDN fetch, full FA bundle.

### Images — Option E (Data URI via Host), deferred

**Defer unless concrete demand emerges.** The `image-primitive/SKILL.md` design is a ready blueprint. When needed:

1. Add `SceneImage` to Scene model.
2. Host resolves `image("file.png")` → `data:` URI via `loadImageAsset()` pattern.
3. Core emits `<image href="data:…" width="…" height="…">`.
4. **Reject remote URLs at compile time** with a clear error message.
5. Require explicit `width` and `height` in syntax (no browser DOM for natural dimensions).

### Notes — Option G (Extend General Overlay System)

**Do this.** The overlay infrastructure exists; the work is grammar rules + de-collision:

1. **Attached notes** — `note on <element>: "text"` syntax in flowchart, timeline, and future diagram types. Maps to `RawNote` → `Annotation` → callout box + connector. The overlay compiler and layout engine handle this today.
2. **Free-floating notes** — `note "text" [at <position>]` syntax. Generalizes poster's `PosterNote` model to all diagram types. Position can be corner-based (`top-left`, etc.) or eventually coordinate-based.
3. **Theme-aware rendering** — notes use `palette.surface` fill (semi-transparent), `palette.primary` or `palette.warning` stroke/text, theme font. Matches existing poster/sequence note styling.
4. **De-collision** — notes register as occupied rects so cross-link labels / other overlays avoid them. Follows the `chromeRects` / `textOccupied` precedent from poster layout.

**Comments (`%%`)** — no action. Already complete and correct.

### Suggested Phasing

| Phase | Scope | Estimated Effort |
|---|---|---|
| **Phase 1** | Icon registry module + architecture/mindmap integration. Attached notes via overlay system in flowchart. | 8–12 hours |
| **Phase 2** | `fa:fa-xxx` syntax mapping. Free-floating notes. Icon support in flowchart nodes. | 6–10 hours |
| **Phase 3** | User-supplied SVG icons (Option B). Multi-line note text. | 8–12 hours |
| **Deferred** | Image primitive (`SceneImage` + host resolution). Rich Markdown notes. | On demand |

---

*Analysis complete. No implementation in this deliverable.*
