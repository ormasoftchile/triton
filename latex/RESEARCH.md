# Triton → LaTeX Integration — Research & Recommendation (Phase 1)

> **Status:** RESEARCH ONLY. No `.sty`, no build glue, no design-doc section is written
> in this phase. This document is the integration's home (it seeds the future `latex/`
> folder) and exists to let the user pick an approach before anything is built.
>
> **Author:** David (Research Lead) · **Requested by:** ormasoftchile · **Date:** 2026-06-24

---

## 0. TL;DR

- **The gap is real and unavoidable.** Triton emits **SVG**. `\includegraphics` (pdfLaTeX,
  XeLaTeX, LuaLaTeX) accepts **PDF / PNG / JPG** — **never SVG**. Every integration path
  is, at bottom, a decision about *how Triton output becomes a PDF or PNG that LaTeX can
  `\includegraphics`.*
- **Triton already solves half of this internally.** The design doc's own figures are
  produced by `pnpm figures` → `design/figures/render.mjs` calls `render()` then
  `@resvg/resvg-js` to write **PNG**, and `\ourfig` wraps `\includegraphics{figures/<name>.png}`.
  That is *precisely* the "precompile + `\includegraphics`" model (approach A), applied to
  the spec itself. We should generalize what already works, not invent something new.
- **There is no Triton CLI today.** `package.json` has **no `bin`**, no `main`/`exports`.
  The only entry points are the library API (`render`/`renderSync`) and dev scripts
  (`build`, `test`, `preview`, `figures`). **Any LaTeX integration needs a CLI** — a
  `triton render in.triton -o out.{svg,pdf,png}` command. This is the keystone enabler.
- **Recommended primary approach:** **(A) Precompile + `\includegraphics`**, driven by a
  new `triton` CLI, with a thin `triton.sty` providing a `\triton{name}` macro. Default
  asset format **PNG (via the resvg path Triton already ships)** for guaranteed ubiquity,
  with **vector PDF as an opt-in** for quality. Longer term, give Triton a **native
  Scene→PDF backend** so vector PDF needs *zero* external binaries (the `Scene` model is
  small enough to make this tractable).

---

## 1. The Core Format Gap

### 1.1 What Triton actually emits

- `renderSync(input, theme?) → Result<string>` (and async `render()`), in
  `src/frontend/index.ts`, returns an **SVG string** from `renderSVG(scene)`
  (`src/render/svg.ts`).
- The SVG uses: `<rect>`, `<circle>`, `<text>` (with `font-family`, `font-size`,
  `text-anchor`, `font-weight`), `<path>` (with `stroke-dasharray`, `marker-start/end`),
  `<defs>` (raw SVG: gradients, markers), `<g>` groups, and — for animated kinds — SMIL
  `<animate>` / `<animateMotion>`. The underlying `Scene` is a tiny typed union of
  **five element types** (rect / circle / text / path / group) plus `defs[]`. This
  simplicity matters for the PDF-backend option in §1.2.
- Triton already rasterizes to **PNG** via `@resvg/resvg-js` (a **devDependency** today),
  e.g. `new Resvg(svg, { fitTo: { mode: 'width', value: 1500 } }).render().asPng()`.

### 1.2 What LaTeX's `\includegraphics` accepts

| Engine | Native raster | Native vector | SVG? |
|---|---|---|---|
| **pdfLaTeX** | PNG, JPG | **PDF** | ❌ (needs conversion) |
| **XeLaTeX** | PNG, JPG | PDF (+ EPS via driver) | ❌ |
| **LuaLaTeX** | PNG, JPG | PDF (+ EPS via driver) | ❌ |

No mainstream engine ingests SVG directly. The `svg` LaTeX package *appears* to, but it
actually shells out to **Inkscape** at compile time to convert `.svg → .pdf` first
(see approach C). So the question is always: **PDF or PNG, and produced how?**

### 1.3 Realistic paths to a LaTeX-includable asset

#### Vector PDF (best quality, scalable, the TikZ-replacement target)

