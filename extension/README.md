# Triton — VS Code extension

Live, deterministic preview for **Triton** diagrams, rendered by the Triton
compiler itself. As you type, the diagram updates in a side panel — the same SVG
that `pnpm figures` would produce.

## Preview

![Triton live preview — spanning.mmd rendered with crosslinks and animated marching-ants](https://github.com/ormasoftchile/triton/raw/main/extension/resources/spanning.animated.png)

Animated poster preview with crosslinks, colored arrowheads, and a dark opaque
background suitable for Marketplace and GitHub.

## What it does

- Adds the `triton` language for `.triton` files.
- **Triton: Open Preview** and **Triton: Open Preview to the Side** render the
  active file's diagram into a webview and keep it live as you edit (debounced).
- Rendering reuses the project compiler's `render()` entry point — no parsing,
  layout, or SVG generation is reimplemented here. SVG only; no native deps.

## Try it

1. Build the bundle (see below).
2. Open a `.triton` file (or any of the `examples/**/*.mmd` diagrams).
3. Run **Triton: Open Preview to the Side** from the command palette, or use the
   editor-title buttons.
4. Edit the source — the preview re-renders. Parse errors show as a banner
   without blanking the last good diagram.

## Mermaid coexistence — and why `triton.enableMermaid` defaults to **off**

Triton speaks the same diagram grammar as Mermaid, so it *could* claim every
`.mmd` file and ```` ```mermaid ```` block on your machine. It deliberately does
not, to avoid stomping an already-installed Mermaid extension:

- `triton` files / `.triton` / ```` ```triton ```` fences are **always** handled.
- The **explicit** _Open Preview_ commands render **any** active file
  unconditionally — including `.mmd` files and ```` ```mermaid ```` fences.
- **Passive** handling of Mermaid content (auto-selecting a ```` ```mermaid ````
  block in Markdown) is gated behind **`triton.enableMermaid`**, which defaults
  to `false`. Turn it on only if you want Triton to also pick up Mermaid content
  automatically.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `triton.enableMermaid` | `false` | Passively handle Mermaid (`.mmd` / ```` ```mermaid ````) content. The explicit command always works regardless. |
| `triton.preview.debounceMs` | `150` | Delay after the last edit before the preview re-renders. |

## Custom themes

Place `.triton-theme.json` files in `.triton/themes/` inside any workspace folder:

```
my-project/
└── .triton/
    └── themes/
        └── my-brand.triton-theme.json
```

- **Auto-discovery:** the extension scans `.triton/themes/` on activation and
  watches for changes. No configuration required.
- **Theme dropdown:** custom themes appear under a `── Custom ──` divider below
  the built-in presets in the preview panel's theme picker.
- **Live reload:** saving a theme file re-renders the active preview immediately.
- **Fallback:** if the selected theme file is deleted, the selection reverts to
  **Auto** and a warning appears in the **Triton Themes** output channel.

See [docs/external-themes.md](../docs/external-themes.md) for the full format
reference and a cross-host worked example (same file in VS Code + LaTeX).

## Build

```sh
# from the repo root, once: generate the Peggy parsers used by the compiler
pnpm build:grammars

# install the extension's own (isolated) devDeps, then bundle
pnpm -C extension install
pnpm -C extension build      # → extension/dist/extension.cjs
pnpm -C extension typecheck  # tsc --noEmit
```

The extension is a self-contained satellite: its own `package.json`, **not** a
member of `pnpm-workspace.yaml`. It imports the compiler by relative path from
`../src` and esbuild bundles the whole graph (including the generated Peggy
parsers) into one CommonJS file. `esbuild.mjs` runs `pnpm build:grammars`
automatically and fails loudly if a parser is missing.
