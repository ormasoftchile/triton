import * as vscode from 'vscode';

/**
 * Locate ```triton fenced blocks inside a Markdown document, WITH line offsets
 * (which `extractFencedBlocks` in markdown.ts deliberately omits — it only needs
 * the body text for rendering). Completion and diagnostics both need to map
 * positions/ranges back into the host document, so they share this scanner.
 *
 * Only ```triton fences are returned; ```mermaid and other fences are skipped
 * (Triton always owns its own fence; Mermaid coexistence is a preview concern,
 * not an IntelliSense one).
 */
export interface TritonFence {
  /** 0-based line index of the first body line (the line after the opening ```). */
  readonly bodyStartLine: number;
  /** 0-based line index of the closing ``` (exclusive end of the body). */
  readonly bodyEndLine: number;
  /** The fenced block body (lines between the fences), joined with `\n`. */
  readonly body: string;
}

const FENCE = /^\s*```([A-Za-z0-9_-]*)/;

export function findTritonFences(text: string): TritonFence[] {
  const lines = text.split(/\r?\n/);
  const out: TritonFence[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = FENCE.exec(lines[i]!);
    if (!m) {
      i++;
      continue;
    }
    const lang = (m[1] ?? '').toLowerCase();
    const bodyStart = i + 1;
    let j = bodyStart;
    while (j < lines.length && !FENCE.test(lines[j]!)) j++;
    if (lang === 'triton') {
      out.push({ bodyStartLine: bodyStart, bodyEndLine: j, body: lines.slice(bodyStart, j).join('\n') });
    }
    i = j + 1; // resume past the closing fence
  }
  return out;
}

/** The ```triton fence whose BODY contains `position`, or undefined. */
export function tritonFenceAt(
  document: vscode.TextDocument,
  position: vscode.Position,
): TritonFence | undefined {
  for (const f of findTritonFences(document.getText())) {
    if (position.line >= f.bodyStartLine && position.line < f.bodyEndLine) return f;
  }
  return undefined;
}
