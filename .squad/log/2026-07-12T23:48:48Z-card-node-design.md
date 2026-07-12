# Card Node Design Session

**Date:** 2026-07-12T23:48:48Z  
**Scope:** Leslie card-node design decision + Scribe ingestion  
**Artifact:** `.squad/decisions.md` (merged leslie-card-node.md)

## Summary

Leslie completed design for icon-left/text-right card node as a flowchart `@{ shape: "card" }` variant. Two-region horizontal layout (fixed icon left, wrapped text right). Reuses poster cell composition model. First cut ~6h, full version +10–16h.

**Recommendation:** Approved as P7 design (depends on P2 icon slot). Syntax uses `\n` to split title from body text in label.

**Phasing:** P7 (title-only MVP first), then P7b (full multi-line + variable width).

## Files Modified

- `.squad/decisions.md` — appended leslie-card-node.md (235.6 KB → ~251.5 KB)
- `.squad/decisions/inbox/leslie-card-node.md` — deleted

## Notes

No implementation in this session (design recommendation only).
