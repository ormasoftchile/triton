# Session Log — Card-Node Syntax Decision

**Timestamp:** 2026-07-12T23:54:08Z  
**Decision:** Syntax Evaluation — `@key:value` Node Annotations vs `@{ k: v }` Object Form

**Recommendation:** Adopt `@key:value` as Triton-native canonical form; `@{...}` as Mermaid-compat alias.

**Key insight:** `@` is already Triton's annotation sigil (edges). Extending to nodes unifies dialect. `@icon:azure:app-service` parses cleanly (key before first `:`, greedy value after).

**Grammar impact:** Simple repeatable NodeAnnotation rule; no JSON-subset parser needed. Both syntaxes lower to same IR.

**Example:** `A ["App Service"] @shape:card @icon:azure:app-service`

**Filed in:** `.squad/decisions.md` (merged from inbox)
