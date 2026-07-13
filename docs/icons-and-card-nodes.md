# Icons & Card Nodes

Triton supports **bring-your-own icon packs** (BYOP): you supply icon files in
Iconify JSON format, Triton loads them automatically, and you reference icons
directly in diagram node annotations. No registration step, no config key.

Two colour modes are handled transparently:

- **Monochrome** icons (e.g. MDI, Lucide, Heroicons) use only
  `fill="currentColor"` or `fill="none"`. Triton tints them to the active theme
  palette via CSS `color` inheritance — they automatically match your diagram's
  colour scheme in both light and dark modes.
- **Brand** icons (e.g. Azure architecture icons, product logos) embed hardcoded
  hex fills or gradient definitions. Triton renders them verbatim so the brand
  colours are preserved exactly.

The distinction is detected automatically from the SVG body — you do not need to
tag icons manually.

---

## Contents

1. [Pack file format](#pack-file-format)
2. [Where packs live](#where-packs-live)
3. [Diagram syntax](#diagram-syntax)
4. [VS Code preview](#vs-code-preview)
5. [LaTeX / CLI](#latex--cli)
6. [Authoring a pack from SVGs](#authoring-a-pack-from-svgs)
7. [Static-PNG notes](#static-png-notes)
8. [Troubleshooting](#troubleshooting)

---

## Pack file format

An icon pack is a single `.triton-icons.json` file in
[Iconify JSON](https://iconify.design/docs/types/iconify-json.html) format.
Triton uses a **strict** validator: any unknown key at any level is a hard error,
and every required field must be present with the correct type.

### File-naming convention

The file may be named anything ending in `.triton-icons.json`
(e.g. `azure.triton-icons.json`, `my-icons.triton-icons.json`). The authoritative
pack identity is the `prefix` field inside the file, not the filename.

### Minimal valid example

```json
{
  "prefix": "mdi",
  "icons": {
    "server": {
      "body": "<rect fill=\"currentColor\" x=\"2\" y=\"2\" width=\"20\" height=\"8\" rx=\"2\"/>"
    }
  }
}
```

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prefix` | string | **Yes** | Pack identifier. Pattern: `^[a-z][a-z0-9-]*$` (e.g. `"azure"`, `"mdi"`, `"lucide"`). |
| `icons` | object | **Yes** | Icon entries keyed by bare name. At least one entry required. |
| `aliases` | object | No | Alternate names pointing to icons in this pack. |
| `width` | number | No | Default viewport width in px for icons that omit their own. System default: `16`. |
| `height` | number | No | Default viewport height in px. System default: `16`. |
| `left` | number | No | Default viewport x-origin in px. System default: `0`. |
| `top` | number | No | Default viewport y-origin in px. System default: `0`. |

`width` and `height` must be strictly positive numbers. `left` and `top` may be
zero or negative (unusual viewboxes are valid).

### Icon entries (`icons`)

Each key is a bare icon name matching `^[a-z0-9][a-z0-9-]*$`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `body` | string | **Yes** | Inner SVG markup — **no `<svg>` wrapper**. Must be non-empty. |
| `width` | number | No | Icon-specific viewport width in px. Overrides pack-level `width`. |
| `height` | number | No | Icon-specific viewport height in px. Overrides pack-level `height`. |
| `left` | number | No | Icon-specific viewport x-origin in px. |
| `top` | number | No | Icon-specific viewport y-origin in px. |
| `rotate` | 0 \| 1 \| 2 \| 3 | No | Quarter-turn rotation: `0`=0°, `1`=90°, `2`=180°, `3`=270° clockwise. |
| `hFlip` | boolean | No | Mirror horizontally (left ↔ right). |
| `vFlip` | boolean | No | Mirror vertically (top ↔ bottom). |

ViewBox resolution order (highest priority first): icon-level → pack-level →
system defaults (16 × 16, origin 0, 0).

### Aliases (`aliases`)

Aliases give alternate names to existing icons within the same pack. Transforms
compose on top of the parent icon: rotation adds mod 4; `hFlip`/`vFlip` XOR.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent` | string | **Yes** | Bare name of the parent icon in this pack. |
| `rotate` | 0 \| 1 \| 2 \| 3 | No | Additional rotation on top of parent's (mod 4). |
| `hFlip` | boolean | No | Additional horizontal flip (XORed with parent's). |
| `vFlip` | boolean | No | Additional vertical flip (XORed with parent's). |
| `width` | number | No | Override viewport width for this alias. |
| `height` | number | No | Override viewport height for this alias. |
| `left` | number | No | Override viewport x-origin. |
| `top` | number | No | Override viewport y-origin. |

Alias chains up to depth 4 are supported. Deeper chains produce an
`ICON_NOT_FOUND` error.

### Validation errors

The validator returns one of two error codes:

| Code | When raised |
|------|-------------|
| `ICON_VALIDATION_ERROR` | Pack structure is invalid (wrong types, unknown keys, missing required fields, bad prefix/name format, empty `icons` object, etc.). |
| `ICON_NOT_FOUND` | An icon reference `prefix:name` could not be resolved — pack not loaded, icon/alias name not in pack, or alias chain too deep. |

**Example error messages:**

```
ICON_VALIDATION_ERROR: Unknown top-level key: "metadata"
ICON_VALIDATION_ERROR: icons["my icon"].body must be a non-empty string
ICON_VALIDATION_ERROR: "prefix" must match ^[a-z][a-z0-9-]*$ (lowercase letter start, then lowercase alnum/hyphens), got "Azure"
ICON_NOT_FOUND: Icon pack "azure" not loaded (looking up "azure:app-service")
ICON_NOT_FOUND: Icon "no-such-icon" not found in pack "mdi" (checked icons and aliases)
```

---

## Where packs live

### Repository convention: `.triton/icons/`

Place your `.triton-icons.json` files in a `.triton/icons/` directory at the root
of your repository:

```
my-project/
├── .triton/
│   └── icons/
│       ├── azure.triton-icons.json
│       └── mdi.triton-icons.json
├── diagrams/
│   └── architecture.mmd
└── ...
```

All three hosts (VS Code extension, `triton-latex` CLI, API) discover this
directory automatically by walking up from the diagram file's location — no
configuration required.

### Multi-root workspace (VS Code)

In a VS Code multi-root workspace, each workspace folder is scanned independently
for `.triton/icons/`. The merged pack map is the union of all folders. If the
same prefix appears in more than one folder, the **last-scanned folder wins**
and a warning is shown in the "Triton Icons" output channel.

### Duplicate-prefix rule

Within a single directory, if two files declare the same `prefix`, the **last
file in directory order wins** and a warning is emitted. The authoritative key
is always the `prefix` field inside the file — the filename is irrelevant for
lookup.

---

## Diagram syntax

### Token grammar

Icon references use a two-part token: `prefix:name`.

- **`prefix`** — matches `^[a-z][a-z0-9-]*$` (must match the pack's `prefix` field).
- **`name`** — matches `^[a-z0-9][a-z0-9-]*$` (must match an icon or alias key in that pack).

Both parts are lowercase only. Examples: `mdi:server`, `azure:app-service`,
`lucide:0-circle`.

### Node annotations

Annotations attach metadata to a node using `@key:value` suffixes after the node
declaration. Multiple annotations are separated by spaces and may appear in any
order. Values may be quoted (`@key:"value with spaces"`) or unquoted.

```
NodeId["Label"] @key:value @key2:value2
```

Two annotation keys are defined for icons and card layout:

| Annotation | Example | Effect |
|------------|---------|--------|
| `@icon:prefix:name` | `@icon:mdi:server` | Attach an icon to this node. |
| `@shape:card` | `@shape:card` | Render as a card: icon on the left, label text on the right. |

The `@icon` value is the full token `prefix:name`; the colon between prefix and
name is part of the value (not a second annotation separator).

### Card nodes

The `card` shape renders a wide horizontal node with two regions:

- **Left region** — the icon (if `@icon` is set), sized to fit the icon's viewbox.
- **Right region** — the label text. If the label contains `\n`, the first
  segment is the **bold title** and the remainder is the **body text** (muted,
  word-wrapped).

A card without `@icon` still renders correctly — the label fills the full width.

### Worked example

The following diagram produces three card nodes with icons, mirroring
`examples/triton/icons/cards-render.ts`:

```
flowchart TD
  A["App Service\nHandles HTTP request routing and load balancing"] @shape:card @icon:mdi:server
  B["PostgreSQL\nPrimary relational data store used by all backend services"] @shape:card @icon:mdi:database
  C["Cache Layer\nIn-memory key-value store"] @shape:card
  A -->|queries| B
  A -->|caches| C
```

**What you get:**

- Three tall-and-wide card boxes arranged top-to-bottom.
- Cards A and B show a monochrome icon on the left, tinted to `palette.primary`.
- Card C has no icon; its label fills the full card width.
- Edge labels appear on the connecting arrows.

The rendered output is available as
`examples/triton/icons/cards.svg` / `examples/triton/icons/cards.png`.

---

## VS Code preview

The VS Code extension auto-discovers icon packs from every workspace folder's
`.triton/icons/` directory — no settings entry required.

### Live reload

The extension installs a `FileSystemWatcher` for the glob pattern
`.triton/icons/*.triton-icons.json` in each workspace folder. Any create, change,
or delete event triggers an automatic refresh: the pack map is rebuilt and all
open diagram previews re-render immediately.

### Warnings

Validation warnings (malformed JSON, unknown keys, duplicate prefixes) are
surfaced in two places:

- **"Triton Icons" output channel** — full details of every warning with a
  timestamp. Open it via _View → Output → Triton Icons_.
- **VS Code notification popup** — a one-line summary for new warnings (deduplicated
  across refreshes to avoid pop-up fatigue).

A missing `.triton/icons/` directory is silently ignored — a project with no icon
packs is valid.

---

## LaTeX / CLI

The `triton-latex` CLI renders `.mmd` and `.triton` files to PDF or SVG for use
with `\includegraphics` in LaTeX. Icon packs are resolved via three priority
levels:

| Priority | Flag / source | Wins over |
|----------|---------------|-----------|
| Highest | `--icon-pack <path>` | Everything |
| Middle | `--icons-dir <dir>` | Auto-discovery only |
| Lowest | Auto-discovery | — |

**Auto-discovery** walks up from the input file's directory looking for the nearest
`.triton/icons/` ancestor (up to 10 levels). This mirrors the VS Code behaviour
exactly — a pack placed at the repo root is found automatically in both hosts.

When the same prefix appears in more than one source, the higher-priority source
wins (last-wins within a single source; sources are merged in ascending priority
order).

### CLI flags

```bash
# Use all packs found in a specific directory
triton-latex render diagram.mmd -o diagram.pdf --icons-dir ./my-icons/

# Use a single explicit pack file (highest precedence)
triton-latex render diagram.mmd -o diagram.pdf --icon-pack ./azure.triton-icons.json

# Combine: explicit pack overrides anything in the directory
triton-latex render diagram.mmd -o diagram.pdf \
  --icons-dir ./base-icons/ \
  --icon-pack ./overrides.triton-icons.json
```

### LaTeX macros (`triton.sty`)

```latex
% Load all packs from a directory (merged on top of auto-discovery)
\tritoniconsdir{path/to/icons}

% Load a single explicit pack file (highest precedence — overrides all other sources)
\tritoniconpack{path/to/azure.triton-icons.json}
```

Both macros are optional. When neither is set, auto-discovery still runs from
the `.mmd` file's location.

**Cache invalidation:** `triton.sty` uses a content-addressed cache key so that
diagrams are only re-rendered when their inputs change. For `\tritoniconpack`,
the pack file's MD5 hash is included in the key — editing the pack file
automatically invalidates the cached diagram and forces a re-render. For
`\tritoniconsdir` and auto-discovered packs the key includes only the directory
path, so editing a pack file inside the directory also invalidates cached output
(the path key changes if you rename or move the file).

---

## Authoring a pack from SVGs

Use `scripts/convert-icons.mjs` to turn a directory of `.svg` files into a
ready-to-use `.triton-icons.json` pack. The script is built on
[`@iconify/tools`](https://github.com/iconify/tools) (a `devDependency` —
authoring-time only, not shipped in `triton-core` or the extension).

### Installation

`@iconify/tools` is included in the repo's normal dev install:

```bash
pnpm install
```

No separate install step is required.

### Usage

```bash
node scripts/convert-icons.mjs <svg-dir> <prefix> [--out <file>] [--no-svgo]
```

| Argument / flag | Description |
|-----------------|-------------|
| `<svg-dir>` | Directory containing the `.svg` source files. |
| `<prefix>` | Pack prefix for the output (e.g. `azure`, `mdi`). Must match `^[a-z][a-z0-9-]*$`. |
| `--out <file>` | Output path. Defaults to `<prefix>.triton-icons.json` in the current working directory. |
| `--no-svgo` | Skip SVGO optimisation (useful for already-optimised SVGs or faster iteration). |

### Examples

```bash
# Convert an Azure SVG set; output goes to .triton/icons/azure.triton-icons.json
node scripts/convert-icons.mjs ./vendor/azure-icons/ azure \
  --out .triton/icons/azure.triton-icons.json

# Convert MDI icons without re-running SVGO (they're pre-optimised)
node scripts/convert-icons.mjs ./vendor/mdi/ mdi --no-svgo \
  --out .triton/icons/mdi.triton-icons.json
```

### What the script does

1. **Import** — `@iconify/tools importDirectory` reads every `.svg` under the
   source directory and applies `cleanupSVG` to each file (removes `<title>`,
   `<desc>`, extraneous attributes, etc.).
2. **Optimise** — `runSVGO` is applied to each icon unless `--no-svgo` is passed.
3. **Sanitise** — the output is stripped to only the keys Triton's strict
   validator allows (`body`, `width`, `height`, `left`, `top`, `rotate`,
   `hFlip`, `vFlip`). No unknown keys survive.
4. **Hoist uniform dimensions** — if every icon in the set shares the same
   `width` and `height`, those values are promoted to pack-level fields and
   removed from individual icon entries (keeps the file compact). Common example:
   a 24 × 24 icon set produces `"width": 24, "height": 24` at the top level.
5. **Validate** — the assembled pack is run through `validateIconPack` (requires
   `pnpm build` to have been run; the script warns and skips if the dist is
   absent).
6. **Write** — the final JSON is written to the output path.

The script prints a per-icon progress log and a summary showing icon count,
monochrome/brand split, pack dimensions, and any skipped files.

### Colour mode after conversion

The converter reports each icon's colour mode in its summary. The same heuristic
runs again at render time — you do not need to tag icons manually:

- **Monochrome** — body uses only `fill="currentColor"`, `fill="none"`, or
  `stroke="currentColor"`. Triton tints these to `palette.primary` via CSS
  `color` inheritance. Correct for single-colour UI icon sets (MDI, Lucide, etc.).
- **Brand** — body contains any hardcoded fill (e.g. `fill="#0078D4"`) or a
  gradient element (`<linearGradient>`, `<radialGradient>`). Triton renders these
  verbatim. Correct for product logos and architecture icon sets.

If the classification is wrong after conversion (e.g. a monochrome icon source
accidentally contains a hardcoded colour), edit the `body` value in the pack file
and replace the offending fill with `currentColor`.

---

## Static-PNG notes

When diagrams are exported to static PNG via `rsvg-convert`, the SVG elements that
survive are: `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polygon>`,
`<polyline>`, and `<text>`. Icon bodies produced by the converter (and the
Iconify icon sets) are composed entirely of `<path>` elements — they render
correctly in PNG output.

The following SVG features do **not** survive `rsvg-convert` output and must not
appear in icon bodies:

- `<foreignObject>` — dropped silently.
- CSS animations / SMIL animations — stripped.
- `<image>` with external URLs — may be blocked.

If an icon pack originates from a source that uses any of these features, strip
them during conversion.

---

## Troubleshooting

**Icon shows as a blank / missing placeholder:**
- Check that the pack file is in `.triton/icons/` and ends with `.triton-icons.json`.
- Verify the `prefix` in the file matches the prefix in your `@icon:prefix:name`
  annotation exactly (case-sensitive; must be lowercase).
- Verify the icon name matches a key in `icons` or `aliases` exactly.
- Open the "Triton Icons" output channel in VS Code for validation warnings.

**VS Code preview doesn't update after editing a pack file:**
- The `FileSystemWatcher` triggers on save. If it doesn't fire, try
  _Developer: Reload Window_ to restart the watcher.

**`ICON_VALIDATION_ERROR: Unknown top-level key`:**
- Your pack file has a field that Triton's strict validator does not recognise.
  Remove or rename the unknown field. Valid top-level keys are:
  `prefix`, `icons`, `aliases`, `width`, `height`, `left`, `top`.

**LaTeX diagram not re-rendering after I edited the pack file:**
- If you used `\tritoniconpack{path}`, the MD5 of the file is part of the cache
  key — the diagram should re-render automatically on next compile.
- If you used `\tritoniconsdir{dir}` or rely on auto-discovery, the cache key
  includes the directory path only; rename the file or run
  `\immediate\write18{rm -f <cached-file>}` to force a re-render.

**`ICON_NOT_FOUND: Icon pack "X" not loaded`:**
- The renderer did not find a pack with prefix `X` in the pack map. Check that
  the pack file's `prefix` field equals `X`, the file is in `.triton/icons/`,
  and no validation warning was emitted that caused the file to be skipped.
