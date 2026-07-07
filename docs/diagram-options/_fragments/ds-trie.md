## DS — Trie

Uncompressed character trie: every character gets its own edge and node; shared prefixes share a path; word-terminal nodes render as filled pills with the full word; intermediate nodes render as dots.

**Header keyword(s):** `trie`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `trie <word1> <word2> …` | Insert words into the trie (alphanumeric tokens only) |
| `insert` | Optional keyword between `trie` and the words (ignored) |

**Word filter:** only alphanumeric tokens (`[A-Za-z0-9]+`) that are not `trie` or `insert` are treated as words to insert.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
trie insert cat car card dog do
```
