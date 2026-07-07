## Topology

Draws cost-weighted node graphs (NUMA, network fabric) with tier-coloured edges and an auto-generated cost legend.

**Header keyword(s):** `topology`

---

### Config keywords

| Keyword | Syntax                                                  | Purpose                                                   |
|---------|---------------------------------------------------------|-----------------------------------------------------------|
| `title` | `title <text>`                                          | Diagram title                                             |
| `costs` | `costs <unit>`                                          | Opens the cost-scale block; sets unit label (e.g. `ns`)   |
| `tier`  | `tier <name> <maxWeight> <color> [<dashArray>]`         | Cost tier with colour; optional dash pattern for edges     |

---

### Block keywords

| Keyword | Syntax                                | Purpose                                        |
|---------|---------------------------------------|------------------------------------------------|
| `group` | `group <id> : <label>`               | Groups nodes into a named panel                |
| `node`  | `node <id> : <label>`                | Node with label                                |
| `node`  | `node <id> : <label> : <sub>`        | Node with label and sub-label                  |

---

### Edge types

| Syntax                         | Meaning                                                 |
|--------------------------------|---------------------------------------------------------|
| `<from> -- <to>`               | Undirected edge (no cost; uses default colour)          |
| `<from> -- <to> : <cost>`      | Undirected edge with numeric cost; coloured by tier     |

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
topology
  title NUMA interconnect
  costs ns
    tier local 90 #27ae60
    tier hop1 140 #2f80ed
  node N0 : Node 0 : CPU+RAM
  node N1 : Node 1 : CPU+RAM
  N0 -- N1 : 140
```
