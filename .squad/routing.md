# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Scope, spec structure, design decisions | Leslie | What's in/out of the spec, how the design is organized, trade-offs |
| Research & prior art | David | Survey existing timeline/IR/temporal formats, build `references.bib`, real-data crawls |
| IR schema, grammar, type system | Mark | Define the IR's entities, fields, invariants, validity rules |
| Layout algorithms, placement geometry, spatial contracts | Edsger | Specify layout algorithms, collision resolution, aspect-ratio bounds, degenerate cases |
| Rendering semantics & IR→render mapping | Barbara (retired) | — |
| Layout algorithm implementation (TypeScript) | Brian | `src/graph/layered.ts`, `src/diagrams/*/layout.ts`, `src/routing/router.ts` |
| Ingestion design (data + prompt → IR) | Bjarne | Transformation pipeline design, prompt-driven IR construction, input contracts |
| Design review / reviewer gate | Leslie | Review IR/design/research artifacts; enforce revision lockout on rejection |
| LaTeX design assembly & bibliography | Scribe / David | Scribe assembles the LaTeX doc; David curates `references.bib` |
| Session logging | Scribe | Automatic — never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Leslie (Lead) |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Leslie** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for a one-line factual question.
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** While Mark designs the IR, David can survey prior art and Barbara can draft rendering scenarios in parallel.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. Leslie handles all `squad` (base label) triage.
8. **No implementation.** This project is spec/design/research only. Route work to artifacts (LaTeX sections, IR schema, bibliography), not code.

## Layer Map

The design separates three concerns — route detail work accordingly:

- **Layout algorithms** (IR → geometry) → Edsger
- **Ingestion** (data + prompt → IR) → Bjarne
- **The IR** (schema, grammar, invariants) → Mark
- **Rendering semantics** (IR → render) → Barbara
- **Cross-cutting** (scope, coherence, review) → Leslie; **evidence/prior art** → David
