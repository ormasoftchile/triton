/**
 * @file frontend/mermaid/utils.ts — Shared preprocessing utilities.
 *
 * Handles Mermaid frontmatter (--- … ---), init directives (%%{init}%%),
 * and comment lines (%% …) before grammar-specific parsing begins.
 *
 * PREPROCESSING ORDER:
 *   1. Strip leading YAML frontmatter block (--- … ---) → parse with 'yaml'
 *   2. Walk remaining lines; extract %%{init}%% directives → theme / title
 *   3. Drop %% comment lines
 *   4. Return cleaned body + structured metadata
 *
 * Both parseFlowchart (flowchart.ts) and detectDiagramType (index.ts) share
 * this utility so that frontmatter-containing files are handled consistently
 * across all callers.
 */

import { parse as parseYaml } from 'yaml';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PreprocessResult {
  /** Cleaned body text (frontmatter + directives + comments stripped). */
  body: string;
  /** Parsed YAML frontmatter fields (empty object if none). */
  frontmatter: Record<string, unknown>;
  /** Theme name extracted from %%{init}%% directive, if any. */
  directiveTheme?: string;
  /** Title extracted from %%{init}%% directive, if any. */
  directiveTitle?: string;
}

// ---------------------------------------------------------------------------
// preprocessMermaid
// ---------------------------------------------------------------------------

/**
 * Preprocess raw Mermaid text:
 *   - Strip/parse YAML frontmatter (--- … ---)
 *   - Strip %%{init}%% directives (extracting theme/title)
 *   - Drop %% comment lines
 *
 * Returns cleaned body and metadata. Does NOT parse grammar syntax.
 */
export function preprocessMermaid(text: string): PreprocessResult {
  const lines = text.split('\n');
  let pos = 0;
  let frontmatter: Record<string, unknown> = {};

  // Skip leading blank lines before potential frontmatter
  while (pos < lines.length && (lines[pos] ?? '').trim() === '') pos++;

  // Parse YAML frontmatter if present (--- … ---)
  if (pos < lines.length && (lines[pos] ?? '').trim() === '---') {
    pos++; // skip opening ---
    const fmLines: string[] = [];
    while (pos < lines.length && (lines[pos] ?? '').trim() !== '---') {
      fmLines.push(lines[pos] ?? '');
      pos++;
    }
    if (pos < lines.length) pos++; // skip closing ---

    try {
      const parsed = parseYaml(fmLines.join('\n'));
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      // Silently ignore YAML parse errors in frontmatter
    }
  }

  // Process remaining lines: extract directives, drop comments
  let directiveTheme: string | undefined;
  let directiveTitle: string | undefined;
  const bodyLines: string[] = [];

  for (let i = pos; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // %%{init: {...}}%% directive — extract theme/title, then drop the line
    if (trimmed.startsWith('%%{') && trimmed.includes('}%%')) {
      const { theme, title } = extractInitFields(trimmed);
      if (theme !== undefined) directiveTheme = theme;
      if (title !== undefined) directiveTitle = title;
      continue;
    }

    // %% comment line (not a directive) — drop
    if (trimmed.startsWith('%%')) {
      continue;
    }

    bodyLines.push(line);
  }

  return {
    body: bodyLines.join('\n'),
    frontmatter,
    directiveTheme,
    directiveTitle,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract `theme` and `title` from a %%{init: {...}}%% directive string.
 *
 * Handles both double-quoted JSON (`"theme": "dark"`) and single-quoted
 * Mermaid variants (`'theme': 'dark'`). Falls back to regex extraction if
 * JSON.parse fails on either form.
 */
function extractInitFields(directive: string): { theme?: string; title?: string } {
  // Match the JSON-like object after "init:"
  const m = directive.match(/%%\{\s*init\s*:\s*(\{[\s\S]*\})\s*\}%%/);
  if (!m || !m[1]) return {};

  let jsonStr = m[1];
  let obj: Record<string, unknown> = {};

  // Try standard JSON first
  try {
    obj = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    // Single-quote fallback (Mermaid sometimes uses JS-style quotes)
    try {
      obj = JSON.parse(jsonStr.replace(/'/g, '"')) as Record<string, unknown>;
    } catch {
      // Last resort: regex-extract theme and title values directly
      const themeM = directive.match(/['"](theme)['"]\s*:\s*['"]([^'"]+)['"]/);
      const titleM = directive.match(/['"](title)['"]\s*:\s*['"]([^'"]+)['"]/);
      return {
        theme: themeM?.[2],
        title: titleM?.[2],
      };
    }
  }

  return {
    theme: typeof obj['theme'] === 'string' ? obj['theme'] : undefined,
    title: typeof obj['title'] === 'string' ? obj['title'] : undefined,
  };
}
