## DS — Radix Tree

Prefix-compressed Patricia trie: shared prefixes collapse onto single labelled edges; branch nodes render as small dots; word-terminal nodes render as filled pills showing the complete word.

**Header keyword(s):** `radix`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `radix <word1> <word2> …` | Alphabetic words to insert (case-sensitive) |
| `insert` | Optional keyword (ignored; alphabetic tokens are the words) |

**Word filter:** only purely alphabetic tokens (`/^[A-Za-z]+$/`) that are not `radix` or `insert` are treated as words. Numeric tokens and keywords are silently skipped.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
radix insert cat car card dog do
```