| Path | Fidelity | Dependencies | OS support | Speed | CI / Overleaf |
|---|---|---|---|---|---|
| **`rsvg-convert` (librsvg)** | High; solid text/path/gradient support | C library (`brew install librsvg`, `apt install librsvg2-bin`) | macOS / Linux good; Windows via MSYS2/choco (clunkier) | **Fast** (ms) | Easy in CI; **not on Overleaf by default** |
| **`inkscape --export-type=pdf`** | Highest; can convert text→paths (no font worries) | Inkscape (large GUI app) | All three OSes | **Slow** (cold start ~1–3 s/file) | Heavy in CI; **this is what Overleaf's `svg` pkg uses**, but flaky |
| **`cairosvg` (Python)** | Good; weaker on some filters/fonts | `pip install cairosvg` (+ cairo) | All three | Fast | Easy in CI; not on Overleaf |
| **JS in-process (`svg2pdf.js`+jsPDF, `svg-to-pdfkit`)** | **Partial** — text/font and filter coverage incomplete; risky for our `<defs>`/markers | **None beyond Node** (already required) | All three (Node) | Fast | Easy; runs wherever Triton runs |
| **Native Triton PDF backend** (`pdfRenderer` next to `svgRenderer`) | High & controllable — we own the mapping; `Scene` is only 5 element types | **None** (pure TS, optional font embedding) | All three (Node) | Fast | **Best** — zero external binary; one tool does everything |

> **Font caveat (applies to every converter except Inkscape's text→path mode and a
> font-embedding PDF backend):** Triton SVG references fonts by *name* (e.g. a sans family).
> resvg, rsvg-convert, and cairosvg all resolve fonts against what's installed on the
> machine, so output can drift between dev / CI / Overleaf if the font is missing. The two
> robust answers are (a) convert text to outlines (Inkscape, or a backend that does so), or
> (b) embed/standardize on a known font (PDF base-14 Helvetica, or a bundled TTF).

#### PNG (raster, via resvg — Triton already has it)

- **Simplest, zero new dependencies** — `@resvg/resvg-js` is already in the tree and is the
  exact path `design/figures/render.mjs` uses today.
- **Not scalable** — fixed pixels; scaling up in LaTeX blurs. Mitigate with DPI: render at
  ~**2×–3× the print size**, i.e. `fitTo` width 1500–3000 px or a 300 dpi target. At 300 dpi
  most diagrams are indistinguishable from vector in print and on screen at 100%.
- **Animations are lost** (static first frame) — irrelevant for paper/PDF output.
- **Verdict:** good enough for a v1 that must "just work everywhere," *especially Overleaf*,
  because the asset is a committed PNG with no toolchain on the LaTeX side.

---

## 2. Authoring / Integration Models

### (A) Precompile + `\includegraphics`  ★ recommended primary

A build step renders each Triton source (`*.triton` / `*.mmd`) → `figures/<name>.{pdf,png}`,
and the `.tex` includes it through a wrapper macro `\triton{name}` ≈
`\includegraphics{figures/<name>.pdf}`.

- **Pros:** No `--shell-escape`. Portable. **Overleaf-friendly** when assets are committed
  (Overleaf just sees a PDF/PNG). This is the model Triton's *own* design doc uses
  (`pnpm figures` + `\ourfig`) — a proven precedent in this very repo.
- **Cons:** Two-step workflow (regenerate assets when a diagram changes). Mitigated by a
  `make figures` / npm-script step and (later) optional auto-rebuild.

### (B) Inline shell-escape package (minted-style `triton.sty`)

A `\begin{triton}…\end{triton}` environment / `\tritonfile{...}` that writes the body to a
temp file, shells out to the Triton CLI at compile time (requires `--shell-escape` + Node +
Triton installed), and `\includegraphics` the result — with **hash-based caching** like
`minted` / `tikzexternalize` so unchanged diagrams aren't re-rendered.

- **Pros:** Most ergonomic — diagram source lives *inline* in the `.tex`, one source of truth,
  exactly the TikZ ergonomics the user wants to keep.
- **Cons:** Least portable. Needs `--shell-escape` (disabled by default, security-sensitive)
  **and Node + Triton on every build host**. **Does not work on Overleaf** (no Node, no
  arbitrary shell-escape). Best offered as an *optional* power-user mode layered on top of (A).

### (C) The existing `svg` package (`\includesvg`)

Commit Triton's `.svg` and `\includesvg{name}`; the `svg` package shells out to **Inkscape**
to make a PDF at compile time.

