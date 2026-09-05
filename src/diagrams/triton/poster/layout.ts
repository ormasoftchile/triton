import type {
  PosterDocument,
  PosterCell,
  CellContent,
  PosterNote,
  NotePosition,
  PosterScaleMode,
} from './ir.js';
import type {
  Scene,
  SceneElement,
  Rect,
  LayoutResult,
  NodeAnchor,
  NodeAnchorRegistry,
  OccupiedPort,
} from '../../../contracts/index.js';
import type { ResolvedTheme } from '../../../contracts/index.js';
import type { RevealStep } from '../../../contracts/reveal.js';
import { getModule } from '../../../frontend/registry.js';
import { getThemePreset } from '../../../theme/preset.js';
import { crossLinksToConnectorSpecs, routeConnectors } from '../../../crosslink/connectors.js';
import { measureText } from '../../../text/metrics.js';
import { resolveArrayElementAnchorId } from '../ds/struct/array.js';
import type { NodeAddress, CrossLink } from '../../../contracts/crosslink.js';

// ─── Public Entry ─────────────────────────────────────────────────────────────

export function layoutPoster(ir: PosterDocument, theme: ResolvedTheme): LayoutResult {
  const { spacing, palette, typography } = theme;
  const { grid, cells } = ir;

  const unit = spacing.unit;
  const gap = grid.gap !== undefined ? grid.gap : spacing.nodeGap / 2;
  const padding = spacing.diagramMargin;
  const headerH = ir.metadata.title ? typography.titleFontSize + unit * 2 : 0;
  const MIN_CELL_W = unit * 20;
  const MIN_CELL_H = unit * 15;
  const MAX_CELL_W = unit * 42;
  const MIN_EMBED_SCALE = 0.65; // minimum scale — cells expand to ensure readability

  const scaleConfig = resolveScaleConfig(
    grid.scale,
    ir.metadata.scale,
    ir.metadata.uniform_scale ?? ir.metadata['uniform-scale'],
  );

  const targetScale =
    scaleConfig.mode === 'natural'
      ? 1.0
      : scaleConfig.mode === 'fixed'
        ? (scaleConfig.fixedScale ?? 1.0)
        : MIN_EMBED_SCALE;

  // ── Assign row/col to cells that don't specify them ───────────────────────
  const positioned = assignPositions(cells, grid.columns);

  // ── Layout each child into a LayoutResult (per-cell theme) ─────────────────
  // Child layouts are synchronous (every Triton layout engine is), so a plain
  // map suffices — no Promise.all needed.
  const cellResults = positioned.map((cell) => {
    const cellTheme = cell.theme ? getThemePreset(cell.theme) : theme;
    return { cell, cellTheme, result: layoutCellContent(cell.content, cellTheme) };
  });
  const cellResultById = new Map(
    cellResults.map(({ cell, result }) => [cell.id ?? '', { cell, result }]),
  );

  const numRows = grid.rows ?? Math.max(...positioned.map((c) => (c.row ?? 0) + (c.rowSpan ?? 1)));

  // Column widths: ensure child content is readable at targetScale
  // Readability takes priority over MAX_CELL_W
  const colWidths = new Array<number>(grid.columns).fill(MIN_CELL_W);
  for (const { cell, result } of cellResults) {
    if ((cell.colSpan ?? 1) === 1) {
      const col = cell.col ?? 0;
      const inset = unit / 2;
      // Cell must be wide enough that child fits at targetScale
      const scaleForCol = cell.content.kind === 'diagram' ? targetScale : 1.0;
      const needed = result.scene.viewBox.width * scaleForCol + inset * 2;
      colWidths[col] = Math.max(colWidths[col]!, needed);
    }
  }

  // Row heights: proportional to column width, respecting targetScale
  const rowHeights = new Array<number>(numRows).fill(MIN_CELL_H);
  for (const { cell, cellTheme, result } of cellResults) {
    if ((cell.rowSpan ?? 1) === 1) {
      const row = cell.row ?? 0;
      const col = cell.col ?? 0;
      const cellTitleH = cell.title ? reservedTitleHeight(cellTheme, cell.title) : 0;
      const inset = unit / 2;
      const colW = colWidths[col] ?? MIN_CELL_W;
      const contentW = colW - inset * 2;
      const scale = Math.min(contentW / Math.max(result.scene.viewBox.width, 1), 1);
      // If scale < MIN_EMBED_SCALE, the column already expanded; recompute
      const effectiveScale =
        scaleConfig.mode === 'natural'
          ? 1.0
          : scaleConfig.mode === 'fixed'
            ? (scaleConfig.fixedScale ?? 1.0)
            : Math.max(scale, MIN_EMBED_SCALE);
      const captionH = cell.caption ? reservedCaptionHeight(cellTheme) : 0;
      const neededH =
        result.scene.viewBox.height * effectiveScale + cellTitleH + captionH + inset * 2;
      rowHeights[row] = Math.max(rowHeights[row]!, neededH);
    }
  }

  // ── Compute homologated scale across cells ──────────────────────────────
  let globalScale: number | undefined;
  if (scaleConfig.mode === 'fixed') {
    globalScale = scaleConfig.fixedScale;
  } else if (scaleConfig.mode === 'natural') {
    const diagramScales: number[] = [];
    for (const { cell, cellTheme, result } of cellResults) {
      if (cell.content.kind !== 'diagram') continue;
      const col = cell.col ?? 0;
      const row = cell.row ?? 0;
      const colSpan = cell.colSpan ?? 1;
      const rowSpan = cell.rowSpan ?? 1;
      const cellW = sumWithGaps(colWidths, col, col + colSpan, gap) - gap;
      const cellH = sumWithGaps(rowHeights, row, row + rowSpan, gap) - gap;
      const reservedTop = cell.title ? reservedTitleHeight(cellTheme, cell.title) : 0;
      const captionH = cell.caption ? reservedCaptionHeight(cellTheme) : 0;
      const inset = unit / 2;
      const contentW = cellW - inset * 2;
      const contentH = cellH - reservedTop - captionH - inset * 2;
      const sx = contentW / Math.max(result.scene.viewBox.width, 1);
      const sy = contentH / Math.max(result.scene.viewBox.height, 1);
      diagramScales.push(Math.min(sx, sy, 1.0));
    }
    globalScale = diagramScales.length > 0 ? Math.min(1.0, ...diagramScales) : 1.0;
  } else if (scaleConfig.mode === 'uniform') {
    const diagramScales: number[] = [];
    for (const { cell, cellTheme, result } of cellResults) {
      if (cell.content.kind !== 'diagram') continue;
      const col = cell.col ?? 0;
      const row = cell.row ?? 0;
      const colSpan = cell.colSpan ?? 1;
      const rowSpan = cell.rowSpan ?? 1;
      const cellW = sumWithGaps(colWidths, col, col + colSpan, gap) - gap;
      const cellH = sumWithGaps(rowHeights, row, row + rowSpan, gap) - gap;
      const reservedTop = cell.title ? reservedTitleHeight(cellTheme, cell.title) : 0;
      const captionH = cell.caption ? reservedCaptionHeight(cellTheme) : 0;
      const inset = unit / 2;
      const contentW = cellW - inset * 2;
      const contentH = cellH - reservedTop - captionH - inset * 2;
      const sx = contentW / Math.max(result.scene.viewBox.width, 1);
      const sy = contentH / Math.max(result.scene.viewBox.height, 1);
      diagramScales.push(Math.min(sx, sy, 1.0));
    }
    globalScale = diagramScales.length > 0 ? Math.min(...diagramScales) : undefined;
  }

  // ── Build elements ────────────────────────────────────────────────────────
  // Layers assembled in painter's order (back→front):
  //   headerElements — poster title text
  //   cellBg         — cell chrome rects
  //   linkPaths      — cross-link routes (behind node content so routes that
  //                    pass through a cell render behind its nodes)
  //   cellContent    — cell titles + embedded node scenes
  //   linkLabels     — cross-link label text (topmost, always readable)
  const headerElements: SceneElement[] = [];
  const cellBg: SceneElement[] = [];
  const cellContent: SceneElement[] = [];
  const revealSteps: RevealStep[] = [];
  // Track text bounding rects so cross-link labels can avoid them
  const textOccupied: Array<{ x: number; y: number; width: number; height: number }> = [];
  // Track cell border edges as thin obstacles so connectors don't run along cell walls
  const cellBorders: Array<{ x: number; y: number; width: number; height: number }> = [];
  // Full cell bounding boxes keyed by cell ID — used by the cross-link router
  // to treat intermediate cells as blocked zones (routes must use corridors).
  const cellRects = new Map<string, { x: number; y: number; width: number; height: number }>();
  // Occupied ports from all child diagram layout passes (intra-diagram edges).
  const allOccupiedPorts: OccupiedPort[] = [];

  if (ir.metadata.title) {
    headerElements.push({
      type: 'text',
      content: ir.metadata.title,
      position: { x: padding, y: padding + typography.titleFontSize },
      fontSize: typography.titleFontSize + 2,
      fontFamily: typography.fontFamily,
      fontWeight: 'bold',
      fill: palette.text,
    });
    // Estimate title bounding rect
    const titleW = ir.metadata.title.length * (typography.titleFontSize + 2) * 0.6;
    const titleH = typography.titleFontSize + 2;
    textOccupied.push({ x: padding, y: padding, width: titleW, height: titleH + 4 });
  }

  // ── Build anchor registry (hierarchical, path-prefixed) ───────────────────
  const mergedAnchors: Record<string, NodeAnchor> = {};

  for (const { cell, cellTheme, result } of cellResults) {
    const cellPalette = cellTheme.palette;
    const col = cell.col ?? 0;
    const row = cell.row ?? 0;
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;
    const cellId = cell.id ?? cellAddressFromPosition(row, col);

    const cellX = padding + sumWithGaps(colWidths, 0, col, gap);
    const cellY = padding + headerH + sumWithGaps(rowHeights, 0, row, gap);
    const cellW = sumWithGaps(colWidths, col, col + colSpan, gap) - gap;
    const cellH = sumWithGaps(rowHeights, row, row + rowSpan, gap) - gap;

    // Cell chrome — background layer (connectors route behind this).
    // Uses the CELL's theme so a dark-themed cell shows a dark panel.
    cellBg.push({
      type: 'rect',
      bounds: { x: cellX, y: cellY, width: cellW, height: cellH },
      fill: cellPalette.background,
      stroke: cellPalette.border,
      strokeWidth: 1,
      rx: 6,
    });

    // Record cell edges as thin obstacles (4px) so connectors avoid running along borders
    const borderThick = 4;
    cellBorders.push(
      { x: cellX, y: cellY - borderThick / 2, width: cellW, height: borderThick }, // top edge
      { x: cellX, y: cellY + cellH - borderThick / 2, width: cellW, height: borderThick }, // bottom edge
      { x: cellX - borderThick / 2, y: cellY, width: borderThick, height: cellH }, // left edge
      { x: cellX + cellW - borderThick / 2, y: cellY, width: borderThick, height: cellH }, // right edge
    );
    // Record the full cell bounding box for corridor-based cross-link routing.
    cellRects.set(cellId, { x: cellX, y: cellY, width: cellW, height: cellH });

    const reservedTop = cell.title ? reservedTitleHeight(cellTheme, cell.title) : 0;
    if (cell.title) {
      const t = buildCellTitle(cell.title, cellX, cellY, cellW, cellTheme);
      cellContent.push(...t.elements);
      textOccupied.push(t.occupied);
    }

    // Embed child scene — content layer (above cross-link paths)
    const inset = unit / 2;
    const captionH = cell.caption ? reservedCaptionHeight(cellTheme) : 0;
    const contentRect: Rect = {
      x: cellX + inset,
      y: cellY + reservedTop + inset,
      width: cellW - inset * 2,
      height: cellH - reservedTop - captionH - inset * 2,
    };

    const scaleX = contentRect.width / Math.max(result.scene.viewBox.width, 1);
    const scaleY = contentRect.height / Math.max(result.scene.viewBox.height, 1);
    const localScale = Math.min(scaleX, scaleY, 1);
    const scale =
      cell.content.kind === 'diagram' && globalScale !== undefined ? globalScale : localScale;
    const offsetX = contentRect.x + (contentRect.width - result.scene.viewBox.width * scale) / 2;
    const offsetY = contentRect.y + (contentRect.height - result.scene.viewBox.height * scale) / 2;

    let childScene = result.scene;
    if (result.reveal?.steps.length) {
      const prefixIds = (ids: readonly string[]) => ids.map(id => `${cellId}.${id}`);
      const prefixGroups = (element: SceneElement): SceneElement => element.type === 'group'
        ? { ...element, ...(element.id ? { id: `${cellId}.${element.id}` } : {}), children: element.children.map(prefixGroups) }
        : element;
      childScene = { ...result.scene, elements: result.scene.elements.map(prefixGroups) };
      for (const step of result.reveal.steps) {
        revealSteps.push({
          ...step,
          index: revealSteps.length + 1,
          enter: prefixIds(step.enter),
          ...(step.emphasize ? { emphasize: prefixIds(step.emphasize) } : {}),
          ...(step.exit ? { exit: prefixIds(step.exit) } : {}),
        });
      }
    }
    cellContent.push(embedScene(childScene, contentRect, scale));

    // Caption — muted text below the sub-diagram
    if (cell.caption) {
      const captionY = cellY + cellH - inset / 2;
      cellContent.push({
        type: 'text',
        content: cell.caption,
        position: { x: cellX + cellW / 2, y: captionY },
        fontSize: cellTheme.typography.smallFontSize,
        fontFamily: cellTheme.typography.fontFamily,
        fill: cellTheme.palette.textMuted,
        anchor: 'middle',
      });
    }

    // Notes — freeform annotation overlays on top of the sub-diagram
    if (cell.notes && cell.notes.length > 0) {
      for (const note of cell.notes) {
        cellContent.push(...buildNoteOverlay(note, contentRect, cellTheme));
      }
    }

    // Transform child anchors to poster coordinates and merge
    for (const [nodeId, anchor] of Object.entries(result.anchors)) {
      const prefixedId = `${cellId}.${nodeId}`;
      const transformed: NodeAnchor = {
        bounds: {
          x: anchor.bounds.x * scale + offsetX,
          y: anchor.bounds.y * scale + offsetY,
          width: anchor.bounds.width * scale,
          height: anchor.bounds.height * scale,
        },
        ...(anchor.ports
          ? {
              ports: Object.fromEntries(
                Object.entries(anchor.ports).map(([side, pt]) => [
                  side,
                  { x: pt!.x * scale + offsetX, y: pt!.y * scale + offsetY },
                ]),
              ),
            }
          : {}),
      };
      mergedAnchors[prefixedId] = transformed;
    }

    // Collect occupied ports from child layout (t values are coordinate-invariant).
    for (const op of result.occupiedPorts ?? []) {
      allOccupiedPorts.push({ ...op, nodeKey: `${cellId}.${op.nodeKey}` });
    }

    // Collect chrome rects (e.g. internal header bars) and transform them to
    // poster coordinates so the cross-link label de-collision pass can avoid them.
    for (const cr of result.chromeRects ?? []) {
      textOccupied.push({
        x: cr.x * scale + offsetX,
        y: cr.y * scale + offsetY,
        width: cr.width * scale,
        height: cr.height * scale,
      });
    }
  }

  const totalW = padding * 2 + sumWithGaps(colWidths, 0, grid.columns, gap) - gap;
  const totalH = padding * 2 + headerH + sumWithGaps(rowHeights, 0, numRows, gap) - gap;

  // Collect defs from all child scenes (e.g. arrow markers)
  const allDefs: string[] = [];
  const seenDefs = new Set<string>();
  for (const { result } of cellResults) {
    if (result.scene.defs) {
      for (const def of result.scene.defs) {
        if (!seenDefs.has(def)) {
          seenDefs.add(def);
          allDefs.push(def);
        }
      }
    }
  }

  // ─── Cross-Link Resolution & Rendering ──────────────────────────────────
  const links = normalizeElementIndexLinks(ir.links ?? [], cellResultById);

  // Start with the grid dimensions; cross-link rendering may expand these.
  let finalW = totalW;
  let finalH = totalH;

  if (links.length > 0) {
    const connectorSpecs = crossLinksToConnectorSpecs(
      links.map((link) => {
        const explicitCurve =
          link.curveStyle ??
          (typeof link.props?.curveStyle === 'string'
            ? (link.props.curveStyle as import('../../../contracts/routing.js').CurveStyle)
            : undefined);
        return explicitCurve ? link : { ...link, curveStyle: 'cardinal' as const };
      }),
    );
    const connectorResult = routeConnectors({
      anchors: mergedAnchors,
      connectors: connectorSpecs,
      theme,
      occupiedPorts: allOccupiedPorts,
      occupiedTextRects: textOccupied,
      routingObstacles: cellBorders,
      containerObstacles: cellRects,
    });
    const linkDefs = connectorResult.defs;
    const linkElements = connectorResult.elements;

    // Add link defs
    for (const def of linkDefs) {
      if (!seenDefs.has(def)) {
        seenDefs.add(def);
        allDefs.push(def);
      }
    }

    // Split link elements: paths go behind cell content, labels go on top.
    const linkPaths = linkElements.filter((e) => e.type !== 'text');
    const linkLabels = linkElements.filter((e) => e.type === 'text');

    // Expand the viewBox to include all cross-link route and label extents.
    const ext = connectorResult.extents;
    if (ext.maxX > finalW) finalW = ext.maxX + padding;
    if (ext.maxY > finalH) finalH = ext.maxY + padding;

    // Assemble in painter's order (back → front):
    //   header → cell backgrounds → link routes → cell content → link labels
    const elements: SceneElement[] = [
      ...headerElements,
      ...cellBg,
      ...linkPaths,
      ...cellContent,
      ...linkLabels,
    ];

    return {
      scene: {
        viewBox: { x: 0, y: 0, width: finalW, height: finalH },
        background: palette.background,
        elements,
        ...(allDefs.length > 0 ? { defs: allDefs } : {}),
      },
      anchors: mergedAnchors,
      ...(revealSteps.length > 0 ? { reveal: { steps: revealSteps } } : {}),
    };
  }

  // No cross-links (or none resolved): flat assembly without link layers.
  const elements: SceneElement[] = [...headerElements, ...cellBg, ...cellContent];

  return {
    scene: {
      viewBox: { x: 0, y: 0, width: finalW, height: finalH },
      background: palette.background,
      elements,
      ...(allDefs.length > 0 ? { defs: allDefs } : {}),
    },
    anchors: mergedAnchors,
    ...(revealSteps.length > 0 ? { reveal: { steps: revealSteps } } : {}),
  };
}

