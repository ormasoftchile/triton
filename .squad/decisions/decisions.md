# Team Decisions Log

## 2026-07-13

### Brian — Hashmap String Bucket Labels

- Date: 2026-07-13T12:14:32.683-07:00
- Area: `src/diagrams/triton/ds/hashmap/hashmap.ts`

**Decision:** Support labeled hashmap buckets by normalizing a `bucketLabels` array in the IR, accepting both numeric and string `HashChain.index` values, and resolving chain-to-slot placement through a map instead of array indexing.

**Compatibility rule:** Anchor names stay positional (`b0`, `b1`, `b0e0`, ...) even when rendered bucket labels are strings. This preserves existing downstream references while allowing the visible bucket column to show arbitrary labels.

**Follow-through:** Docs/examples/tests/editor snippets were updated together so the public syntax, rendered example, and regression coverage all match the new labeled-bucket behavior.
