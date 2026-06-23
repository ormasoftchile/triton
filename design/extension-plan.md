# Triton VS Code Extension — Architecture & Rollout Plan

> **Status:** PLAN ONLY (no extension code written yet).
> **Author:** Leslie (Lead / Spec Architect) — 2026-06-23
> **Requested by:** ormasoftchile
> **Scope of this document:** repo location, file-extension decision, architecture for reusing the existing renderer, phased feature breakdown, open questions.

This plan is grounded in the **actual** repository as it exists today — a single flattened root package named `triton` (ESM, `type: module`, NodeNext, Node ≥ 20, pnpm). All file paths below were verified, not assumed.

---

## 0. Ground truth (what the codebase actually gives us)

| Fact | Source | Why it matters to the extension |
|------|--------|---------------------------------|
| Single root package `triton`, `"type": "module"`, no `main`/`exports` field | `package.json` | The extension cannot `import 'triton'` — there is no package entry. It must import the renderer by **relative path** (`../src/...` or `../dist/...`). |
| Public render entry is `render(input, themeInput?, rendererName='svg') => Promise<Result<string>>` | `src/frontend/index.ts` | **This is the single reuse point.** It returns an SVG string and never throws (returns a `Result`). The extension renders by calling this — it must NOT reimplement parsing or layout. |
| Lower-level `renderSVG(scene)` exists | `src/render/svg.ts` | Not needed by the extension; `render()` already composes detect → parse → layout → renderSVG. Use the high-level entry. |
| Header-based detection, no explicit type required | `src/frontend/detect.ts` | `detect(input)` is a **pure function** that maps the first token to a `DiagramKind`. Both Mermaid headers (`flowchart`, `sequenceDiagram`, …) and Triton-only headers (`tree`, `plan`, `avl`, `rbtree`, `btree`, `radix`, `segtree`, `heap`, `array`, `linkedlist`, `memory`, `page`, `topology`) live here. This same table is the spine of IntelliSense (Phase 3). |
| `DiagramKind` union is the single source of truth | `src/contracts/diagram.ts` | 35 diagram kinds enumerated in one place. Drives completion + validation without a second list. |
| Grammars are Peggy `.peggy` → generated `parser.js` in `src/diagrams/<kind>/parser.js` | `scripts/build-grammars.mjs` | `pnpm build:grammars` must run before any build. The generated `parser.js` is a real ESM file committed beside the grammar. |
| **dist-sync quirk:** `tsc` does NOT copy `parser.js` into `dist/` | `design/figures/render.mjs` (lines that `cpSync` parser.js into `dist`) | If the extension consumes `dist/`, it inherits this bug and must replicate the `cpSync` hack. **Bundling from `src/` sidesteps it entirely** (see §3). |
| `pnpm-workspace.yaml` has **no `packages:` field** — only `allowBuilds: esbuild: true` | `pnpm-workspace.yaml` | This is NOT a multi-package workspace today. esbuild is already greenlit as a build tool. The extension can use esbuild without introducing new infra surprises. |
| PNG export uses `@resvg/resvg-js` (native node addon) | `design/figures/render.mjs`, `package.json` devDeps | **Webview preview needs NONE of this** — the webview renders the SVG string directly. Native binaries only become a concern if we add a "Export PNG" command later. |
| Reference for calling the pipeline programmatically | `design/figures/render.mjs` | Working example of `await import(dist/frontend/index.js)` → `render(text)` → SVG. The extension's render path mirrors this, minus the dist-sync hack. |

**One sentence:** the extension is a thin VS Code shell around `render()` — a webview that shows the SVG string, plus a completion provider driven by `DiagramKind` + the `detect.ts` header table.

---

## 1. Repo location — recommendation

### Recommendation: **same repo first**, as a self-contained `extension/` satellite — **NOT a pnpm workspace package.**

The user just deliberately flattened this repo to a single root package and removed nested structure (`v3/` was deleted at their insistence). The instinct against re-introducing nesting is correct, and a naïve "add a pnpm workspace package" would walk straight back into the structure they removed. So the recommendation threads the needle:

