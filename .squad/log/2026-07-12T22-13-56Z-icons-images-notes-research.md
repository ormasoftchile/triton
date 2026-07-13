# Session Log: Icons/Images/Notes Research — 2026-07-12T22:13:56Z

**Type:** Research/Analysis (NO code)  
**Agents:** David (Research Lead), Leslie (Spec Architect)  
**Status:** COMPLETE — Research & Recommendation delivered

---

## Investigation Summary

Conducted comprehensive evaluation of Mermaid's icon, image, and note/comment mechanisms to determine Triton compatibility under offline static PNG rendering constraints (rsvg-convert, no webfonts, no remote URLs, no browser/JS runtime).

---

## Key Constraint

Triton's rendering pipeline: Mermaid → SVG (deterministic) → PNG (rsvg-convert, offline)

**This rules out:**
- Font Awesome webfont glyphs + `<foreignObject>` (rsvg-convert drops `<foreignObject>`)
- Remote image URLs (breaks determinism)
- Browser JS runtime or Font rendering dependencies

**Safe approaches:**
- Inline SVG `<path>` primitives (icons + images)
- Data: URIs for embedded images
- Local file registry with upfront validation

---

## Research Findings

### Icons

1. **Mermaid Font Awesome integration** (`fa:fa-xxx` / `fab:fa-xxx`):
   - Path A: Iconify pack registration → inline SVG paths (offline-safe if pre-bundled)
   - Path B: Class fallback with `<foreignObject>` (incompatible — rsvg-convert drops it)

2. **Mindmap `::icon()` syntax**:
   - Font-dependent CSS class system
   - Incompatible with static PNG

3. **Triton architecture glyphs** (current):
   - 5 hardcoded inline-vector glyphs (server, database, cloud, internet, disk)
   - Deterministic, PNG-safe
   - Proof of concept for icon registry approach

### Images

1. **Mermaid approaches**:
   - SVG `<image>` tag: CORS or data: URI required
   - `<foreignObject>` for raster: **Not supported by rsvg-convert**

2. **Triton (current)**:
   - No `SceneImage` type in Scene discriminated union
   - No image rendering in SVG backend
   - Prior design documented in `.squad/skills/image-primitive/SKILL.md`

### Notes & Comments

1. **Comment stripping (`%%`)**:
   - Central preprocessing: Complete and correct
   - No gaps

2. **Rendered notes**:
   - Sequence diagram notes: Full theme-aware implementation
   - Other diagram types: Partial support or missing
   - Overlay system extensible for all diagram types

---

## Recommendation: Icons/Images/Notes Phasing

### Phase 1 (8–12 hours) — RECOMMENDED FOR IMMEDIATE START
- **Icon registry module:** 50–100 core inline-SVG icons, 24×24 viewBox
- **Integration:** Architecture diagram, mindmap
- **Attached notes:** Extend overlay system to flowchart and other diagram types
- **Safe:** Deterministic, offline, PNG-compatible

### Phase 2 (6–10 hours) — FOLLOW-UP
- `fa:fa-xxx` syntax mapping (from registry)
- Free-floating notes (corner-based positioning)
- Flowchart node icon support

### Phase 3 (8–12 hours) — EXTENSION
- User-supplied SVG icons (with validation)
- Multi-line note text rendering

### Deferred (on demand)
- Image primitive (`SceneImage`, data/local URIs)
- Rich Markdown note rendering
- Coordinate-based positioning

---

## Status

**Research complete.** Recommendation delivered as "Research & Recommendation — Icons/Images/Notes (not yet approved to build)" in `.squad/decisions.md`.

**Not yet approved for implementation.** Team review required before Phase 1 starts.

---

**No code changes in this session.**
