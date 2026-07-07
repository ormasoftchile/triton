## DS — Node Graph

Generic directed or undirected node-link graph; nodes are rounded boxes; edges are straight connectors; directed edges carry arrowheads.

**Header keyword(s):** `nodegraph` · `dsgraph`

---

### Graph-level keywords

| Line | Purpose |
|------|---------|
| `directed` | Enable directed mode (arrowheads on edges) |
| `undirected` | Disable directed mode (default) |
| `title <text>` | Diagram title (bold, above graph) |

---

### Node syntax

| Line | Purpose |
|------|---------|
| `node <id>` | Declare a node with its id as label |
| `node <id> : <label>` | Declare a node with explicit label |

Nodes are also auto-declared on first appearance in an edge line.

---

### Edge syntax

| Operator | Kind |
|----------|------|
| `<from> -> <to>` | Directed edge |
| `<from> -- <to>` | Undirected edge |
| `<from> <-> <to>` | Bidirectional edge |
| `<from> -> <to> : <label>` | Edge with label |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `<node-id>` | Node box |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
nodegraph
  directed
  title Dependency graph
  node A : Parser
  A -> B : calls
  B -- C
```
