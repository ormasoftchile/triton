# External Themes

Triton diagrams render with a built-in theme preset (e.g. `default`, `executive`,
`minimal`). **External themes** let you define your own colour palettes and
typography in a plain `.triton-theme.json` file that lives in your project.
**Author once, use everywhere**: the same file works identically in the VS Code
live preview _and_ in LaTeX documents compiled with `triton.sty`.

---

## Contents

1. [File format reference](#file-format-reference)
2. [VS Code](#vs-code)
3. [LaTeX / CLI](#latex--cli)
4. [Authoring guide](#authoring-guide)
5. [Cross-host worked example](#cross-host-worked-example)
6. [Troubleshooting](#troubleshooting)

---

## File format reference

A `.triton-theme.json` file is a JSON object with **only** the fields listed
below. The validator is **strict**: any unknown key at any level is an immediate
hard error — there is no forward-compatibility allowance.

### Top-level keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | No | Theme identifier. Lowercase slug `[a-z0-9-]`, 1–64 chars. Derived from the filename if omitted. |
| `base` | string | No | Built-in preset to merge over. Defaults to `"default"`. Must be one of the built-in preset names. |
| `palette` | object | No | Colour overrides — see below. |
| `typography` | object | No | Font and size overrides — see below. |
| `spacing` | object | No | Layout spacing overrides — see below. |
| `edges` | object | No | Edge rendering overrides — see below. |
| `panel` | object | No | Titled-panel chrome overrides — see below. |

All groups and their fields are optional. Missing fields inherit from the `base`
preset.

### `palette`

All values must be CSS hex colours (`#RGB` or `#RRGGBB`).

| Field | Description |
|-------|-------------|
| `primary` | Primary accent — edges, active indicators, highlights. |
| `secondary` | Secondary accent — badges, secondary highlights. |
| `background` | Canvas / page background. |
| `surface` | Node / card fill. |
| `border` | Default border and stroke. |
| `text` | Primary readable text. |
| `textMuted` | De-emphasised / secondary text. |
| `success` | Semantic: success state. |
| `warning` | Semantic: warning state. |
| `error` | Semantic: error / blocked state. |

### `typography`

| Field | Type | Description |
|-------|------|-------------|
| `fontFamily` | string | Sans-serif font stack for body text. Cannot contain `url()` or `expression()`. |
| `monoFamily` | string | Monospace font stack for code / data labels. Cannot contain `url()` or `expression()`. |
| `baseFontSize` | number (> 0) | Base body text size in px. |
| `titleFontSize` | number (> 0) | Diagram title / section heading size in px. |
| `smallFontSize` | number (> 0) | Labels, captions, timestamps in px. |
| `lineHeight` | number (> 0) | Line-height multiplier (unitless, e.g. `1.4`). |

### `spacing`

All values are non-negative numbers (px).

| Field | Description |
|-------|-------------|
| `unit` | Base grid unit. |
| `nodePadding` | Padding inside node / card shapes. |
| `nodeGap` | Gap between adjacent nodes. |
| `diagramMargin` | Margin between diagram content and the viewBox edge. |

### `edges`

| Field | Type | Description |
|-------|------|-------------|
| `strokeWidth` | number (≥ 0) | Default edge stroke width in px. |
| `arrowSize` | number (≥ 0) | Arrowhead size in px. |
| `labelFontSize` | number (≥ 0) | Font size for edge labels in px. |
| `curveTension` | number 0–1 | Bézier curve tension: 0 = straight, 1 = full arc. |

### `panel`

| Field | Enum values | Description |
|-------|-------------|-------------|
| `titleAlign` | `"left"` `"center"` `"right"` | Horizontal alignment of the panel title. |
| `titlePosition` | `"inside"` `"on-border"` `"above"` | Vertical placement of the title relative to the panel top edge. |
| `titleChrome` | `"none"` `"box"` `"pill"` | Decorative container drawn behind the title. |

### `base` — built-in preset names

The `base` field must be one of:

```
default  executive  minimal  consulting  product  release
ai-timeline  bytebytego  gitline  our-timeline  subject-timeline  showcase
```

External theme names **cannot shadow** a built-in preset name. If a discovered
theme's name matches a built-in, it is silently skipped and a warning is emitted.

### Strict validation rules (summary)

| Rule | Detail |
|------|--------|
| Unknown keys | **Error** — unknown key at any nesting level rejects the file |
| Hex colours | Must match `#RGB` or `#RRGGBB` (case-insensitive) |
| Font values | Cannot contain `url(` or `expression(` |
| `name` slug | Must match `^[a-z0-9-]+$`, 1–64 chars |
| `base` value | Must be a known built-in preset name |

### Schema reference for editors

The canonical JSON Schema lives at `src/theme/schema.json` in the Triton repo,
with `$id: "https://triton.dev/schemas/triton-theme.schema.json"`.

> **Important:** Because the validator is strict, you **cannot** put a `$schema`
> key in your `.triton-theme.json` file — `$schema` is not a known field and
> will cause a validation error. To get editor auto-complete and inline
> validation, add a JSON schema mapping to your VS Code workspace settings
> instead:
>
> ```json
> // .vscode/settings.json
> {
>   "json.schemas": [
>     {
>       "fileMatch": ["**/*.triton-theme.json"],
>       "url": "./src/theme/schema.json"
>     }
>   ]
> }
> ```
>
> Adjust the `url` to the relative path from your workspace root to
> `src/theme/schema.json` (or a copy of it).

---

## VS Code

### Convention

Place `.triton-theme.json` files in a `.triton/themes/` directory inside any
workspace folder:

```
my-project/
└── .triton/
    └── themes/
        └── my-brand.triton-theme.json
```

Multiple workspace folders (multi-root workspaces) each scan their own
`.triton/themes/` directory. Themes from all folders are merged into a single
registry; if two folders define a theme with the same name the last folder wins
and a warning is logged.

### Auto-discovery

The extension discovers `*.triton-theme.json` files automatically on activation
and whenever files in `.triton/themes/` change. No configuration required.

### Theme dropdown

Custom themes appear at the bottom of the theme picker in the live-preview panel,
separated from built-in presets by a `── Custom ──` divider:

```
Auto (diagram metadata)
default
executive
minimal
…
── Custom ──
my-brand
```

### Live reload

Saving a `.triton-theme.json` file triggers an immediate refresh: the dropdown
updates and the active preview re-renders with the new colours. No panel restart
is needed.

### Fallback on deletion

If the currently selected theme's file is deleted, the extension falls back to
**Auto** and logs a warning to the **Triton Themes** output channel.

### Warnings

Validation failures and name collisions are reported as VS Code notification
messages _and_ logged to the **Triton Themes** output channel (accessible via
**View → Output → Triton Themes**).

---

## LaTeX / CLI

### CLI flags

| Flag | Argument | Description |
|------|----------|-------------|
| `--theme-file <path>` | Absolute or relative path to a `.triton-theme.json` | Load a single theme file directly. Takes priority over all other theme resolution. Fatal if the file is missing or invalid. |
| `--themes-dir <dir>` | Directory containing `*.triton-theme.json` files | Build a registry from this directory and use `--theme <name>` to select from it. Merged on top of auto-discovered themes; overlaps on collision. |
| `--theme <name>` | Theme name | Select by name. Looks up the registry built from `--themes-dir` and auto-discovery first; falls back to built-in presets. |

### Resolution priority

1. `--theme-file <path>` — highest priority; used as-is.
2. Registry lookup: themes from auto-discovered `.triton/themes/` + `--themes-dir` overlay, then `--theme <name>` selection.
3. No theme flag — diagram uses its own `theme:` frontmatter or the `default` preset.

### Auto-discovery

When neither `--theme-file` nor `--themes-dir` is given, the CLI walks up the
directory tree from the input file looking for a `.triton/themes/` directory and
loads any `*.triton-theme.json` files it finds there. This mirrors the VS Code
extension's behaviour.

### `.sty` macros

| Macro | Effect |
|-------|--------|
| `\tritonthemefile{<path>}` | Pass `--theme-file <path>` to the CLI for every inline render in this document. |
| `\tritonthemesdir{<dir>}` | Pass `--themes-dir <dir>` to the CLI for every inline render. |

These macros complement the existing `\tritontheme{<name>}` macro, which selects
a theme by name (built-in or discovered).

Example:

```latex
\usepackage{triton}
\tritonthemefile{.triton/themes/my-brand.triton-theme.json}

\begin{triton}
flowchart LR
  A[Design] --> B[Implement] --> C[Ship]
\end{triton}
```

### ⚠️ Cache-key limitation

The LaTeX package caches rendered diagrams keyed by the **path** of the theme
file, not its **content**. If you edit a `.triton-theme.json` in place without
changing its path, the cached PDF will be reused — your colour changes will not
appear until you clear the cache.

**Workaround:** delete the cache directory and recompile:

```sh
# latexmk
latexmk -C

# or manually
rm -r <jobname>.triton-cache
```

This is a known Tier-2 deferral. Content-aware hashing is planned for a future
release.

---

## Authoring guide

Start by copying [`examples/.triton/themes/example.triton-theme.json`](../examples/.triton/themes/example.triton-theme.json)
from this repo. It contains every field group with sensible defaults so you can
see which values are available and delete what you don't need to override.

**Workflow:**

1. Copy the example file into your project's `.triton/themes/` directory.
2. Rename it to a slug that matches your brand (e.g. `my-brand.triton-theme.json`).
3. Set `"name": "my-brand"` (or omit `name` — it will be derived from the filename).
4. Set `"base"` to the built-in preset whose defaults you want to build on.
5. Override only the fields you care about. Everything else inherits from `base`.
6. Save — VS Code reloads instantly; LaTeX requires clearing the cache if editing
   an existing file in place.

**Minimal example:**

```json
{
  "name": "brand-blue",
  "base": "minimal",
  "palette": {
    "primary": "#1D4ED8"
  }
}
```

Only the `primary` accent colour is changed; every other value is inherited from
the `minimal` preset.

---

## Cross-host worked example

The file `examples/.triton/themes/example.triton-theme.json` in this repository
is a canonical template. The **same file** can be used in VS Code and in LaTeX
— no format conversion, no duplication.

### In VS Code

1. Place `example.triton-theme.json` in `.triton/themes/` of your workspace.
2. Open a `.triton` / `.mmd` file and open the preview panel.
3. In the theme dropdown, scroll to the `── Custom ──` group and select `example`.

The preview re-renders immediately in the template's colours (blue primary, slate
background, neutral borders).

### In LaTeX (inline with `.sty`)

```latex
\usepackage{triton}
\tritonthemefile{.triton/themes/example.triton-theme.json}

\begin{triton}
flowchart LR
  A[Parse] --> B[Layout] --> C[Render]
\end{triton}
```

Compile with shell-escape:

```sh
pdflatex -shell-escape mydoc.tex
```

### In LaTeX (CLI direct)

```sh
node dist/cli.cjs render diagram.mmd -o diagram.pdf \
  --theme-file .triton/themes/example.triton-theme.json
```

The identical JSON file drives both hosts. Change a colour in the file, reload
VS Code's preview (instant), and clear the LaTeX cache then recompile — both
outputs update from the same source of truth.

---

## Troubleshooting

### Validation error: unknown key

```
Theme file "my-theme.triton-theme.json" failed validation: Unknown key "colour"
```

The validator is strict — every key must be in the known set. Common causes:
- Typo in a field name (e.g. `colour` instead of the correct `palette.primary`).
- A `$schema` key in the file — remove it and use VS Code `json.schemas` settings
  instead (see [Schema reference for editors](#schema-reference-for-editors)).
- A nested group key that doesn't exist (e.g. `palette.accent` — there is no
  `accent` field).

### Name collision with a built-in preset

```
[Triton Themes] Skipping "minimal" — name shadows a built-in preset
```

An external theme cannot use the same name as a built-in preset. Rename your
file and update the `name` field inside it.

### LaTeX: stale diagram after editing a theme file

If you edited a `.triton-theme.json` in place and recompiled but the diagram
still shows the old colours, the cache has not been invalidated. Clear it:

```sh
latexmk -C        # or: rm -r <jobname>.triton-cache
```

The cache key is based on the theme file **path**, not its content. This is a
known limitation; see [⚠️ Cache-key limitation](#️-cache-key-limitation).

### VS Code: theme not appearing in dropdown

- Confirm the file is in `.triton/themes/` inside a workspace folder (not a
  subfolder of `.triton/themes/`).
- Check the **Triton Themes** output channel for validation warnings.
- Make sure the filename ends in `.triton-theme.json`.
- The `name` field (if present) must be a lowercase slug matching `[a-z0-9-]+`.
  A validation error on the `name` field will cause the file to be skipped.
