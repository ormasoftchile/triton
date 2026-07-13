# Session Log: Static Icon-Library Import Design

**Date:** 2026-07-12T22:58:00Z  
**Type:** Research & Design (No code)  
**Participants:** David (Research Lead), Leslie (Spec Architect)

---

## Overview

**Topic:** Static icon-library import format for Triton diagrams. Focus: Azure architecture icons (705+, multicolor, Microsoft-licensed BYOP only).

**Key decision:** Adopt IconifyJSON (`.triton-icons.json` files under `.triton/icons/`, mirroring theme structure) as Triton's universal icon pack format.

---

## Design Summary

### Format: IconifyJSON

Single-file packs conforming to `@iconify/types@2.0.0` schema:
- `prefix` (authoritative namespace)
- `icons` (name → {body, width, height})
- `aliases` (shallow name aliasing)
- Per-icon classification: monochrome (currentColor, palette-tintable) or brand (hardcoded fills, verbatim render)

### Discovery & Purity

- **Location:** `.triton/icons/` (walk-up discovery, mirror of `.triton/themes/`)
- **Host resolves:** Discovers and loads packs; clasifies mono/brand at load time; passes `ResolvedIconRegistry` into core
- **Core pure:** Receives registry as data parameter (`icons?: ResolvedIconRegistry` on `compileSync`/`renderSync`). Never touches filesystem.

### Azure BYOP Model

- **Cannot ship:** Microsoft licensing prohibits redistribution. Triton NEVER bundles Azure SVGs.
- **User workflow:** Download official icons from https://learn.microsoft.com/en-us/azure/architecture/icons/, convert via `@iconify/tools importDirectory`, place in `.triton/icons/`, use `icon: "azure:service-name"` in diagrams.
- **Bundled default:** Lucide (MIT, 1400+ icons, monochrome, palette-friendly).

### Rendering

- **Monochrome icons:** Wrap in `<svg style="color: ${paletteColor}">`. `currentColor` fills inherit palette token.
- **Brand icons (Azure, AWS, logos):** Wrap in `<svg>` with no override. Hardcoded fills render as Microsoft designed.
- **Gradient-ID namespacing:** Prevent collision when multiple brand icons in same SVG (namespace per icon instance).

### Determinism & Cache

- Compile-time resolution from static JSON files.
- Same input + same packs → identical output.
- LaTeX cache key must fold in icon pack content-hash (SHA-256) to eliminate stale-cache issues.

### Syntax

- `icon: "prefix:name"` in diagram nodes (e.g., `icon: "azure:app-service"`)
- Unprefixed `icon: "name"` → bundled default set
- Fallback to geometric primitives when pack unavailable

---

## Phasing: P0–P6 (~22–30 hours)

| Phase | Work | Hours |
|-------|------|-------|
| P0 | Format spec + JSON Schema + types | 2–3 |
| P1 | Discovery module (mirror themes) | 3–4 |
| P2 | Core API + SVG body emit | 3–4 |
| P3 | CLI integration + cache-key | 3–4 |
| P4 | VS Code extension | 4–5 |
| P5 | Conversion CLI tool + docs | 3–4 |
| P6 | Grammar integration (5+ diagram types) | 4–6 |
| **Total** | | **22–30** |

**Critical path:** P0 → P1 → P2 → P6  
**Parallelizable:** P3/P4/P5 (after P1 + P2 land)

---

## Status

**FINAL DESIGN RECOMMENDATION** — Pending approval to begin Phase P0.

**NOT approved to build.** Awaiting leadership sign-off before implementation starts.

**Deliverables:**
- Merged into `.squad/decisions.md` (labeled "Research & Design — Icon Library Import Format")
- Orchestration logs: `2026-07-12T22:58:00Z-david.md`, `2026-07-12T22:58:00Z-leslie.md`
