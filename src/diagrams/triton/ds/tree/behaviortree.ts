/**
 * @file diagrams/tree/behaviortree.ts — Behavior Tree diagram module for AI & Robotics.
 *
 * Characteristics:
 *   1. Composite control flow nodes:
 *      - Selector / Fallback (`?`)
 *      - Sequence (`->` or `→`)
 *      - Parallel (`||` or `⇶`)
 *   2. Decorator nodes (`invert`, `retry`, `repeat`, `timeout`).
 *   3. Leaf nodes:
 *      - Condition nodes (rounded pill cards)
 *      - Action nodes (rectangular task cards)
 *   4. Execution state badges (SUCCESS ✓, RUNNING ⟳, FAILURE ✗, IDLE).
 */

import type {
  DiagramModule,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
} from '../../../../contracts/index.js';
import type { BaseIR } from '../../../../contracts/diagram.js';
import { treeLayout, type TreeNodeInput } from '../../../../graph/tree.js';
import { measureText } from '../../../../text/metrics.js';
import { pen } from '../../../../scene/build.js';
import { applyOverlays } from '../../../../overlay/apply.js';
import { rhu, rhuInt } from '../../../../util/round.js';

export type BehaviorNodeKind = 'selector' | 'sequence' | 'parallel' | 'decorator' | 'condition' | 'action';
export type BehaviorStatus = 'success' | 'running' | 'failure' | 'idle';

export interface BehaviorTreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: BehaviorNodeKind;
  readonly status?: BehaviorStatus | undefined;
  readonly decoratorType?: string | undefined;
  readonly children: readonly string[];
}

export interface BehaviorTreeDocument extends BaseIR {
  readonly title?: string | undefined;
  readonly nodes: readonly BehaviorTreeNode[];
}