- **Put the extension in `extension/`** at the repo root, with its **own `package.json`** (it must — VS Code requires `engines.vscode`, `contributes`, `activationEvents`, and a CommonJS-friendly entry that the root package can't carry).
- **Do NOT add `extension/` to `pnpm-workspace.yaml`.** Leave `pnpm-workspace.yaml` exactly as it is (no `packages:` field). The extension is a **satellite build**, not a workspace member. It imports the compiler by **relative path** (`../src/frontend/index.ts`) and bundles it with esbuild. There is no `pnpm -r` linkage, no workspace graph, no symlinked `node_modules` cross-package — the flat single-root-package shape is preserved.
- The root `triton` package stays the one and only "real" package. `extension/package.json` exists solely to satisfy VS Code's manifest contract and to hold extension-only devDeps (`@types/vscode`, `@vscode/vsce`, `esbuild`, `@vscode/test-electron`).

**Why this specifically (and not a workspace):**

1. **The renderer and the extension MUST stay in lockstep.** The single biggest risk for any "DSL + its editor" pairing is the editor drifting from the language. Co-location means a change to `render()` or `DiagramKind` is visible to the extension in the same commit, same PR, same CI run. A separate repo would need a published `triton` package + version bumps to test an extension change — friction the project doesn't need yet.
2. **No workspace re-introduction.** Because `extension/` is not a workspace member, the thing the user disliked (nested workspace structure, `pnpm -r` fan-out, cross-package linking) does not come back. It's one extra top-level folder with an isolated build — closer to how `design/` and `scripts/` already coexist with `src/`.
3. **esbuild is already allowed** (`allowBuilds: esbuild: true`), so the bundling toolchain is not a new foreign dependency.

### Migration trigger — when to split into a separate repo

Split `extension/` out to its own repository when **any** of these becomes true:

- **Release-cadence conflict:** the extension needs Marketplace releases on a schedule that fights the compiler's versioning (e.g., weekly extension patches vs. a slow, deliberate compiler `0.x` line).
- **Contributor divergence:** people working on the extension are a different group from compiler contributors, and PR/CI noise crosses over unproductively.
- **CI weight:** `@vscode/test-electron` / headless-VS-Code integration tests start dominating CI time and slowing the compiler's fast `vitest` loop. (Keep an eye on this — it's the most likely trigger.)
- **Dependency surface:** the extension accumulates browser/webview build tooling heavy enough that it bloats `pnpm install` for someone who only wants the compiler.

Until one of those fires, the cost of a second repo (publish-to-test loop, version coordination) exceeds the cost of one extra top-level folder. **Same-repo-first is the right call.**

---

## 2. File extension — decision

### Recommendation: **`.tri`**, with language id **`triton`**.

### The two candidates and their real-world collisions

| Ext | Known collisions | Liveness on a *developer's* machine |
|-----|------------------|--------------------------------------|
| `.tri` | 3D / triangle-mesh formats: Bethesda FaceGen morph files (`.tri`), assorted triangle-mesh exporters in 3D-art / game-modding tools. **Binary** formats. | Alive in game-modding / 3D-art circles — but a *disjoint audience* from a diagram-DSL user. |
| `.trt` | Teletext / EBU subtitle files; occasionally "transcript". | Essentially extinct on modern dev machines. |

Both collide. By "least likely to ever appear on the target user's disk," `.trt` technically wins (teletext is dead). But two facts tip the decision to `.tri`:

1. **VS Code language association is editor-scoped, not an OS file association.** The `contributes.languages[].extensions` mapping only tells *VS Code* "treat `.tri` as the `triton` language." It does not seize the OS-level double-click handler and does not fight a 3D tool installed elsewhere. A collision only manifests if the *same VS Code instance* also has an extension claiming `.tri` for a 3D format — low probability — and even then it's resolvable with a one-line `files.associations` override in the workspace. The blast radius of the `.tri` collision is therefore small and contained.
2. **Mnemonics matter and `.tri` is the obvious one.** `tri` = the first three letters of **Tri**ton, pronounceable, and instantly recognizable. `.trt` reads as a typo. For a language people will type by hand and talk about, the mnemonic tie is worth more than avoiding a dead teletext format.

So: **`.tri` primary**, `.trt` documented as the runner-up if the user later decides zero overlap with the 3D-mesh space is worth the ergonomic cost.

> **Honesty note:** the *zero-ambiguity* choice is `.triton` (no realistic collision, self-documenting, and modern editors handle long extensions fine). It was excluded only because the user framed the decision as `.trt` vs `.tri`. If the user is open to it, `.triton` is the safest of the three — worth surfacing as Open Question #2.

### Language id and associations (Phase 1 manifest intent)

