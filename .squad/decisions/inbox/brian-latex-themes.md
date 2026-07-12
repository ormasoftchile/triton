# Decision: Phase 4 — triton-latex external themes — content-hash limitation

**Date:** 2026-07-12  
**Author:** Brian (brian-16)  
**Status:** Accepted (Tier-1 implementation complete; Tier-2 deferral documented)

## Context

Phase 4 ships `--theme-file` / `--themes-dir` CLI flags and `\tritonthemefile` / `\tritonthemesdir` .sty macros. The cache key (Phase-0 echo line) now includes the theme-file path and themes-dir path.

## Decision

**The cache key includes the theme-file PATH, not its content hash.**

Editing a `.triton-theme.json` file in-place (without changing its path) leaves the cached PDF stale — the hash does not change, so the CLI is not re-invoked. This is a known Tier-1 limitation.

**Mitigation (documented in triton.sty comments and PR body):**  
Users must clear the cache manually after editing a theme file in-place:
```
rm -r <cachedir>    # e.g. rm -r \jobname.triton-cache
```
or:
```
latexmk -C
```

## Deferral

Content-aware hashing (computing an md5 of the theme file content and folding it into the cache key) is deferred to a Tier-2 release. It requires the CLI to print the content hash to stdout/a side channel that the .sty can read before computing `\pdf@filemdfivesum`. This is non-trivial with the current `\write18` model.

## Impact

Low. External theme files are committed in VCS. In practice, users version-bump the theme file (rename or change content + change path) when making intentional changes — the path-based cache key is then invalidated correctly. The in-place-edit case (editing a file without changing its path) is the edge case and is explicitly documented.