export function buildBehaviorTree(input: string): BehaviorTreeDocument {
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let title: string | undefined;
  let compact = false;
  let maxWidth: number | undefined;
  let direction: 'TB' | 'LR' | undefined;
  const filteredLines: { indent: number; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^behaviortree\b/i.test(trimmed)) continue;

    const titleMatch = trimmed.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    const compactMatch = trimmed.match(/^(layout\s+compact|compact\s*(true)?|compact)\b/i);
    if (compactMatch) {
      compact = true;
      continue;
    }

    const maxWidthMatch = trimmed.match(/^max-?width\s+(\d+)/i);
    if (maxWidthMatch) {
      maxWidth = Number(maxWidthMatch[1]);
      compact = true;
      continue;
    }

    const dirMatch = trimmed.match(/^direction\s+(TD|TB|LR)/i);
    if (dirMatch) {
      direction = dirMatch[1] === 'LR' ? 'LR' : 'TB';
      continue;
    }

    const indent = line.search(/\S|$/);
    filteredLines.push({ indent, text: trimmed });
  }

  const nodes: BehaviorTreeNode[] = [];
  const stack: { indent: number; id: string }[] = [];

  filteredLines.forEach((item, idx) => {
    const id = `bn_${idx + 1}`;
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= item.indent) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;

    let text = item.text;
    let status: BehaviorStatus | undefined;
    let kind: BehaviorNodeKind = 'action';
    let decoratorType: string | undefined;

    // Status attribute in { status: success }
    const attrMatch = text.match(/\{(.*?)\}/);
    if (attrMatch) {
      const attrStr = attrMatch[1]!;
      const statMatch = attrStr.match(/status\s*:\s*["']?(\w+)["']?/i);
      if (statMatch) {
        status = statMatch[1]!.toLowerCase() as BehaviorStatus;
      }
      text = text.replace(/\{.*?\}/, '').trim();
    }

    // Determine kind from syntax markers
    if (/^(\?|fallback\b|selector\b)/i.test(text)) {
      kind = 'selector';
      text = text.replace(/^(\?|fallback|selector)\s*/i, '');
    } else if (/^(->|→|sequence\b)/i.test(text)) {
      kind = 'sequence';
      text = text.replace(/^(->|→|sequence)\s*/i, '');
    } else if (/^(\|\||⇶|parallel\b)/i.test(text)) {
      kind = 'parallel';
      text = text.replace(/^(\|\||⇶|parallel)\s*/i, '');
    } else if (/^(decorator|invert|repeat|retry|timeout)\b/i.test(text)) {
      kind = 'decorator';
      const decM = text.match(/^(\w+)/);
      decoratorType = decM ? decM[1] : 'decorator';
      text = text.replace(/^(\w+)\s*/i, '');
    } else if (text.startsWith('(') && text.endsWith(')')) {
      kind = 'condition';
      text = text.slice(1, -1).trim();
    } else if (text.startsWith('[') && text.endsWith(']')) {
      kind = 'action';
      text = text.slice(1, -1).trim();
    } else if (/^condition\b/i.test(text)) {
      kind = 'condition';
      text = text.replace(/^condition\s+/i, '');
    } else if (/^action\b/i.test(text)) {
      kind = 'action';
      text = text.replace(/^action\s+/i, '');
    }

    const node: BehaviorTreeNode = {
      id,
      label: text.replace(/^["']+|["']+$/g, '').trim() || (kind === 'selector' ? '?' : kind === 'sequence' ? '→' : 'Action'),
      kind,
      ...(status ? { status } : {}),
      ...(decoratorType ? { decoratorType } : {}),
      children: [],
    };

    nodes.push(node);

    if (parent) {
      const pNode = nodes.find((n) => n.id === parent.id);
      if (pNode) {
        (pNode.children as string[]).push(id);
      }
    }

    stack.push({ indent: item.indent, id });
  });

  return {
    version: '1.0',
    metadata: {
      ...(title ? { title } : {}),
      ...(compact ? { compact: true } : {}),
      ...(maxWidth !== undefined ? { maxWidth } : {}),
      ...(direction ? { direction } : {}),
    },
    ...(title ? { title } : {}),
    nodes,
  };
}

// ─── Layout & Rendering ──────────────────────────────────────────────────────

const ARROW_ID = 'bt-arrow';

export function layoutBehaviorTree(ir: BehaviorTreeDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing, edges } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;

  if (ir.nodes.length === 0) {
    const scene: Scene = {
      viewBox: { x: 0, y: 0, width: 140, height: 90 },
      background: palette.background,
      elements: [],
    };
    return { scene, anchors: {} };
  }

  const isCompact =
    ir.metadata['compact'] === true ||
    ir.metadata['layout'] === 'compact' ||
    String(ir.metadata['compact']) === 'true';

  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of ir.nodes) {
    let w = measureText(node.label, isCompact ? smallFont : font).width + (isCompact ? 24 : 36);
    let h = (isCompact ? smallFont : font) + (isCompact ? 16 : 24);

    if (node.kind === 'selector' || node.kind === 'sequence' || node.kind === 'parallel') {
      w = Math.max(w, isCompact ? 44 : 54);
      h = isCompact ? 36 : 44;
    } else if (node.kind === 'condition') {
      w = Math.max(w, isCompact ? 64 : 80);
      h = isCompact ? 30 : 38;
    } else {
      w = Math.max(w, isCompact ? 70 : 90);
      h = isCompact ? 32 : 42;
    }

    if (node.status) w += isCompact ? 14 : 20; // extra space for status badge

    sizes.set(node.id, { width: w, height: h });
  }

  const inputs: TreeNodeInput[] = ir.nodes.map((n) => ({
    id: n.id,
    width: sizes.get(n.id)!.width,
    height: sizes.get(n.id)!.height,
    children: n.children,
  }));

  const placed = treeLayout(inputs, {
    direction: (ir.metadata['direction'] as 'TB' | 'LR') ?? 'TB',
    levelGap: isCompact ? 38 : 56,
    siblingGap: isCompact ? 12 : 24,
    margin,
  });

  const titleH = ir.title ? typography.titleFontSize + 24 : 0;
  const box = (id: string) => {
    const b = placed.boxes.get(id)!;
    return { x: b.x, y: b.y + titleH, width: b.width, height: b.height };
  };

  const elements: SceneElement[] = [];

  // Title
  if (ir.title) {
    elements.push(
      p.text(
        ir.title,
        placed.width / 2,
        margin + typography.titleFontSize,
        typography.titleFontSize + 2,
        palette.text,
        { anchor: 'middle', weight: 'bold' },
      ),
    );
  }

  // 1. Edges
  for (const node of ir.nodes) {
    const pb = box(node.id);
    for (const cid of node.children) {
      const cb = box(cid);
      elements.push(
        p.path(
          `M ${rhu(pb.x + pb.width / 2)} ${rhu(pb.y + pb.height)} L ${rhu(cb.x + cb.width / 2)} ${rhu(cb.y)}`,
          palette.textMuted,
          1.5,
          { markerEnd: ARROW_ID },
        ),
      );
    }
  }

  // 2. Nodes
  for (const node of ir.nodes) {
    const b = box(node.id);

    let fill = palette.surface;
    let stroke = palette.border;
    let rx = 4;

    if (node.kind === 'selector') {
      stroke = palette.primary;
      rx = 6;
    } else if (node.kind === 'sequence') {
      stroke = palette.secondary ?? palette.primary;
      rx = 6;
    } else if (node.kind === 'parallel') {
      stroke = palette.primary;
      rx = 6;
    } else if (node.kind === 'condition') {
      rx = b.height / 2; // Pill shape
      stroke = palette.textMuted;
    } else if (node.kind === 'decorator') {
      rx = 4;
      stroke = palette.secondary ?? palette.primary;
    }

    elements.push(p.rect(b, fill, stroke, 1.5, { rx }));

    // Composite Icon Badge / Prefix
    let prefix = '';
    if (node.kind === 'selector') prefix = '? ';
    else if (node.kind === 'sequence') prefix = '→ ';
    else if (node.kind === 'parallel') prefix = '⇶ ';

    const displayText = `${prefix}${node.label}`;
    const textX = node.status ? b.x + (b.width - 24) / 2 : b.x + b.width / 2;
    const textY = b.y + b.height / 2 + font * 0.35;

    elements.push(
      p.text(
        displayText,
        rhu(textX),
        rhu(textY),
        font,
        palette.text,
        { anchor: 'middle', weight: node.kind === 'action' || node.kind === 'condition' ? 'normal' : 'bold' },
      ),
    );

    // Status Indicator Badge
    if (node.status) {
      let icon = '';
      let statColor = palette.textMuted;

      if (node.status === 'success') {
        icon = '✓';
        statColor = '#10B981'; // green
      } else if (node.status === 'running') {
        icon = '⟳';
        statColor = '#F59E0B'; // yellow/amber
      } else if (node.status === 'failure') {
        icon = '✗';
        statColor = '#EF4444'; // red
      } else {
        icon = '•';
        statColor = palette.textMuted;
      }

      const badgeX = b.x + b.width - 16;
      const badgeY = b.y + b.height / 2;

      elements.push(
        p.circle({ x: badgeX, y: badgeY }, 9, palette.background, statColor, 1.2),
      );
      elements.push(
        p.text(icon, badgeX, badgeY + 4, smallFont, statColor, { anchor: 'middle', weight: 'bold' }),
      );
    }
  }

  // 3. Dynamic Arrowheads
  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.textMuted}" /></marker>`,
  ];

  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};
  for (const node of ir.nodes) {
    anchors[node.id] = { bounds: box(node.id) };
  }

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: rhuInt(placed.width), height: rhuInt(placed.height + titleH) },
      background: palette.background,
      elements,
      defs,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const behaviortree: DiagramModule<BehaviorTreeDocument> = {
  parseMermaid: buildBehaviorTree,
  parseYaml: (input) => JSON.parse(input) as BehaviorTreeDocument,
  layout: (ir: BehaviorTreeDocument, theme: ResolvedTheme): LayoutResult => layoutBehaviorTree(ir, theme),
};
