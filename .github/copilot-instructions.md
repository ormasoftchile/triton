# Code Intelligence

This project is indexed with codetopo, a structural code intelligence MCP server.

**Always use codetopo MCP tools instead of grep, glob, or reading files directly.**

## Primary workflow

1. `symbols_in_path` — list all symbols under a directory in one call (replaces repeated dir+file queries)
2. `context_by_name` — get full context for a symbol by name (merges symbol_search + context_for)
3. `dir_tree` — browse directory structure with file sizes (use instead of ls/glob)
4. `file_overview` — top-level symbols in a file without reading the body
5. `symbol_search` — find any symbol by name, get its `node_id`
6. `context_for` — given a `node_id`, get source + callers + callees in one call
7. `code_search` — full-text search across all source
8. `callers_approx` / `callees_approx` — call graph traversal
9. `impact_of` — blast radius of a change

## Token-efficient patterns

**Enumeration (survey first):** `symbols_in_path` is compact by default — returns `node_id`, `name`, `kind`, `span` only. Use the returned `node_id`s for follow-up calls; they stay valid across the session.

**Call graph work:** use `context_for(node_id, include_source=false)` to get callers/callees without the source body (~90% fewer tokens). Then fetch source only for the specific lines you need with `source_at`.

**Targeted source reads:** prefer `source_at(file, start_line, end_line)` over reading whole files. A single function body is typically 20-80 lines; reading the whole file wastes tokens.

**Avoid re-reading:** `node_id`s returned by any tool are reusable handles. Never re-run `symbol_search` for a symbol you already have a `node_id` for.

## Symbol kinds

codetopo indexes these kinds: `function`, `class`, `method`, `interface`, `enum`, `type`, `macro`, `field`, `variable`, `namespace`, `constructor_fn`.

**`constructor_fn`** — pre-ES6 JavaScript factory pattern: `let Foo = function() { this.x = ...; }`. Use `symbols_in_path(kind=["constructor_fn"])` to find all factory classes in a JS codebase.

## Multi-root workspace

Extra reference repositories may be indexed alongside this project via `codetopo workspace add <path>`. Their files appear in results with absolute paths. `dir_tree('.')` lists all indexed roots.
