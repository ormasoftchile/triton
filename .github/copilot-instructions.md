# Code Intelligence

This project is indexed with codetopo, a structural code intelligence MCP server.

**Always use codetopo MCP tools instead of grep, glob, or reading files directly.**

## Primary workflow

1. `symbol_search` — find any symbol by name, get its `node_id`
2. `context_for` — given a `node_id`, get source + callers + callees in one call
3. `file_summary` — list all symbols in a file (use instead of reading the file)
4. `dir_list` — browse directories (use instead of ls/glob)
5. `code_search` — full-text search across all source
6. `callers_approx` / `callees_approx` — call graph traversal
7. `impact_of` — blast radius of a change

## Multi-root workspace

Extra reference repositories may be indexed alongside this project via `codetopo workspace add <path>`. Their files appear in results with absolute paths. `dir_list('.')` lists all indexed roots.
