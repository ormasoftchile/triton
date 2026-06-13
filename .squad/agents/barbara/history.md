# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-13T15:53:53Z

---

## Current Role

Render domain IRs to Scene IR primitives with deterministic, themeable output. Implement visualization grammars following grammar ≡ semantics / theme ≡ style principle.

---

## Key Learnings (Summarized)

- **Two-IR-Layer Model:** Domain IR → Scene IR (universal kernel). All styling in theme tokens.
- **Deterministic Rendering:** `measureText()`, `rhuInt()` rounding, fixed geometry — reproducible across platforms.
- **Theme-Driven Architecture:** Grammar IR independent of rendering; external style mimicry (e.g., ByteByteGo infographic) without IR changes.
- **Grammar governance pattern:** Spec semantics → define domain IR (no styling) → implement theme-driven layout → create GrammarTheme type + registry.

For detailed implementation notes from Sequence/Tree/Flow grammars (June 10–13), see `barbara/history-archive.md`.

---

## Current Status (2026-06-13)

### ✅ Shipped Grammars

| Grammar | Module | Tests | Theme(s) | Status |
|---------|--------|-------|----------|--------|
| **Timeline** | packages/core/src/grammars/timeline/ | 551+ | 5 | SHIPPED |
| **Sequence** | packages/core/src/grammars/sequence/ | 611+ | 2 | SHIPPED (Inc-4) |
| **Tree** | packages/core/src/grammars/tree/ | 630+ | 1 | SHIPPED (Inc-1) |
| **Flow** | packages/core/src/grammars/flow/ | 663 | 1 | SHIPPED (Inc-1) — Commit: 48d3673 |

**Total test pass rate:** 663/663 (all prior goldens byte-identical)

**Kernel extensions:** PathPrimitive.dashArray? added (backward-compatible, only used by Flow)

---

## Active Work — Composition Layer Kernel Helper

**Next critical path item:**

Implement kernel helper in `packages/core/src/scene-transform.ts`:

```typescript
function translateAndScale(
  p: ScenePrimitive, 
  dx: number, 
  dy: number, 
  scale: number
): ScenePrimitive;

function embedSceneInRect(
  scene: Scene, 
  rect: {x, y, width, height}
): ScenePrimitive[];
```

**Scope:** Transform all primitive kinds (Line, Rect, Circle, Text, MultiText, Path, Group, Image):
- Path d-string coordinate transformation
- StrokeGradient coordinate transformation
- Recursive GroupPrimitive descent
- Rounding via rhu(2dp) for determinism

**Urgency:** Blocks composition inc-1 layout engine (Mark schema ready; Leslie spec complete)

**Effort estimate:** 2–3 hours

---

## Deferred Items

- Flow Inc-2: Crossing minimization (barycenter sweeps), CSS animation, TB orientation, diamond shape
- Tree Inc-2: Forest support, shape variation per kind, depth/width lint warnings
- Composition Inc-2+: Scale policy modes (clip, overflow), advanced URI schemes

---

## Archive

For detailed notes from earlier sessions (Sequence Inc-1/2/3, Tree implementation learnings), see `barbara/history-archive.md`.