function normalizeElementIndexLinks(
  links: readonly CrossLink[],
  cellResultById: ReadonlyMap<string, { cell: PosterCell; result: LayoutResult }>,
): CrossLink[] {
  return links.map((link) => ({
    ...link,
    from: normalizeElementIndexAddress(link.from, cellResultById),
    to: normalizeElementIndexAddress(link.to, cellResultById),
  }));
}

function normalizeElementIndexAddress(
  address: NodeAddress,
  cellResultById: ReadonlyMap<string, { cell: PosterCell; result: LayoutResult }>,
): NodeAddress {
  if (address.elementIndex === undefined) return address;

  const cellId = address.cellPath.join('.');
  const cellResult = cellResultById.get(cellId);
  const content = cellResult?.cell.content;
  const arrayNodeId =
    content?.kind === 'diagram' && content.diagramKind === 'array'
      ? resolveArrayElementAnchorId(content.doc as any, address.elementIndex)
      : fallbackElementAnchorId(cellResult?.result.anchors ?? {}, address.elementIndex);

  return {
    ...address,
    nodeId: arrayNodeId ?? `__missing_element_${address.elementIndex}`,
  };
}

function fallbackElementAnchorId(
  anchors: NodeAnchorRegistry,
  elementIndex: number,
): string | undefined {
  if (elementIndex < 0) {
    if (elementIndex === -1 && anchors.clast) return 'clast';
    return undefined;
  }
  return anchors[`c${elementIndex}`] ? `c${elementIndex}` : undefined;
}