- **languageId:** `triton` (covers both `.tri` files and ` ```triton ` fenced blocks).
- **Also claim `.mmd`** for the `triton` language *carefully* — `.mmd` is Mermaid's extension and other Mermaid extensions claim it. Recommended: contribute `.mmd` support but make the Mermaid association **opt-in / lower priority** (see Open Question #3) so we don't stomp an installed Mermaid extension.
- Because diagram **kind is detected from file content** (`detect.ts`), the file extension is mostly a *routing/association* concern, not a semantic one. A `.tri` and a `.mmd` file with identical bodies render identically. This is why the extension choice is low-stakes at the semantic level and we can optimize for mnemonics.

---

## 3. Architecture — reusing the existing `render()` pipeline

### The reuse contract

```
document text ──▶ render(text) ──▶ Result<string>  (SVG)
                  (src/frontend/index.ts)     │
                                              ▼
                                   webview srcdoc / <img>  →  live preview
```

The extension **never** parses, lays out, or builds SVG itself. It calls `render()` and displays the returned string. Detection (`detect`), parsing (per-kind `parseMermaid`/`parseYaml`), layout, theming, and `renderSVG` are all already composed inside `render()`. Reimplementing any of that would be a correctness regression waiting to happen.

### The ESM-vs-CJS / bundling tension (stated plainly)

The friction is real and has three moving parts:

1. **VS Code extension host is CommonJS-first.** The activated extension entry is loaded via `require()`. Our source is ESM (`type: module`, NodeNext, `.js` import specifiers). A raw `import` of ESM source into the CJS host is fragile.
2. **NodeNext source uses `.js` specifiers that point to `.ts` files** (e.g. `import { detect } from './detect.js'`). esbuild does **not** automatically rewrite `./foo.js` → `./foo.ts` when bundling from source.
3. **The parser dist-sync quirk** (`tsc` doesn't copy `parser.js` into `dist/`) means consuming `dist/` drags in the `cpSync` workaround from `render.mjs`.

### Resolution: **esbuild-bundle the extension from `src/`, emitting a single CJS file.**

- **Entry:** `extension/src/extension.ts` (the activate/deactivate shell).
- esbuild bundles it **plus** the imported compiler (`../src/frontend/index.ts` and its transitive graph) into **one CommonJS file** `extension/dist/extension.cjs`, with `platform: node`, `format: cjs`, `external: ['vscode']` (the `vscode` module is provided by the host and must never be bundled).
- **Solving moving-part #2:** add a tiny esbuild resolve plugin (~15 lines) that maps `./x.js` → `./x.ts` when the `.ts` exists. This is a well-known, self-contained pattern for bundling NodeNext ESM source. (Alternative: a prepublish `tsc` to `dist/` and bundle from there — but that re-imports the dist-sync hack, so prefer bundling from `src/`.)
- **Solving moving-part #3:** because we bundle from `src/`, the generated `src/diagrams/<kind>/parser.js` files are **real files in the source tree** and esbuild bundles them inline. **No dist-sync, no `cpSync` hack.** The only precondition is that `pnpm build:grammars` has run so the `parser.js` files exist. The extension build script therefore is: `pnpm build:grammars` → `esbuild extension/src/extension.ts → extension/dist/extension.cjs`.
- **Solving moving-part #1:** the output is CJS, exactly what the host wants. `extension/package.json` sets `"main": "./dist/extension.cjs"` and intentionally **omits** `"type": "module"` (so the host treats `.cjs`/`.js` as CommonJS).

### Webview preview

- A `WebviewPanel` (Phase 1) hosts the SVG. The simplest robust approach: set the panel HTML to a document that embeds the SVG string inside a scrollable/zoomable container (`<div>` with the raw `<svg>…</svg>` injected, or an `<img src="data:image/svg+xml;...">`). **No client-side compiler bundle is required** — rendering happens in the extension host (Node), the webview only displays the result.
- **Security:** set a strict `Content-Security-Policy` on the webview, use a nonce for any inline script (zoom/pan controls only), and `localResourceRoots` scoped tightly. The SVG is generated by our own renderer from user text — still, treat it as untrusted content in the webview (no script execution from the SVG; render it as markup we control, or as a data-URI `<img>` which neutralizes embedded script).
- **Live update:** subscribe to `workspace.onDidChangeTextDocument`, **debounce** (~150–250 ms), re-call `render()`, and post the new SVG to the webview (or reset `webview.html`). On a `Result` error, show the previous good SVG plus an inline error banner with the `DiagramError` message — never blank the panel on a transient parse error mid-typing.
- **Determinism is a gift here:** the compiler is deterministic, so identical text always yields identical SVG — no flicker from nondeterministic layout, and the preview is a faithful proof of what `pnpm figures` would produce.

### Module ownership map (extension ↔ compiler)

| Extension concern | Calls into | Notes |
|-------------------|-----------|-------|
| Render preview | `render(text)` — `src/frontend/index.ts` | Returns `Result<string>` (SVG). Sole render path. |
| Detect kind (for status bar / validation) | `detect(text)` — `src/frontend/detect.ts` | Pure, cheap, synchronous. |
| Completion item source | `DiagramKind` union + `MERMAID_PATTERNS` table | Header keywords for top-of-file completion. |
| Error reporting | `Result.error` (`DiagramError`) | `code` + `message`; surface as a diagnostic / banner. |

---

## 4. Feature breakdown — phases

### Phase 1 — Minimal viable live preview (the spike)

**Scope:** Live, debounced webview preview for standalone diagram files — `.tri` (language `triton`), `.mmd` (Mermaid), driven entirely by content detection. Plus the absolute minimum so it's usable: a "Triton: Open Preview" command and side-by-side panel.

**Key files (to be created):**
- `extension/package.json` — manifest: `engines.vscode`, `contributes.languages` (`triton` ↔ `.tri`, `.mmd`), `contributes.commands` (`triton.openPreview`), `activationEvents`, `main: ./dist/extension.cjs`.
- `extension/src/extension.ts` — `activate()`: register the command, create/track the `WebviewPanel`, wire `onDidChangeTextDocument` (debounced) → `render()` → post SVG.
- `extension/src/preview.ts` — webview HTML shell + CSP/nonce + SVG injection + zoom/pan.
- `extension/esbuild.mjs` — bundle config (CJS, `external: ['vscode']`, `.js`→`.ts` resolve plugin).
- `extension/src/resolve-ts-plugin.mjs` — the ~15-line esbuild resolver.

**VS Code APIs:** `commands.registerCommand`, `window.createWebviewPanel`, `Webview.html` + `asWebviewUri` + CSP nonce, `workspace.onDidChangeTextDocument`, `window.activeTextEditor`.

**Risks:**
- *esbuild `.js`→`.ts` resolution* — mitigated by the resolver plugin; this is the one piece that must be proven first. **Recommend a 1-day spike** to confirm `render()` bundles cleanly into a CJS extension and produces SVG inside a webview before building anything else.
- *Peggy `parser.js` must exist at build time* — mitigated by ordering `build:grammars` before esbuild in the extension build script.
- *Webview SVG security* — mitigated by strict CSP + data-URI `<img>` rendering.

**Exit criterion:** type in a `.tri` or `.mmd` file, see the diagram update live in a side panel, with errors shown non-destructively.

### Phase 2 — Markdown integration

**Scope:** Preview Triton/Mermaid diagrams embedded in Markdown via fenced code blocks ` ```triton ` and ` ```mermaid `, in VS Code's built-in Markdown preview. (File-embed/`![]` reference is a stretch goal within this phase.)

**Approach:** Contribute a **markdown-it plugin** via `contributes.markdown.previewScripts` / the `markdown.markdownItPlugins` extension point. The plugin intercepts ` ```triton `/` ```mermaid ` fences, calls the **same `render()`** (or a pre-rendered SVG handed to the preview), and replaces the code block with the SVG.

**Key files:** `extension/src/markdown-it-triton.ts`, plus `contributes.markdown.markdownItPlugins: true` in the manifest and a `markdown` extension point wiring.

**VS Code APIs:** `contributes.markdown.markdownItPlugins`, the markdown-it extension API, (optionally) `contributes.markdown.previewStyles` for diagram CSS.

**Risks:**
- *Markdown preview runs in a webview with its own context* — the render must produce a self-contained SVG string (it does). If `render()` is async and markdown-it is sync, we may need to **pre-render** fenced blocks on document change and cache by content hash, then have the markdown-it rule emit cached SVG. Flag this as the main design decision of Phase 2.
- *Coexistence with an installed Mermaid extension* — if the user has the Markdown Preview Mermaid extension, both may try to handle ` ```mermaid `. Decide precedence (Open Question #3); default to handling ` ```triton ` unconditionally and ` ```mermaid ` only when configured.

### Phase 3 — IntelliSense / autocompletion

**Scope:** Completion + basic validation for the diagram languages: (a) top-of-file diagram-header completion, (b) per-kind keyword completion, (c) live diagnostics from `render()` errors.

**Approach — driven by what already exists, not a new grammar effort:**
- **Header completion** is essentially free: enumerate the `DiagramKind` union + the `MERMAID_PATTERNS` table from `detect.ts` to offer `flowchart`, `sequenceDiagram`, `tree`, `topology`, … at the top of an empty/early document. One list, already the source of truth.
- **Diagnostics** are also nearly free: on change, call `render()`; on a `Result` error, publish a `Diagnostic` with the `DiagramError.code`/`message`. This gives red squiggles for parse failures with zero new parser work.
- **Per-kind keyword completion** is the harder part. The honest assessment: **Peggy grammars are not directly introspectable for completion** — Peggy generates a recognizer, not a queryable keyword model. So a separate, curated **keyword list per `DiagramKind`** is the pragmatic path (a small map `DiagramKind → string[]` of that grammar's literal keywords). It can be *seeded* by scraping string literals out of each `grammar.peggy`, but it should be maintained as an explicit list, not derived live. Treat full grammar-aware completion (context-sensitive, position-aware) as a later, optional increment.

**Key files:** `extension/src/completion.ts` (CompletionItemProvider), `extension/src/diagnostics.ts`, `extension/src/keywords.ts` (the `DiagramKind → keywords` map).

**VS Code APIs:** `languages.registerCompletionItemProvider`, `languages.createDiagnosticCollection`, `CompletionItem`, `Diagnostic`/`DiagnosticSeverity`.

**Risks:**
- *Keyword list drift* — the curated keyword map can fall behind grammar changes. Mitigate with a test that asserts every `DiagramKind` has a keyword entry, and consider a generator script that diffs against `grammar.peggy` literals.
- *Over-promising IntelliSense* — context-sensitive completion (e.g. "valid edge syntax here") would require a real language-server-grade model the project doesn't have. Keep Phase 3 to header + keyword + diagnostics; defer anything deeper.

---

## 5. Open questions for the user (max 5)

1. **Phase-1 surface:** do you want preview-as-you-type for **both** `.tri` and `.mmd` from day one, or `.tri` only first (and add `.mmd` once the Mermaid-coexistence story is settled)?
2. **File extension final call:** I recommend **`.tri`**. Are you OK accepting the (editor-scoped, low-impact) collision with 3D-mesh `.tri` files? If you'd rather have *zero* realistic collision and accept a less mnemonic extension, the safest option is actually **`.triton`** — want that instead of `.tri`/`.trt`?
3. **Mermaid coexistence:** if a user already has a Mermaid extension installed, should Triton (a) handle ` ```mermaid ` / `.mmd` anyway, (b) defer to the other extension, or (c) make it a setting (default: handle ` ```triton ` always, ` ```mermaid ` only when enabled)?
4. **Extension package identity:** confirm the satellite layout — `extension/` folder, its own `package.json`, **not** added to `pnpm-workspace.yaml` (keeps the repo flat). Any objection to one new top-level folder?
5. **PNG export scope:** Phase 1 webview needs no native binaries. Do you want an "Export PNG" command at all (which pulls in `@resvg/resvg-js`'s platform-specific native addon and complicates packaging), or is SVG-only preview/export sufficient for now?

---

## Appendix — verified file references

- `package.json` — single root package `triton`, ESM, scripts `build:grammars` / `build` / `test` / `figures`.
- `tsconfig.json` — `module: NodeNext`, `outDir: ./dist`, `rootDir: ./src`, strict.
- `pnpm-workspace.yaml` — no `packages:` field; `allowBuilds: esbuild: true`.
- `src/frontend/index.ts` — `compile()` and `render(input, themeInput?, rendererName='svg') => Promise<Result<string>>`; registers all 35 diagram modules.
- `src/frontend/detect.ts` — `detect(input)`, `MERMAID_PATTERNS` header table (Mermaid + Triton-only headers).
- `src/contracts/diagram.ts` — `DiagramKind` union (35 kinds), `DiagramModule` (`parseMermaid`/`parseYaml` + `layout`).
- `src/render/svg.ts` — `renderSVG(scene)` (low-level; not called directly by the extension).
- `scripts/build-grammars.mjs` — Peggy `.peggy` → `src/diagrams/<kind>/parser.js` (+ `.d.ts`).
- `design/figures/render.mjs` — reference for calling `render()` from the built pipeline; contains the `dist`-sync `cpSync` hack the extension avoids by bundling from `src/`.
