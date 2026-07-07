/**
 * @file frontend/preprocess.ts — Source pre-processing before grammar dispatch.
 *
 * Central `%%` comment stripping so that every diagram family accepts comment
 * lines without requiring per-grammar Comment rules.
 */

/**
 * Strip full-line `%%` comments from Mermaid diagram source.
 *
 * ### Semantics (aligned with the 4 built-in grammars that handle `%%` natively)
 *
 * - **Full-line only:** a line is a comment iff its first non-whitespace
 *   characters are `%%`. Such lines are removed entirely.
 * - **No inline trailing comments:** `A --> B %% note` is NOT stripped. This
 *   is the safe default — distinguishing a real trailing comment from `%%`
 *   inside node labels such as `A["50%% off"]` is unsafe without a full parse.
 *   The 4 grammars that already handle their own Comment rules continue to work
 *   unchanged on the pre-stripped input.
 * - **Frontmatter preserved:** if the input opens with a `---\n…\n---` YAML
 *   frontmatter block, that block is passed through verbatim (YAML may contain
 *   `%%` in values). Comment stripping applies only to the Mermaid body that
 *   follows the closing fence.
 * - **Pure-YAML inputs untouched:** if the first non-whitespace token is
 *   `type:` (the Triton YAML path), the input is returned unchanged so that
 *   `parseYaml` receives exactly what the author wrote.
 */
export function stripComments(input: string): string {
  const trimmed = input.trimStart();

  // Pure-YAML path: do not strip — `%%` is not a YAML construct and may
  // appear legitimately inside YAML string values.
  if (/^type:\s/.test(trimmed)) return input;

  // Frontmatter path: preserve the `---…---` block verbatim; strip comments
  // only in the Mermaid body that follows.
  if (trimmed.startsWith('---')) {
    const fmMatch = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (fmMatch) {
      const leadingWs = input.slice(0, input.length - trimmed.length);
      const frontmatter = fmMatch[0];
      const body = trimmed.slice(frontmatter.length);
      return leadingWs + frontmatter + removeCommentLines(body);
    }
    // Malformed frontmatter (no closing `---`) — treat conservatively as
    // YAML-ish and return untouched.
    return input;
  }

  // Plain Mermaid text — strip comment lines from the entire input.
  return removeCommentLines(input);
}

/**
 * Remove every line whose first non-whitespace characters are `%%`.
 * Lines are joined back with `\n`; `\r` characters within lines are preserved.
 */
function removeCommentLines(text: string): string {
  return text
    .split('\n')
    .filter(line => !/^\s*%%/.test(line))
    .join('\n');
}