/**
 * Compute the rightmost and bottommost extents across all cross-link
 * scene elements (paths and text labels).
 *
 * For paths: extract all numeric coordinates from the SVG path `d` string.
 *   Taking the max of all numbers over-approximates bezier control-point
 *   extents, but that is safe (never under-estimates) and keeps the logic
 *   simple without a full bezier bounding-box solver.
 *
 * For text: use the anchor position plus an estimated character-width.
 */
function crossLinkExtents(elements: readonly SceneElement[]): { maxX: number; maxY: number } {
  let maxX = 0;
  let maxY = 0;

  for (const el of elements) {
    if (el.type === 'path') {
      // Extract all numbers from the path d string in adjacent x,y pairs.
      // This works exactly for M/L commands and safely over-approximates C.
      const nums: number[] = [];
      for (const m of el.d.matchAll(/[-\d.]+/g)) {
        const n = parseFloat(m[0]);
        if (!isNaN(n)) nums.push(n);
      }
      for (let i = 0; i + 1 < nums.length; i += 2) {
        maxX = Math.max(maxX, nums[i]!);
        maxY = Math.max(maxY, nums[i + 1]!);
      }
    } else if (el.type === 'text') {
      const approxW = el.content.length * (el.fontSize ?? 12) * 0.65;
      const right = el.anchor === 'middle' ? el.position.x + approxW / 2 : el.position.x + approxW;
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, el.position.y + (el.fontSize ?? 12));
    }
  }

  return { maxX, maxY };
}

