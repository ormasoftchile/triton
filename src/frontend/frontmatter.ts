/**
 * @file frontend/frontmatter.ts — Robust YAML-ish frontmatter extractor.
 */

export interface ExtractedFrontmatter {
  readonly metadata: Record<string, unknown>;
  readonly body: string;
}

/**
 * Extract leading `---...---` frontmatter block from diagram input.
 * Strips the frontmatter block from `body` so hand-written DSL parsers
 * don't choke on frontmatter lines.
 */
export function extractFrontmatter(input: string): ExtractedFrontmatter {
  const m = input.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { metadata: {}, body: input };

  const metadata: Record<string, unknown> = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) metadata[key] = value;
  }

  return { metadata, body: input.slice(m[0].length) };
}
