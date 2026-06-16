/**
 * @file util/label-lines.ts — Split a node label into display lines.
 *
 * Supports both Mermaid-standard HTML break markers and backslash-n:
 *   - `<br>`, `<br/>`, `<br />` (case-insensitive, optional whitespace)
 *   - `\n` as a literal two-character backslash-n sequence in the source
 *   - An actual newline character (U+000A)
 *
 * Determinism: pure function — same input always yields same output.
 */

/** Regex matching all `<br>` / `<br/>` / `<br />` variants (case-insensitive). */
const HTML_BREAK_RE = /<br\s*\/?>/gi;

/** Regex matching the literal two-character sequence backslash-n (`\n`). */
const LITERAL_BACKSLASH_N_RE = /\\n/g;

/**
 * Split `label` into display lines by interpreting line-break markers.
 *
 * Recognised markers (all converted to a real newline before splitting):
 *   - `<br>`, `<br/>`, `<br />` (and mixed-case variants)
 *   - `\n` as a literal two-character sequence in the source string
 *   - An actual newline character embedded in the string
 *
 * Trailing empty lines are removed. When no markers are present the
 * function returns a single-element array `[label]` — the caller can
 * check `lines.length === 1` to avoid any `multitext` overhead.
 *
 * @param label - The raw label string from the diagram source.
 * @returns Array of display lines (at least one element).
 */
export function splitLabelLines(label: string): string[] {
  // Normalise all break markers to real newlines
  const normalized = label
    .replace(HTML_BREAK_RE, '\n')
    .replace(LITERAL_BACKSLASH_N_RE, '\n');

  // Split on actual newlines (which now include the normalised markers above)
  const lines = normalized.split('\n');

  // Remove trailing empty lines (e.g. a trailing <br> yields an empty last segment)
  while (lines.length > 1 && lines[lines.length - 1]!.trim() === '') {
    lines.pop();
  }

  return lines.length > 0 ? lines : [label];
}