// ─── Cell Content Dispatch ────────────────────────────────────────────────────

function layoutCellContent(content: CellContent, theme: ResolvedTheme): LayoutResult {
  const { palette, typography, spacing } = theme;
  const unit = spacing.unit;
  const pad = spacing.nodePadding;

  switch (content.kind) {
    case 'diagram': {
      const module = getModule(content.diagramKind);
      if (!module) {
        const w = unit * 20;
        const h = typography.baseFontSize + pad * 2;
        return {
          scene: {
            viewBox: { x: 0, y: 0, width: w, height: h },
            elements: [
              {
                type: 'text',
                content: `[${content.diagramKind}]`,
                position: { x: pad, y: pad + typography.baseFontSize * 0.8 },
                fontSize: typography.baseFontSize,
                fontFamily: typography.fontFamily,
                fill: palette.textMuted,
              },
            ],
          },
          anchors: {},
        };
      }
      return module.layout(content.doc, theme);
    }
    case 'text': {
      // Approximate width: ~8px per character at baseFontSize, with min/max
      const estCharW = typography.baseFontSize * 0.6;
      const textW = Math.max(
        unit * 10,
        Math.min(unit * 30, content.text.length * estCharW + pad * 2),
      );
      const textH = typography.baseFontSize * typography.lineHeight + pad * 2;
      return {
        scene: {
          viewBox: { x: 0, y: 0, width: textW, height: textH },
          elements: [
            {
              type: 'text',
              content: content.text,
              position: { x: pad, y: pad + typography.baseFontSize * 0.8 },
              fontSize: typography.baseFontSize,
              fontFamily: typography.fontFamily,
              fill: palette.text,
            },
          ],
        },
        anchors: {},
      };
    }
    case 'stat': {
      const valueFontSize = typography.titleFontSize * 1.5;
      const cellW = Math.max(unit * 10, valueFontSize * 3);
      const centerX = cellW / 2;

      const valueY = pad + valueFontSize * 0.8;
      const labelGap = unit;
      const labelY = valueY + labelGap + typography.smallFontSize * 0.8;
      const cellH = content.label
        ? valueY + labelGap + typography.smallFontSize + pad
        : valueY + pad;

      const els: SceneElement[] = [
        {
          type: 'text',
          content: content.value,
          position: { x: centerX, y: valueY },
          fontSize: valueFontSize,
          fontFamily: typography.fontFamily,
          fontWeight: 'bold',
          fill: palette.primary,
          anchor: 'middle',
        },
      ];
      if (content.label) {
        els.push({
          type: 'text',
          content: content.label,
          position: { x: centerX, y: labelY },
          fontSize: typography.smallFontSize,
          fontFamily: typography.fontFamily,
          fill: palette.textMuted,
          anchor: 'middle',
        });
      }
      return {
        scene: { viewBox: { x: 0, y: 0, width: cellW, height: cellH }, elements: els },
        anchors: {},
      };
    }
  }
}

