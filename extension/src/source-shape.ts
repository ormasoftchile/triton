/**
 * Tiny helpers for reasoning about the SHAPE of a diagram source — where the
 * optional frontmatter ends and where the header line sits. Shared by the
 * completion provider (header-vs-body decision) and the diagnostics provider
 * (fallback range when an error carries no position).
 *
 * These mirror the leniency of `src/frontend/detect.ts`: a leading `--- … ---`
 * frontmatter block is skipped, as are blank lines and `%%` comments, before
 * the first real header token.
 */

const FENCE = /^\s*---\s*$/;

/** Index of the first line AFTER a leading `--- … ---` frontmatter block, else 0. */
export function frontmatterEnd(lines: readonly string[]): number {
  if (!FENCE.test(lines[0] ?? '')) return 0;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i]!)) return i + 1;
  }
  return 0; // unterminated — treat as no frontmatter
}

/**
 * Index of the diagram HEADER line: the first non-blank, non-`%%`-comment line
 * after any frontmatter. Returns `lines.length` for an all-blank document (so a
 * fresh cursor still counts as "at the header").
 */
export function headerLineIndex(lines: readonly string[]): number {
  let i = frontmatterEnd(lines);
  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (t.length === 0 || t.startsWith('%%')) {
      i++;
      continue;
    }
    return i;
  }
  return i;
}

/** Index of the first non-blank line (0 if none), for fallback diagnostics. */
export function firstNonBlankLine(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0) return i;
  }
  return 0;
}
