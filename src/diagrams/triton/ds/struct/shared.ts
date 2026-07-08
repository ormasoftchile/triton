/**
 * @file diagrams/struct/shared.ts — Shared helpers for the strip/memory family.
 */

export const ARROW_ID = 'struct-arrow';

/** A small filled arrowhead marker def in the given colour. */
export function arrowDef(color: string): string {
  return `<marker id="${ARROW_ID}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${color}" /></marker>`;
}

/** Tokens on the keyword line and directive lines, trimmed and split. */
export function lines(input: string): string[] {
  return input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

/**
 * Split a directive line into bare tokens and double-quoted tokens.
 *
 * Quoted tokens support only `\"` and `\\` escapes and cannot span lines.
 * Full-line comment handling remains centralized before diagram parsers run;
 * this tokenizer intentionally does not strip inline `%%` text.
 */
export function tokenizeDirective(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i]!)) i++;
    if (i >= line.length) break;

    if (line[i] === '"') {
      i++;
      let value = '';
      while (i < line.length) {
        const ch = line[i]!;
        if (ch === '"') {
          i++;
          break;
        }
        if (ch === '\\') {
          const next = line[i + 1];
          if (next === '"' || next === '\\') {
            value += next;
            i += 2;
            continue;
          }
        }
        value += ch;
        i++;
      }
      if (line[i - 1] !== '"') throw new Error(`Unterminated quoted string: ${line}`);
      tokens.push(value);
      continue;
    }

    const start = i;
    while (i < line.length && !/\s/.test(line[i]!)) i++;
    tokens.push(line.slice(start, i));
  }

  return tokens;
}