// ─── Scale Mode Resolution ──────────────────────────────────────────────────

export type ScaleModeType = 'contain' | 'uniform' | 'natural' | 'fixed';

export interface ResolvedScaleConfig {
  mode: ScaleModeType;
  fixedScale?: number;
}

export function resolveScaleConfig(
  gridScale?: PosterScaleMode | string,
  metaScale?: unknown,
  metaUniformScale?: unknown,
): ResolvedScaleConfig {
  const raw = gridScale ?? metaScale ?? (metaUniformScale ? 'uniform' : undefined);
  if (
    raw === undefined ||
    raw === null ||
    raw === '' ||
    raw === 'contain' ||
    raw === 'none' ||
    raw === 'false'
  ) {
    return { mode: 'contain' };
  }
  if (typeof raw === 'number') {
    return raw === 1 ? { mode: 'natural' } : { mode: 'fixed', fixedScale: raw };
  }
  if (typeof raw === 'boolean') {
    return raw ? { mode: 'uniform' } : { mode: 'contain' };
  }
  const str = String(raw).trim().toLowerCase();
  if (str === 'natural' || str === '1' || str === '1.0' || str === '100%') {
    return { mode: 'natural' };
  }
  if (str === 'uniform' || str === 'homologate' || str === 'true' || str === 'same') {
    return { mode: 'uniform' };
  }
  if (str === 'contain' || str === 'independent' || str === 'fit') {
    return { mode: 'contain' };
  }
  const parsedNum = parseFloat(str.endsWith('%') ? str.slice(0, -1) : str);
  if (!isNaN(parsedNum) && parsedNum > 0) {
    const val = str.endsWith('%') ? parsedNum / 100 : parsedNum;
    return val === 1 ? { mode: 'natural' } : { mode: 'fixed', fixedScale: val };
  }
  return { mode: 'contain' };
}

