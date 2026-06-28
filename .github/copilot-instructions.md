# Code Intelligence

This project is indexed with codetopo, a structural code intelligence MCP server.

**Always use codetopo MCP tools instead of grep, glob, or reading files directly.**

## Primary workflow

1. `symbols_in_path(path, kind=[...], compact=true)` — list all symbols under a directory in one call
2. `context_by_name(name)` — get full context for a symbol by name (merges symbol_search + context_for)
3. `dir_tree(path, depth=1)` — browse directory structure with file sizes (use instead of ls/glob)
4. `file_overview(path)` — top-level symbols in a file without reading the body
5. `method_fields(symbol, file)` — list a method's field accesses and outgoing calls without reading source
6. `symbol_search(query, kind)` — find any symbol by name, get its `node_id`
7. `context_for(node_id)` — given a `node_id`, get source + callers + callees in one call
8. `code_search(query)` — full-text search across all source
9. `callers_approx` / `callees_approx` — call graph traversal
10. `impact_of` — blast radius of a change

## Token-efficient patterns

**Enumeration:** `symbols_in_path` is compact by default — pass `compact=true` explicitly for clarity. Returns only `node_id`, `name`, `kind`, `span`. Use the `node_id`s for all follow-up calls.

**Call graph without source:** `context_for(node_id, include_source=false)` returns callers/callees only (~90% fewer tokens). Follow up with `source_at(file, start_line, end_line)` for specific lines.

**Constructor internals:** `method_fields(symbol)` lists `this.X` field accesses and outgoing calls for a constructor or method — faster than reading source to understand data model.

**Targeted source reads:** prefer `source_at(file, start_line, end_line)` over reading whole files.

**Avoid re-resolving:** `node_id`s are stable session handles. Never re-run `symbol_search` for a symbol you already have a `node_id` for.

## Symbol kinds

codetopo indexes these kinds: `function`, `class`, `method`, `interface`, `enum`, `type`, `type_alias`, `macro`, `field`, `variable`, `namespace`, `constructor_fn`.

**`type_alias`** — TypeScript `type X = ...` declarations. Use `symbols_in_path(kind=["type_alias"])` to find all type aliases. Note: `type` and `type_alias` are separate kinds — query both when needed.

**`constructor_fn`** — pre-ES6 JavaScript factory pattern: `let Foo = function() { this.x = ...; }`. Use `symbols_in_path(kind=["constructor_fn"], compact=true)` to find all factory classes in a JS codebase. Use `method_fields` to inspect their `this.X` surface.

## Multi-root workspace

Extra reference repositories may be indexed alongside this project via `codetopo workspace add <path>`. Their files appear in results with absolute paths. `dir_tree('.')` lists all indexed roots.
