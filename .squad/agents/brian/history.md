# Brian — Layout Implementation Engineer

## Current Focus

External theming implementation (Phases 0–5) — feature shipped v0.1.15.
- **Recent work:** Phases 4–5 implementation + 3-round CI fix (theme-resolve.ts extraction)
- **PRs merged:** #61–#67 (all shipped in v0.1.15)
- **Test status:** 621/621 ✓

## Recent Spawns

### Spawn brian-12 (2026-07-12) — Phase 0 Cache-Key Fix
Phase 0 of external theming: triton.sty `%%triton-key:` cache line now includes theme path. Used `echo` (not `printf`) to prevent `%%` escape-sequence interpretation. See decisions.md for rationale.

### Spawn brian-13 (2026-07-12) — Phase 1 Validator
Phase 1: Core `validateThemeInput()` with strict unknown-key rejection, new `THEME_VALIDATION_ERROR` code, CSS injection guard, hand-maintained schema.json (draft-07). PR #62.

### Spawn brian-14 (2026-07-12) — Phase 2 Discovery  
Phase 2: Shared `discoverThemes`/`loadThemeFile`/`findTritonThemesDir` utility. Purity seam via relative-path imports. Fixture files committed; tests use `test/.tmp-discover/` (not /tmp). PR #63.

### Spawn brian-15 (2026-07-12) — Phase 3 VS Code UI
Phase 3: VS Code extension `.triton/themes/` discovery + dropdown + live reload. `ThemeRegistry` pattern with per-workspace-folder watchers. Force external theme via full `ResolvedTheme` as `themeInput`. In-place dropdown refresh (no webview teardown). PR #64.

### Spawn brian-16 (2026-07-12) — Phase 4 LaTeX CLI
Phase 4: triton-latex `--theme-file` / `--themes-dir` CLI flags + auto-discovery. Cache key extended (path-based, not content-aware; Tier-2 deferral). New .sty macros `\tritonthemefile` / `\tritonthemesdir`. PR #65.
- **KNOWN LIMITATION:** Path-based cache-key; in-place theme file edits leave stale cache. Mitigation: `rm -r <cachedir>`.
- **Verification:** All 4 theme-resolution tests passing (621/621 total).

### Spawn brian-17 (2026-07-12) — Phase 5 Docs + CI Fix
Phase 5: External theming documentation. Template `.triton-theme.json` omits `$schema` (rejected by validator). Users get editor hints via VS Code `json.schemas` settings.
- **Root cause CI failure (Phase 4):** Test spawned `latex/dist/cli.cjs` (not built at test time); module entry ran on import; transitive pdfkit import failed.
- **Fix (PR #67):** Extracted `resolveCliTheme` to `latex/src/theme-resolve.ts` (node + core only). Test imports that; CLI imports that. No dist/ spawn, no pdfkit drag-in.
- **Verification:** `rm -rf latex/dist latex/node_modules && pnpm test` → 621/621 ✓

---

## Learnings

### CI Robustness (2026-07-12)

**Four patterns to AVOID in test imports:**

1. **Never spawn `dist/` files in CI tests.** CI runs `pnpm test` before `pnpm build`. Non-existent dist files cause test failures.
   - Fix: Extract and export testable functions; import from TS source instead of CLI module.

2. **Guard module entry points with `import.meta.url` check.** Top-level `main()` calls trigger when modules are imported.
   - Fix: `if (process.argv[1] === fileURLToPath(import.meta.url)) { main().catch(...) }`

3. **Avoid importing CLI modules from tests if they have non-root dependencies.** `pdfkit` (latex-only) breaks CI.
   - Fix: Move testable logic to a pure module (node + core only). CLI imports that; tests import that directly.

4. **Don't use `vi.spyOn(process, 'exit')`.** vitest intercepts globally; reports error even when spy + test logic are correct.
   - Fix: Use `.toThrow()` on error paths instead.

**Evidence:** PR #67 CI fix. 3 cascading failures → 1 extraction → all 4 tests restored (621/621 ✓).

### Earlier Learnings (prior to 2026-07-12)

- **VS Code icon color:** SVGs using `stroke="currentColor"` render BLACK on contributed toolbar icons (VS Code composites them as background images). Fix: provide color-baked variants (`-light.svg` / `-dark.svg`) + reference via `"icon": { "light": "...", "dark": "..." }` in `package.json`.
- **Example comments:** `%%` lines stripped before parse — they don't affect SVG output. Verify by checking which src/ files changed, not just .mmd files.
- **Label padding in examples:** Strict 13-char `label:+spaces` rule in poster/flowchart `%%` headers.
- **Example cleanup (2026-07-12):** All 84 .mmd files tested — 0 bad, 1 redundant (launch-readiness.mmd, identical to poster.mmd). Removed + 13 companions = 14 files.
- **Cross-link label dedup:** De-collision pass misses internal child diagram chrome (PageHeader bars). Fix layer: `LayoutResult.chromeRects` → added to `textOccupied` for layout. Zero-cost if unused.
- **Tree node borders:** Plain nodes now use `palette.primary` (blue) instead of outline stroke, matching nodegraph.
- **Arrowhead size uniformity:** SVG marker `markerUnits="userSpaceOnUse"` (fixed pixels, not stroke-width-scaled). Active edges now same arrowhead size as normal edges.

---

## Decisions Recorded

All 6 inbox decisions merged to `.squad/decisions.md` (2026-07-12):
- **brian-external-themes-docs:** `$schema` omitted from template (validator rejects); workaround via VS Code `json.schemas`.
- **brian-latex-cachekey:** Cache-key fix: `echo` vs `printf` escape behavior.
- **brian-latex-themes:** Path-based cache key (content-hash deferred to Tier-2).
- **brian-theme-discover:** Theme name derivation; purity seam at discover.ts; fixture files + test/.tmp-discover/.
- **brian-theme-validator:** Strict unknown-key, THEME_VALIDATION_ERROR code, CSS injection guard, hand-maintained schema.
- **brian-vscode-themes:** Force-external-theme via themeInput; ThemeRegistry pattern; in-place dropdown refresh.

See `.squad/decisions.md` for full context.

---

## Earlier Work Summary

**2026-07-10 (Phases 1–2):**
- Poster Phase 1: Per-cell highlight (array/matrix), caption slot, freeform notes (top/bottom/center positioning), edge highlight (tree/nodegraph).
- Arrowhead uniformity fix + Tree default node border fix (blue primary).
- Phase 2 primitives (intervals/hashring) prototyped, then dropped per Cristian's decision.

**2026-06-28 (Layout optimizer):**
- Multi-wall skip-edge routing (6 strategy candidates: A–F wall pairs). Generalized to all edges (direct + skip).
- Processed edges by span (longest first); skip-cross-column → direct-same-column ordering.

**Archived spawns (brian-1 through brian-11):** Moved to history-archive.md. Includes early poster primitives, example audits, v0.1.9–v0.1.10 releases, and icon dark-mode fixes.