// ─── Scene Embedding ─────────────────────────────────────────────────────────

function embedScene(scene: Scene, into: Rect, overrideScale?: number): SceneElement {
  const scaleX = into.width / Math.max(scene.viewBox.width, 1);
  const scaleY = into.height / Math.max(scene.viewBox.height, 1);
  const scale = overrideScale !== undefined ? overrideScale : Math.min(scaleX, scaleY, 1);

  // Centre within the cell
  const offsetX = into.x + (into.width - scene.viewBox.width * scale) / 2;
  const offsetY = into.y + (into.height - scene.viewBox.height * scale) / 2;

  return {
    type: 'group',
    transform: `translate(${offsetX}, ${offsetY}) scale(${scale})`,
    children: scene.elements as SceneElement[],
  };
}

// ─── Cell Title (theme.panel) ─────────────────────────────────────────────────

/**
 * Parse a cell title into constituent lines, supporting `::` subtitle syntax
 * (Primary Title :: Subtitle) and `<br/>`, `\n`, `\n` line breaks.
 */
export function parseCellTitle(raw: string): Array<{ text: string; isSubtitle: boolean }> {
  const sepIdx = raw.indexOf('::');
  if (sepIdx !== -1) {
    return [
      { text: raw.slice(0, sepIdx).trim(), isSubtitle: false },
      { text: raw.slice(sepIdx + 2).trim(), isSubtitle: true },
    ];
  }
  const parts = raw.split(/<br\s*\/?>|\n|\\n/g).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((p, i) => ({ text: p, isSubtitle: i > 0 }));
  }
  return [{ text: raw.trim(), isSubtitle: false }];
}

