/**
 * @file diagrams/tree/lsmtree.ts — Log-Structured Merge-Tree diagram module.
 *
 * Visualizes the tiered memory/disk architecture of modern LSM storage engines:
 *   - Memory Layer: Active MemTable, Immutable MemTable, Write-Ahead Log (WAL).
 *   - Disk Layer: Tiered SSTables across Level 0 (overlapping) and Level 1..k (non-overlapping).
 *   - Operations: Flush arrows and leveled Compaction arrows between SSTable blocks.
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
import { measureText } from '../../../../text/metrics.js';
import { pen } from '../../../../scene/build.js';
import { applyOverlays } from '../../../../overlay/apply.js';
import { rhu, rhuInt } from '../../../../util/round.js';

export interface LsmMemtable {
  readonly id: string;
  readonly name: string;
  readonly keys: readonly string[];
  readonly isImmutable?: boolean | undefined;
}

export interface LsmSst {
  readonly id: string;
  readonly range: string;
  readonly size?: string | undefined;
}

export interface LsmLevel {
  readonly id: string;
  readonly title: string;
  readonly ssts: readonly LsmSst[];
}

export interface LsmOperation {
  readonly type: 'flush' | 'compact';
  readonly from: string;
  readonly to: string;
  readonly label?: string | undefined;
}

export interface LsmTreeDocument extends BaseIR {
  readonly title?: string | undefined;
  readonly wal?: string | undefined;
  readonly memtables: readonly LsmMemtable[];
  readonly levels: readonly LsmLevel[];
  readonly operations: readonly LsmOperation[];
}

export function buildLsmTree(input: string): LsmTreeDocument {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title: string | undefined;
  let wal: string | undefined;
  const memtables: LsmMemtable[] = [];
  const levels: LsmLevel[] = [];
  const operations: LsmOperation[] = [];

  let currentLevel: { id: string; title: string; ssts: LsmSst[] } | null = null;

  for (const line of lines) {
    if (/^lsmtree\b/i.test(line)) continue;

    const titleMatch = line.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim().replace(/^["']|["']$/g, '');
      continue;
    }

    const walMatch = line.match(/^wal\s*(.*)$/i);
    if (walMatch) {
      wal = walMatch[1] ? walMatch[1].trim().replace(/^["']|["']$/g, '') : 'Write-Ahead Log (WAL)';
      continue;
    }

    const memMatch = line.match(/^memtable\s+(\w+)\s*(?:"([^"]+)")?\s*(?:\[(.*?)\])?/i);
    if (memMatch) {
      const id = memMatch[1]!;
      const name = memMatch[2] ?? (id === 'immutable' ? 'Immutable MemTable' : 'Active MemTable');
      const rawKeys = memMatch[3] ? memMatch[3].split('|').map((s) => s.trim()).filter(Boolean) : [];
      memtables.push({
        id,
        name,
        keys: rawKeys.length > 0 ? rawKeys : ['k1', 'k2', 'k3'],
        ...(id.toLowerCase().includes('imm') ? { isImmutable: true } : {}),
      });
      continue;
    }

    const levelStart = line.match(/^level\s+(\w+)\s*(?:"([^"]+)")?/i);
    if (levelStart) {
      if (currentLevel) levels.push(currentLevel);
      currentLevel = {
        id: levelStart[1]!,
        title: levelStart[2] ?? `Level ${levelStart[1]}`,
        ssts: [],
      };
      continue;
    }

    if (/^end\b/i.test(line) && currentLevel) {
      levels.push(currentLevel);
      currentLevel = null;
      continue;
    }

    const sstMatch = line.match(/^sst\s+(\w+)\s*(?:\[(.*?)\])?\s*(?:"([^"]+)")?/i);
    if (sstMatch && currentLevel) {
      currentLevel.ssts.push({
        id: sstMatch[1]!,
        range: sstMatch[2] ?? '0..100',
        ...(sstMatch[3] ? { size: sstMatch[3] } : {}),
      });
      continue;
    }

    const flushMatch = line.match(/^flush\s+(\w+)\s*->\s*(\w+)(?:\s+"([^"]+)")?/i);
    if (flushMatch) {
      operations.push({
        type: 'flush',
        from: flushMatch[1]!,
        to: flushMatch[2]!,
        ...(flushMatch[3] ? { label: flushMatch[3] } : {}),
      });
      continue;
    }

    const compactMatch = line.match(/^compact\s+([\w.]+)\s*->\s*([\w.]+)(?:\s+"([^"]+)")?/i);
    if (compactMatch) {
      operations.push({
        type: 'compact',
        from: compactMatch[1]!,
        to: compactMatch[2]!,
        ...(compactMatch[3] ? { label: compactMatch[3] } : {}),
      });
      continue;
    }
  }

  if (currentLevel) levels.push(currentLevel);

  // Defaults if minimal input
  if (memtables.length === 0) {
    memtables.push(
      { id: 'active', name: 'Active MemTable', keys: ['10', '25', '40'] },
      { id: 'immutable', name: 'Immutable MemTable', keys: ['5', '18', '32'], isImmutable: true },
    );
  }
  if (levels.length === 0) {
    levels.push(
      { id: 'L0', title: 'Level 0 (Overlapping)', ssts: [{ id: 's0_1', range: '1..50' }, { id: 's0_2', range: '25..75' }] },
      { id: 'L1', title: 'Level 1 (Partitioned)', ssts: [{ id: 's1_1', range: '1..30' }, { id: 's1_2', range: '31..60' }, { id: 's1_3', range: '61..90' }] },
    );
  }

  return {
    version: '1.0',
    metadata: title ? { title } : {},
    ...(title ? { title } : {}),
    ...(wal ? { wal } : {}),
    memtables,
    levels,
    operations,
  };
}

export function layoutLsmTree(ir: LsmTreeDocument, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing, edges } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin;
  const font = typography.baseFontSize;
  const smallFont = typography.smallFontSize;

  const elements: SceneElement[] = [];
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};

  const titleH = ir.title ? typography.titleFontSize + 24 : 0;
  let curY = margin + titleH;

  const totalWidth = 680;
  const contentWidth = totalWidth - margin * 2;

  // Title
  if (ir.title) {
    elements.push(
      p.text(
        ir.title,
        totalWidth / 2,
        margin + typography.titleFontSize,
        typography.titleFontSize + 2,
        palette.text,
        { anchor: 'middle', weight: 'bold' },
      ),
    );
  }

  // 1. Memory Layer Container
  const memY = curY;
  const memH = 100;

  elements.push(
    p.rect(
      { x: margin, y: memY, width: contentWidth, height: memH },
      palette.surface,
      palette.primary,
      1.5,
      { rx: 8 },
    ),
  );

  elements.push(
    p.text(
      'MEMORY BUFFER (DRAM)',
      margin + 16,
      memY + 18,
      smallFont - 1,
      palette.primary,
      { weight: 'bold' },
    ),
  );

  // WAL Card (if present)
  let memCardsX = margin + 16;
  if (ir.wal) {
    const walW = 120;
    const walH = 54;
    const walBox = { x: memCardsX, y: memY + 30, width: walW, height: walH };
    elements.push(p.rect(walBox, palette.background, palette.textMuted, 1.2, { rx: 4 }));
    elements.push(
      p.text('WAL Log', walBox.x + walW / 2, walBox.y + 22, smallFont, palette.text, {
        anchor: 'middle',
        weight: 'bold',
      }),
    );
    elements.push(
      p.text('append-only', walBox.x + walW / 2, walBox.y + 40, smallFont - 2, palette.textMuted, {
        anchor: 'middle',
      }),
    );
    anchors['wal'] = { bounds: walBox };
    memCardsX += walW + 16;
  }

  // Memtables
  const memTableW = Math.min(220, (contentWidth - memCardsX + margin - 20) / ir.memtables.length);
  const memBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  for (const mt of ir.memtables) {
    const mtBox = { x: memCardsX, y: memY + 30, width: memTableW, height: 54 };
    memBoxes.set(mt.id, mtBox);
    anchors[mt.id] = { bounds: mtBox };

    const stroke = mt.isImmutable ? palette.textMuted : palette.primary;
    elements.push(p.rect(mtBox, palette.background, stroke, 1.5, { rx: 4 }));

    elements.push(
      p.text(mt.name, mtBox.x + 8, mtBox.y + 16, smallFont - 1, stroke, { weight: 'bold' }),
    );

    // Key cells
    const cellW = (mtBox.width - 16) / mt.keys.length;
    mt.keys.forEach((k, idx) => {
      const cx = mtBox.x + 8 + idx * cellW;
      const cy = mtBox.y + 24;
      elements.push(
        p.rect({ x: cx, y: cy, width: cellW, height: 22 }, palette.surface, palette.border, 1, {
          rx: 2,
        }),
      );
      elements.push(
        p.text(k, cx + cellW / 2, cy + 15, smallFont - 1, palette.text, {
          anchor: 'middle',
          weight: 'bold',
        }),
      );
    });

    memCardsX += memTableW + 16;
  }

  curY += memH + 28;

  // 2. Disk Storage Levels
  const levelBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const sstBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  for (const lvl of ir.levels) {
    const lvlY = curY;
    const lvlH = 68;
    const lvlBox = { x: margin, y: lvlY, width: contentWidth, height: lvlH };
    levelBoxes.set(lvl.id, lvlBox);
    anchors[lvl.id] = { bounds: lvlBox };

    elements.push(p.rect(lvlBox, palette.surface, palette.border, 1.2, { rx: 6 }));

    // Level Title Tag
    const tagW = measureText(lvl.title, smallFont).width + 16;
    elements.push(
      p.rect(
        { x: margin + 12, y: lvlY + 10, width: tagW, height: 18 },
        palette.background,
        palette.textMuted,
        1,
        { rx: 3 },
      ),
    );
    elements.push(
      p.text(lvl.title, margin + 12 + tagW / 2, lvlY + 23, smallFont - 1, palette.textMuted, {
        anchor: 'middle',
        weight: 'bold',
      }),
    );

    // SSTable blocks
    const sstStartX = margin + tagW + 28;
    const availableW = contentWidth - (sstStartX - margin) - 16;
    const sstW = Math.min(130, availableW / Math.max(1, lvl.ssts.length) - 12);

    lvl.ssts.forEach((sst, idx) => {
      const sx = sstStartX + idx * (sstW + 12);
      const sy = lvlY + 12;
      const sbox = { x: sx, y: sy, width: sstW, height: 44 };
      sstBoxes.set(sst.id, sbox);
      sstBoxes.set(`${lvl.id}.${sst.id}`, sbox);
      anchors[sst.id] = { bounds: sbox };
      anchors[`${lvl.id}.${sst.id}`] = { bounds: sbox };

      elements.push(p.rect(sbox, palette.background, palette.primary, 1.5, { rx: 4 }));
      elements.push(
        p.text(`SST [${sst.range}]`, sx + sstW / 2, sy + 20, smallFont, palette.text, {
          anchor: 'middle',
          weight: 'bold',
        }),
      );
      elements.push(
        p.text(
          sst.size ?? 'Immutable block',
          sx + sstW / 2,
          sy + 34,
          smallFont - 2,
          palette.textMuted,
          { anchor: 'middle' },
        ),
      );
    });

    curY += lvlH + 20;
  }

  // 3. Operations & Compaction Arrows
  const FLUSH_ARROW_ID = 'lsm-flush-arrow';
  const COMPACT_ARROW_ID = 'lsm-compact-arrow';

  for (const op of ir.operations) {
    if (op.type === 'flush') {
      const fromBox = memBoxes.get(op.from) ?? memBoxes.get('immutable') ?? memBoxes.get('active');
      const toBox = levelBoxes.get(op.to) ?? levelBoxes.get('L0');
      if (fromBox && toBox) {
        const startX = fromBox.x + fromBox.width / 2;
        const startY = fromBox.y + fromBox.height;
        const endX = toBox.x + 60;
        const endY = toBox.y;

        elements.push(
          p.path(
            `M ${rhu(startX)} ${rhu(startY)} L ${rhu(endX)} ${rhu(endY)}`,
            palette.primary,
            1.8,
            { markerEnd: FLUSH_ARROW_ID, dash: '3 3' },
          ),
        );
      }
    } else if (op.type === 'compact') {
      const fromBox = sstBoxes.get(op.from) ?? levelBoxes.get(op.from);
      const toBox = sstBoxes.get(op.to) ?? levelBoxes.get(op.to);
      if (fromBox && toBox) {
        const startX = fromBox.x + fromBox.width / 2;
        const startY = fromBox.y + fromBox.height;
        const endX = toBox.x + toBox.width / 2;
        const endY = toBox.y;

        elements.push(
          p.path(
            `M ${rhu(startX)} ${rhu(startY)} L ${rhu(endX)} ${rhu(endY)}`,
            palette.secondary ?? palette.primary,
            1.8,
            { markerEnd: COMPACT_ARROW_ID },
          ),
        );
      }
    }
  }

  const s = edges?.arrowSize ?? 8;
  const sH = rhu(s * 0.7);
  const sMidY = rhu(s * 0.35);
  const sRefX = rhu(s - 1);

  const defs = [
    `<marker id="${FLUSH_ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.primary}" /></marker>`,
    `<marker id="${COMPACT_ARROW_ID}" markerWidth="${s}" markerHeight="${sH}" refX="${sRefX}" refY="${sMidY}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${s} ${sMidY}, 0 ${sH}" fill="${palette.secondary ?? palette.primary}" /></marker>`,
  ];

  const scene: Scene = applyOverlays(
    {
      viewBox: { x: 0, y: 0, width: totalWidth, height: rhuInt(curY + margin) },
      background: palette.background,
      elements,
      defs,
    },
    ir.overlays,
    theme,
  );

  return { scene, anchors: anchors as NodeAnchorRegistry };
}

export const lsmtree: DiagramModule<LsmTreeDocument> = {
  parseMermaid: buildLsmTree,
  parseYaml: (input) => JSON.parse(input) as LsmTreeDocument,
  layout: (ir: LsmTreeDocument, theme: ResolvedTheme): LayoutResult => layoutLsmTree(ir, theme),
};
