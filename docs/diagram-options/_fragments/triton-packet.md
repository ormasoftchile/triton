## Packet

Renders bit-level protocol field maps as annotated bit-range diagrams.

**Header keyword(s):** `packet-beta`

---

### Config keywords

| Keyword | Syntax          | Purpose                                   |
|---------|-----------------|-------------------------------------------|
| `title` | `title <text>`  | Diagram title displayed above the packet map |

---

### Entry / Event syntax

| Syntax                      | Meaning                                          |
|-----------------------------|--------------------------------------------------|
| `<bit>: "Label"`            | Single-bit field at position `<bit>`             |
| `<start>-<end>: "Label"`    | Multi-bit field covering bits `start` through `end` |

Labels may be quoted with `"` or given as an unquoted bare string.

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
packet-beta
title TCP Segment Header
0-3: "Data Offset"
10: "URG"
16-31: "Window Size"
32-47: "Checksum"
```