/**
 * Interior height a cell must reserve at its top for the title, given the
 * theme's panel placement and title line count. 'above' titles live outside the frame (0 reserved);
 * 'on-border' titles straddle the edge (half reserved); 'inside' titles sit
 * fully within the frame (full reserved).
 */
function reservedTitleHeight(theme: ResolvedTheme, title?: string): number {
  const { spacing, panel } = theme;
  const boxH = titleBoxHeight(theme, title);
  switch (panel.titlePosition) {
    case 'above':
      return 0;
    case 'on-border':
      return boxH / 2 + spacing.unit * 0.5;
    case 'inside':
    default:
      return boxH + spacing.unit * 0.5;
  }
}

function titleBoxHeight(theme: ResolvedTheme, title?: string): number {
  const fs = theme.typography.baseFontSize;
  const padY = theme.panel.titleChrome === 'none' ? 0 : theme.spacing.unit * 0.4;
  if (!title) return fs + padY * 2;
  const lines = parseCellTitle(title);
  if (lines.length <= 1) return fs + padY * 2;
  const subtitleFs = theme.typography.smallFontSize;
  return fs + (lines.length - 1) * (subtitleFs * 1.35) + padY * 2;
}

/** Height reserved at the bottom of a cell for a caption line. */
function reservedCaptionHeight(theme: ResolvedTheme): number {
  return theme.typography.smallFontSize + theme.spacing.unit;
}

/**
 * Build a freeform note overlay anchored to a content rect.
 * Positions: top-left/right, bottom-left/right, center.
 * Renders as a semi-transparent pill behind the text.
 */
function buildNoteOverlay(note: PosterNote, rect: Rect, theme: ResolvedTheme): SceneElement[] {
  const { palette, typography, spacing } = theme;
  const fs = typography.smallFontSize;
  const pad = spacing.unit * 0.5;
  const textW = note.text.length * fs * 0.62 + pad * 2;
  const boxH = fs + pad * 2;
  const pos = note.position ?? 'top-right';

  let bx: number, by: number;
  switch (pos) {
    case 'top-left':
      bx = rect.x + spacing.unit * 0.5;
      by = rect.y + spacing.unit * 0.5;
      break;
    case 'top-right':
      bx = rect.x + rect.width - textW - spacing.unit * 0.5;
      by = rect.y + spacing.unit * 0.5;
      break;
    case 'bottom-left':
      bx = rect.x + spacing.unit * 0.5;
      by = rect.y + rect.height - boxH - spacing.unit * 0.5;
      break;
    case 'bottom-right':
      bx = rect.x + rect.width - textW - spacing.unit * 0.5;
      by = rect.y + rect.height - boxH - spacing.unit * 0.5;
      break;
    case 'center':
      bx = rect.x + (rect.width - textW) / 2;
      by = rect.y + (rect.height - boxH) / 2;
      break;
    default:
      bx = rect.x + rect.width - textW - spacing.unit * 0.5;
      by = rect.y + spacing.unit * 0.5;
  }

  return [
    {
      type: 'rect',
      bounds: { x: bx, y: by, width: textW, height: boxH },
      fill: palette.surface,
      stroke: palette.primary,
      strokeWidth: 1,
      rx: boxH / 2,
      fillOpacity: 0.88,
    },
    {
      type: 'text',
      content: note.text,
      position: { x: bx + textW / 2, y: by + pad + fs * 0.8 },
      fontSize: fs,
      fontFamily: typography.fontFamily,
      fontWeight: 'bold',
      fill: palette.primary,
      anchor: 'middle',
    },
  ];
}

/**
 * Build the SceneElements for a cell title (optional chrome rect + text),
 * honouring the theme's panel alignment / vertical position / chrome.
 * Supports multi-line and `::` subtitle hierarchy.
 */
