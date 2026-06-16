# Session: Multi-Line Node Labels Shipped (2026-06-16T00:13:01Z)

**Agent:** Barbara  
**Outcome:** COMPLETE

Implemented multi-line node labels in 5 grammars via `splitLabelLines()` utility (flow, tree tidy + radial, state, C4). Handles `<br>` / `<br/>` / `<br />` + `\n`. Nodes sized to fit N lines. Determinism: additive except intentional C4 gallery improvement. 2687 tests. Dogfood figures now display real multi-line labels. Committed 7631f39.