- **Pros:** Reuses a mature, well-documented package; no Triton-side conversion code.
- **Cons:** **Inkscape required on every machine** (heavy, slow); still needs `--shell-escape`;
  Overleaf support exists but is **flaky and version-sensitive**. We'd be shipping SVG and
  outsourcing the *same* conversion problem to a giant GUI app per build. Net: not our primary,
  but a fine "I already have Inkscape" fallback we can document.

### CLI status — there is none (blocking for all of the above)

`package.json` has **no `bin`**. None of (A)/(B)/(C) can call "Triton" from a shell or a
Makefile today. **An integration requires adding a CLI**, e.g.:

```
triton render diagram.triton -o diagram.pdf      # or .png / .svg
triton render diagram.triton --format png --scale 3
```

Implication: add a `bin` to the `triton` package (a ~40-line wrapper over `renderSync` + the
resvg PNG path, plus whatever SVG→PDF path we choose). This is small, but it is a real
prerequisite and should be decided explicitly (see Open Question #4).

---

## 3. Ubiquity Matrix

Legend: ✅ works out-of-the-box · ⚙️ works but needs a dependency installed · ❌ not viable.
"Engine" rarely matters here — the asset is a PDF/PNG by the time `\includegraphics` runs —
so the real axis is **how the asset is produced** × **where the build happens**.

| Approach (asset production) | pdfLaTeX | XeLaTeX | LuaLaTeX | macOS | Linux | Windows | **Overleaf** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **A · precompiled PNG (resvg)**, committed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **✅** |
| **A · precompiled PDF via rsvg-convert**, committed | ✅ | ✅ | ✅ | ⚙️ librsvg | ⚙️ librsvg | ⚙️ librsvg | **✅** (asset committed) |
| **A · precompiled PDF via native Triton backend**, committed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **✅** |
| **B · shell-escape CLI (Node+Triton)** | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | **❌** (no Node, no shell-escape) |
| **C · `svg` pkg / Inkscape** | ⚙️ | ⚙️ | ⚙️ | ⚙️ Inkscape | ⚙️ Inkscape | ⚙️ Inkscape | ⚙️ (flaky) |

**Reading of the matrix (this drives the recommendation):** the only rows that are ✅
*everywhere including Overleaf* are the **precompiled-and-committed** ones — and among those,
**PNG-via-resvg** and a **native PDF backend** need *no dependency at all on the LaTeX side*.
Ubiquity therefore points squarely at **approach A with a committed asset**, format PNG now,
vector PDF as the quality upgrade once a no-external-binary path (native backend) exists.

---

## 4. Recommendation

### Primary approach

**(A) Precompile + `\includegraphics`, via a new `triton` CLI, with a thin `triton.sty`
exposing `\triton{name}`.** Default asset = **PNG** (the resvg path already shipping in
`design/figures/render.mjs`), committed to the repo so it works literally everywhere
including Overleaf. Offer **vector PDF as opt-in** (`triton render … -o x.pdf`).

### The SVG→PDF decision (called out explicitly, as required)

- **Now (v1):** **PNG via resvg.** Zero new dependencies, already proven in-repo, ✅ on
  Overleaf. Render at ~2×–3× / 300 dpi to keep print quality high.
- **Opt-in quality (v1.x):** **vector PDF via `rsvg-convert`** when present (fast, high
  fidelity, easy in CI). Document Inkscape (approach C) as the alternative for users who
  already have it. *Do not* build on the in-process JS PDF libs (`svg2pdf.js`) as the primary
  — their fidelity on our `<defs>`/markers/fonts is too uncertain.
- **Strategic (Phase 3):** **add a native Scene→PDF backend to Triton** — a `pdfRenderer`
  registered next to `svgRenderer`, emitting vector PDF directly from the 5-element `Scene`.
  This gives true vector PDF with **no external binary and no font drift** (embed a bundled
  font or map to PDF base-14). Because the `Scene` model is tiny and we already own it, this
  is the cleanest long-term answer and the right place to invest if vector quality everywhere
  becomes a hard requirement. **Recommendation: yes, eventually — but not in Phase 1.**

**Net SVG→PDF call:** start with **PNG (resvg)** for ubiquity, add **rsvg-convert PDF** as an
opt-in, and plan a **native Triton PDF backend** as the endgame. A Triton CLI is required
regardless and should be added first.

### Should Triton gain a PDF backend / CLI?

- **CLI: yes, now** — it is a hard prerequisite for *any* of A/B/C. Small, low-risk.
- **PDF backend: yes, later (Phase 3)** — high value (vector + zero deps) but real work;
  defer until the CLI + PNG path are shipped and the user confirms vector-everywhere matters.

### Phased rollout

1. **Phase 1 — Precompile + PNG (works everywhere, incl. Overleaf).** Add `triton` CLI
   (`render … -o out.{svg,png}`); `triton.sty` with `\triton{name}` ≈ `\includegraphics`;
   a `figures`-style build step; commit PNG assets. *Mirror the existing `pnpm figures` /
   `\ourfig` pattern — it already works.*
2. **Phase 2 — Vector PDF opt-in + optional inline mode.** CLI `-o out.pdf` via
   `rsvg-convert` (document Inkscape alt). Add an *optional* shell-escape mode to `triton.sty`
   (auto-rebuild stale assets when `--shell-escape` + Node available, minted-style hash cache).
   **Write the new `design/sections/` "LaTeX integration" section** here (see §6).
3. **Phase 3 — Native Triton PDF backend.** `pdfRenderer` for dependency-free vector PDF;
   CLI `-o out.pdf` becomes self-contained; revisit font embedding.

### Recommended `latex/` folder structure

```
latex/
  RESEARCH.md          ← this document (Phase 1 deliverable)
  README.md            ← how to use the integration (written in Phase 1/2)
  triton.sty           ← the package: \triton{name}, \tritonfile{path}, opt-in inline env (Phase 1+)
  bin/                 ← thin glue if the CLI lives outside package.json `bin`
                          (e.g. triton-figures: batch-render a dir of *.triton → figures/)
  examples/            ← a tiny self-contained LaTeX project that compiles with the package
    example.tex
    diagrams/          ← *.triton sources
    figures/           ← committed rendered assets (.png now, .pdf later)
  Makefile             ← `make figures` (render) + `make pdf` (compile), mirroring design/Makefile
```

> The CLI itself is best added to the **main `triton` package** (`"bin": { "triton": "..." }`)
> rather than buried in `latex/bin/`, so `triton render` works repo-wide and for external
> users. `latex/bin/` is only for LaTeX-specific batch glue. (See Open Question #4.)

---

## 5. Open Questions for the User (decide before Phase 2 build)

1. **Vector PDF or PNG as the v1 default?** PNG = zero deps, ✅ Overleaf, but raster.
   Vector PDF = scalable/TikZ-grade, but needs `rsvg-convert`/Inkscape (or the future native
   backend). Recommendation: **PNG now, PDF opt-in.**
2. **Is Overleaf a hard requirement?** If yes, it forces **precompiled, committed assets**
   (approach A) and rules out the inline shell-escape mode (B) as the *primary* path. If
   Overleaf is "nice to have," inline mode becomes more attractive.
3. **Inline (shell-escape, minted-style) authoring, or precompile-only?** Inline gives the
   best TikZ-like ergonomics (diagram source in the `.tex`) but breaks portability/Overleaf.
   Acceptable as an *optional* mode on top of A, or skip it?
4. **OK to add a `bin` CLI to the main `triton` package now?** (vs. a separate `@triton/cli`
   package, vs. glue scripts only in `latex/`.) A CLI is required either way; this is about
   *where* it lives.
5. **Invest in a native Triton PDF backend (Phase 3), or settle on an external converter?**
   Native = vector + zero external binaries + no font drift, but real implementation work;
   external (`rsvg-convert`/Inkscape) = faster to ship, adds a per-machine dependency.

---

## 6. Note for Phase 2 — design-doc update (per the user's requirement)

The user requires the LaTeX design doc to stay current. In **Phase 2** (after an approach is
chosen and built), `design/sections/` gets a **new "LaTeX integration" section** describing
the chosen path, wired into `design/triton.tex`'s `\input` list (it currently ends at
`08-status`). The Phase-3 native PDF backend, if pursued, also updates `08-status.tex`'s
"Possible future work" → "What is built" (it already lists *"a vector PDF backend"* as an
honest future candidate — this work would realize it). **No design-doc prose is written in
Phase 1.**