function buildCellTitle(
  title: string,
  cellX: number,
  cellY: number,
  cellW: number,
  theme: ResolvedTheme,
): { elements: SceneElement[]; occupied: Rect } {
  const { palette, typography, panel, spacing } = theme;
  const unit = spacing.unit;
  const fs = typography.baseFontSize;
  const smallFs = typography.smallFontSize;

  const padX = panel.titleChrome === 'none' ? 0 : unit * 0.75;
  const padY = panel.titleChrome === 'none' ? 0 : unit * 0.4;
  const lines = parseCellTitle(title);

  // Measure max width across all title lines
  const maxTw = Math.max(
    ...lines.map((l) => measureText(l.text, l.isSubtitle ? smallFs : fs).width),
  );
  const boxW = maxTw + padX * 2;
  const lineSpacing = smallFs * 1.35;
  const boxH =
    lines.length <= 1 ? fs + padY * 2 : fs + (lines.length - 1) * lineSpacing + padY * 2;
  const wall = unit; // inset of the title from the left/right wall

  // Horizontal: box origin + text anchor point.
  let boxX: number;
  let anchorX: number;
  let anchor: 'start' | 'middle' | 'end';
  if (panel.titleAlign === 'center') {
    boxX = cellX + cellW / 2 - boxW / 2;
    anchorX = cellX + cellW / 2;
    anchor = 'middle';
  } else if (panel.titleAlign === 'right') {
    boxX = cellX + cellW - wall - boxW;
    anchorX = boxX + boxW - padX;
    anchor = 'end';
  } else {
    boxX = cellX + wall;
    anchorX = boxX + padX;
    anchor = 'start';
  }

  // Vertical: top of the chrome box relative to the cell's top edge.
  let boxTop: number;
  if (panel.titlePosition === 'on-border') {
    boxTop = cellY - boxH / 2;
  } else if (panel.titlePosition === 'above') {
    boxTop = cellY - boxH - unit * 0.25;
  } else {
    boxTop = cellY + unit * 0.5;
  }

  const elements: SceneElement[] = [];
  if (panel.titleChrome !== 'none') {
    const rx = panel.titleChrome === 'pill' ? boxH / 2 : Math.min(6, boxH / 3);
    elements.push({
      type: 'rect',
      bounds: { x: boxX, y: boxTop, width: boxW, height: boxH },
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
      rx,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineFs = line.isSubtitle ? smallFs : fs;
    const lineBaselineY = boxTop + padY + fs * 0.8 + i * lineSpacing;
    elements.push({
      type: 'text',
      content: line.text,
      position: { x: anchorX, y: lineBaselineY },
      fontSize: lineFs,
      fontFamily: typography.fontFamily,
      fontWeight: line.isSubtitle ? 'normal' : 'bold',
      fill: line.isSubtitle ? palette.textMuted : palette.text,
      anchor,
    });
  }

  return { elements, occupied: { x: boxX, y: boxTop, width: boxW, height: boxH } };
}

// ─── Grid Helpers ─────────────────────────────────────────────────────────────

/** Grid placement: assigns row/col to each cell, reserving spanned cells so
 *  later cells skip slots already covered by a colSpan/rowSpan. Exported for tests. */
export function assignPositions(cells: readonly PosterCell[], columns: number): PosterCell[] {
  const occupied = new Set<string>();
  const key = (r: number, c: number): string => `${r},${c}`;
  const mark = (r: number, c: number, rs: number, cs: number): void => {
    for (let rr = r; rr < r + rs; rr++)
      for (let cc = c; cc < c + cs; cc++) occupied.add(key(rr, cc));
  };
  const fits = (r: number, c: number, rs: number, cs: number): boolean => {
    if (c + cs > columns) return false;
    for (let rr = r; rr < r + rs; rr++)
      for (let cc = c; cc < c + cs; cc++) if (occupied.has(key(rr, cc))) return false;
    return true;
  };

  let row = 0,
    col = 0;
  return cells.map((cell) => {
    const cs = Math.min(cell.colSpan ?? 1, columns);
    const rs = cell.rowSpan ?? 1;
    // Explicitly placed cells are honoured as-is, but still reserve their footprint.
    if (cell.row !== undefined && cell.col !== undefined) {
      mark(cell.row, cell.col, rs, cs);
      return cell;
    }
    // Scan row-major for the first free slot whose full span fits.
    while (!fits(row, col, rs, cs)) {
      col++;
      if (col >= columns) {
        col = 0;
        row++;
      }
    }
    const assigned = { ...cell, row, col };
    mark(row, col, rs, cs);
    col += cs;
    if (col >= columns) {
      col = 0;
      row++;
    }
    return assigned;
  });
}

/** Sum widths/heights from index `start` (inclusive) to `end` (exclusive) with gaps. */
function sumWithGaps(sizes: number[], start: number, end: number, gap: number): number {
  let total = 0;
  for (let i = start; i < end; i++) total += (sizes[i] ?? 0) + gap;
  return total;
}

/**
 * Generate an Excel-style cell address from row/col indices.
 * col 0 → "A", col 1 → "B", ..., col 25 → "Z", col 26 → "AA"
 * Row is 1-indexed in the output: row 0 → "1".
 */
function cellAddressFromPosition(row: number, col: number): string {
  let addr = '';
  let c = col;
  do {
    addr = String.fromCharCode(65 + (c % 26)) + addr;
    c = Math.floor(c / 26) - 1;
  } while (c >= 0);
  return `${addr}${row + 1}`;
}
