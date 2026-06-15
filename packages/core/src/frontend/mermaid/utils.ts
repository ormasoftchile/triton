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
  /**
   * Layout key extracted from %%{init}%% directive, if any.
   * For timeline diagrams: 'timeline-columns' | 'vertical-spine' | 'serpentine' | 'roadmap' | 'horizontal'.
   * For flowchart: 'LR' | 'TB' etc. (orientation — informational only; direction comes from header).
   * Unknown values are passed through; each rendering branch validates and degrades gracefully.
   */
  directiveLayout?: string;
  /**
   * Density key extracted from %%{init}%% directive, if any.
   * Valid values: 'compact' | 'normal' | 'comfortable'.
   * Applied only when a contract theme is active.
   */
  directiveDensity?: string;
  /**
   * Token overrides extracted from %%{init}%% `themeOverrides` field, if any.
   * Deep-merged onto the resolved ThemeContract before binding.
   * Supports shorthand flat keys (accent, surface, fontFamily, …) and
   * nested ThemeContract paths (palette.accent, typography.family, …).
   */
  directiveThemeOverrides?: Record<string, unknown>;
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
  let directiveLayout: string | undefined;
  let directiveDensity: string | undefined;
  let directiveThemeOverrides: Record<string, unknown> | undefined;
  const bodyLines: string[] = [];

  for (let i = pos; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // %%{init: {...}}%% directive — extract theme/title/layout/density/themeOverrides, then drop the line
    if (trimmed.startsWith('%%{') && trimmed.includes('}%%')) {
      const { theme, title, layout, density, themeOverrides } = extractInitFields(trimmed);
      if (theme !== undefined) directiveTheme = theme;
      if (title !== undefined) directiveTitle = title;
      if (layout !== undefined) directiveLayout = layout;
      if (density !== undefined) directiveDensity = density;
      if (themeOverrides !== undefined) directiveThemeOverrides = themeOverrides;
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
    directiveLayout,
    directiveDensity,
    directiveThemeOverrides,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract `theme`, `title`, `layout`, `density`, and `themeOverrides` from a
 * %%{init: {...}}%% directive string.
 *
 * Handles both double-quoted JSON (`"theme": "dark"`) and single-quoted
 * Mermaid variants (`'theme': 'dark'`). Falls back to regex extraction if
 * JSON.parse fails on either form.
 */
function extractInitFields(directive: string): {
  theme?: string;
  title?: string;
  layout?: string;
  density?: string;
  themeOverrides?: Record<string, unknown>;
} {
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

  // Extract themeOverrides if present (must be a non-null, non-array object)
  let themeOverrides: Record<string, unknown> | undefined;
  const rawOverrides = obj['themeOverrides'];
  if (rawOverrides !== null && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
    themeOverrides = rawOverrides as Record<string, unknown>;
  }

  return {
    theme:         typeof obj['theme']   === 'string' ? obj['theme']   : undefined,
    title:         typeof obj['title']   === 'string' ? obj['title']   : undefined,
    layout:        typeof obj['layout']  === 'string' ? obj['layout']  : undefined,
    density:       typeof obj['density'] === 'string' ? obj['density'] : undefined,
    themeOverrides,
  };
}
