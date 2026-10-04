import type {
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchor,
  Point,
  Rect,
} from '../../../contracts/index.js';
import type {
  PlatformDocument,
  PlatformTier,
  PlatformBox,
  PlatformCard,
  PlatformBus,
} from './ir.js';
import { pen } from '../../../scene/build.js';
import { isDarkTheme } from '../../../theme/contrast.js';
import { defaultTheme } from '../../../theme/preset.js';

interface PlacedNode {
  readonly id: string;
  readonly bounds: Rect;
  readonly center: Point;
  readonly left: Point;
  readonly right: Point;
  readonly top: Point;
  readonly bottom: Point;
}

interface PlatformColors {
  readonly isDark: boolean;
  readonly isMono: boolean;
  readonly canvasBg: string;
  readonly dotColor: string;
  readonly dotOpacity: number;
  readonly figureText: string;
  readonly titleText: string;
  readonly descText: string;
  readonly tierTitle: string;
  readonly primaryText: string;
  readonly secondaryText: string;
  readonly habitatBg: string;
  readonly habitatBorder: string;
  readonly habitatTitle: string;
  readonly cdcBg: string;
  readonly cdcBorder: string;
  readonly cardBg: string;
  readonly cardBorder: string;
  readonly cardTitle: string;
  readonly cardSubtitle: string;
  readonly cardIcon: string;
  readonly gridCellBg: string;
  readonly gridCellBorder: string;
  readonly routingBg: string;
  readonly routingBorder: string;
  readonly routingTitle: string;
  readonly routingSubtitle: string;
  readonly busLine: string;
  readonly busLineWidth: number;
  readonly pauseBg: string;
  readonly pauseBorder: string;
  readonly pauseText: string;
}

function resolvePlatformColors(theme: ResolvedTheme): PlatformColors {
  const name = theme.name;
  const isDark = name === 'bw-dark' || name === 'dark' || name === 'midnight' || isDarkTheme(theme);
  const isMono = name === 'bw-light' || name === 'bw-dark' || name === 'bw' || name === 'minimal';
  const p = theme.palette;

  if (name === 'bw-dark') {
    return {
      isDark: true,
      isMono: true,
      canvasBg: '#171717',
      dotColor: '#3F3F3F',
      dotOpacity: 0.6,
      figureText: '#A3A3A3',
      titleText: '#FAFAFA',
      descText: '#D4D4D4',
      tierTitle: '#FAFAFA',
      primaryText: '#FAFAFA',
      secondaryText: '#A3A3A3',
      habitatBg: '#1E1E1E',
      habitatBorder: '#FAFAFA',
      habitatTitle: '#FAFAFA',
      cdcBg: '#262626',
      cdcBorder: '#FAFAFA',
      cardBg: '#262626',
      cardBorder: '#FAFAFA',
      cardTitle: '#FAFAFA',
      cardSubtitle: '#A3A3A3',
      cardIcon: '#FAFAFA',
      gridCellBg: '#2A2A2A',
      gridCellBorder: '#737373',
      routingBg: '#333333',
      routingBorder: '#FAFAFA',
      routingTitle: '#FAFAFA',
      routingSubtitle: '#D4D4D4',
      busLine: '#FAFAFA',
      busLineWidth: 1.8,
      pauseBg: '#262626',
      pauseBorder: '#FAFAFA',
      pauseText: '#FAFAFA',
    };
  }

  if (name === 'bw-light' || name === 'bw') {
    return {
      isDark: false,
      isMono: true,
      canvasBg: '#FFFFFF',
      dotColor: '#D4D4D4',
      dotOpacity: 0.7,
      figureText: '#737373',
      titleText: '#171717',
      descText: '#525252',
      tierTitle: '#171717',
      primaryText: '#171717',
      secondaryText: '#737373',
      habitatBg: '#FAFAFA',
      habitatBorder: '#171717',
      habitatTitle: '#171717',
      cdcBg: '#FFFFFF',
      cdcBorder: '#171717',
      cardBg: '#FFFFFF',
      cardBorder: '#171717',
      cardTitle: '#171717',
      cardSubtitle: '#525252',
      cardIcon: '#171717',
      gridCellBg: '#FFFFFF',
      gridCellBorder: '#525252',
      routingBg: '#171717',
      routingBorder: '#000000',
      routingTitle: '#FFFFFF',
      routingSubtitle: '#D4D4D4',
      busLine: '#171717',
      busLineWidth: 1.8,
      pauseBg: '#FFFFFF',
      pauseBorder: '#171717',
      pauseText: '#171717',
    };
  }

  if (isDark) {
    return {
      isDark: true,
      isMono: false,
      canvasBg: p.background || '#121212',
      dotColor: '#383838',
      dotOpacity: 0.5,
      figureText: p.textMuted || '#94A3B8',
      titleText: p.text || '#F8FAFC',
      descText: p.text || '#E2E8F0',
      tierTitle: p.text || '#F8FAFC',
      primaryText: p.text || '#F8FAFC',
      secondaryText: p.textMuted || '#94A3B8',
      habitatBg: p.surface || '#1E293B',
      habitatBorder: p.border || '#475569',
      habitatTitle: p.text || '#F8FAFC',
      cdcBg: p.surface || '#1E293B',
      cdcBorder: p.border || '#475569',
      cardBg: p.surface || '#1E293B',
      cardBorder: p.border || '#475569',
      cardTitle: p.text || '#F8FAFC',
      cardSubtitle: p.textMuted || '#94A3B8',
      cardIcon: p.text || '#F8FAFC',
      gridCellBg: '#0F172A',
      gridCellBorder: p.border || '#334155',
      routingBg: '#0F172A',
      routingBorder: p.border || '#475569',
      routingTitle: p.text || '#F8FAFC',
      routingSubtitle: p.textMuted || '#94A3B8',
      busLine: p.primary || '#94A3B8',
      busLineWidth: 1.6,
      pauseBg: p.surface || '#1E293B',
      pauseBorder: p.border || '#475569',
      pauseText: p.text || '#F8FAFC',
    };
  }

  return {
    isDark: false,
    isMono: false,
    canvasBg: p.background || '#FFFFFF',
    dotColor: '#CBD5E1',
    dotOpacity: 0.8,
    figureText: p.textMuted || '#64748B',
    titleText: p.text || '#0F172A',
    descText: p.textMuted || '#475569',
    tierTitle: p.text || '#0F172A',
    primaryText: p.text || '#0F172A',
    secondaryText: p.textMuted || '#64748B',
    habitatBg: '#FFFFFF',
    habitatBorder: p.border || '#0F172A',
    habitatTitle: p.text || '#0F172A',
    cdcBg: '#FFFFFF',
    cdcBorder: p.border || '#0F172A',
    cardBg: '#FFFFFF',
    cardBorder: p.border || '#0F172A',
    cardTitle: p.text || '#0F172A',
    cardSubtitle: p.textMuted || '#64748B',
    cardIcon: p.text || '#0F172A',
    gridCellBg: '#FFFFFF',
    gridCellBorder: '#334155',
    routingBg: '#FFFFFF',
    routingBorder: '#334155',
    routingTitle: p.text || '#0F172A',
    routingSubtitle: p.textMuted || '#64748B',
    busLine: '#334155',
    busLineWidth: 1.6,
    pauseBg: '#FFFFFF',
    pauseBorder: p.border || '#0F172A',
    pauseText: p.text || '#0F172A',
  };
}

export function layoutPlatform(
  doc: PlatformDocument,
  theme: ResolvedTheme = defaultTheme,
): LayoutResult {
  const p = pen(theme);
  const colors = resolvePlatformColors(theme);
  const elements: SceneElement[] = [];
  const defs: string[] = [];
  const anchors: Record<string, NodeAnchor> = {};

  // Add dot-matrix grid definition
  defs.push(
    `<pattern id="platform-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="${colors.dotColor}" opacity="${colors.dotOpacity}"/></pattern>`,
  );

  const numTiers = doc.tiers.length;
  const tierWidths: number[] = doc.tiers.map((t) => {
    const boxes = t.items.filter(
      (it): it is PlatformBox => 'grid' in it || 'branch' in it || 'cards' in it,
    );
    const simpleCards = t.items.filter(
      (it): it is PlatformCard => !('grid' in it) && !('branch' in it) && !('cards' in it),
    );

    if (boxes.length === 0) {
      const hasSubtitle = simpleCards.some((c) => !!c.subtitle);
      return hasSubtitle ? 210 : 195;
    }
    let maxBoxW = 0;
    for (const b of boxes) {
      if (b.grid) {
        const cols = b.grid.columns || 3;
        const cellW = cols === 2 ? 200 : cols >= 3 ? 195 : 180;
        const bw = cols * cellW + (cols - 1) * 12 + 32;
        maxBoxW = Math.max(maxBoxW, bw >= 600 ? 660 : bw);
      }
      if (b.branch) {
        const bCards = b.branch.cards;
        const bW = 136;
        const bGap = 14;
        const totalBW = bCards.length * bW + (bCards.length - 1) * bGap + 32;
        maxBoxW = Math.max(maxBoxW, totalBW >= 600 ? 660 : totalBW);
      }
      if (!b.grid && !b.branch) {
        maxBoxW = Math.max(maxBoxW, 260);
      }
    }
    return Math.max(maxBoxW, 240);
  });

  const isHabitatProfile =
    numTiers === 3 && tierWidths[0] === 195 && tierWidths[1] === 660 && tierWidths[2] === 210;
  const colXs: number[] = [];
  let curColX = 50;
  for (let i = 0; i < numTiers; i++) {
    colXs.push(curColX);
    const gutter = isHabitatProfile ? (i === 0 ? 105 : 100) : 110;
    curColX += tierWidths[i]! + gutter;
  }

  const canvasW = isHabitatProfile ? 1380 : Math.max(1200, curColX - 60);

  // Compute dynamic canvas height based on contents
  const tierY = 175;
  let maxTierBottom = 720;
  for (const t of doc.tiers) {
    const boxes = t.items.filter(
      (it): it is PlatformBox => 'grid' in it || 'branch' in it || 'cards' in it,
    );
    const simpleCards = t.items.filter(
      (it): it is PlatformCard => !('grid' in it) && !('branch' in it) && !('cards' in it),
    );
    let curY = tierY + 24;
    if (simpleCards.length > 0 && boxes.length === 0) {
      const cardH = simpleCards.some((c) => !!c.subtitle) ? 54 : 46;
      curY += simpleCards.length * (cardH + 14);
    }
    for (const b of boxes) {
      if (b.grid) {
        const cols = b.grid.columns || 3;
        const rows = Math.ceil(b.grid.cards.length / cols);
        const gridH = rows > 0 ? rows * 56 + (rows - 1) * 10 : 0;
        const routing = (b.cards ?? []).find((c) => c.id === 'routing') ?? b.cards?.[0];
        const boxH = Math.max(160, 36 + gridH + (routing ? 70 : 0) + 16);
        curY += boxH + 20;
      }
      if (b.branch || b.id === 'cdc') {
        curY = Math.max(curY, isHabitatProfile ? tierY + 310 : curY + 10) + 150;
      }
    }
    maxTierBottom = Math.max(maxTierBottom, curY);
  }
  const canvasH = isHabitatProfile ? 780 : Math.max(780, maxTierBottom + 60);

  // Background with dot pattern
  if (theme.palette.background !== '') {
    elements.push({
      type: 'rect',
      bounds: { x: 0, y: 0, width: canvasW, height: canvasH },
      fill: colors.canvasBg,
      stroke: 'none',
      strokeWidth: 0,
    });
  }

  elements.push({
    type: 'rect',
    bounds: { x: 0, y: 0, width: canvasW, height: canvasH },
    fill: 'url(#platform-dots)',
    stroke: 'none',
    strokeWidth: 0,
  });

  // ─── Header ─────────────────────────────────────────────────────────────────
  let curY = 40;

  if (doc.figure) {
    elements.push(
      p.text(doc.figure.toUpperCase(), 50, curY, 11, colors.figureText, { weight: 'bold' }),
    );
    curY += 26;
  }

  if (doc.title) {
    elements.push(p.text(doc.title, 50, curY + 6, 22, colors.titleText, { weight: 'bold' }));
    curY += 32;
  }

  if (doc.desc) {
    elements.push(p.text(doc.desc, 50, curY + 4, 13, colors.descText));
    curY += 28;
  }

  // Pause button badge (Top right)
  const btnX = canvasW - 130;
  const btnY = 36;
  elements.push(
    p.rect({ x: btnX, y: btnY, width: 80, height: 28 }, colors.pauseBg, colors.pauseBorder, 1.5, {
      rx: 6,
    }),
  );
  elements.push(
    p.rect(
      { x: btnX + 16, y: btnY + 9, width: 2.5, height: 10 },
      colors.pauseText,
      colors.pauseText,
      0,
    ),
  );
  elements.push(
    p.rect(
      { x: btnX + 21, y: btnY + 9, width: 2.5, height: 10 },
      colors.pauseText,
      colors.pauseText,
      0,
    ),
  );
  elements.push(
    p.text('Pause', btnX + 48, btnY + 18, 12, colors.pauseText, {
      weight: 'bold',
      anchor: 'middle',
    }),
  );

  // Legend (Requests, Responses, Changes)
  if (doc.legend && doc.legend.length > 0) {
    let legX = 50;
    const legY = curY + 8;
    for (const item of doc.legend) {
      if (item.shape === 'square') {
        const stroke = colors.isDark ? '#93c5fd' : '#1d4ed8';
        elements.push(
          p.rect({ x: legX, y: legY - 8, width: 10, height: 10 }, item.color, stroke, 1.2, {
            rx: 1.5,
          }),
        );
      } else if (item.shape === 'circle') {
        const stroke = colors.isDark ? '#a7f3d0' : '#047857';
        elements.push(p.circle({ x: legX + 5, y: legY - 3 }, 5, item.color, stroke, 1.2));
      } else if (item.shape === 'diamond') {
        const stroke = colors.isDark ? '#ddd6fe' : '#6d28d9';
        elements.push(
          p.path(
            `M ${legX + 5} ${legY - 9} L ${legX + 10} ${legY - 3} L ${legX + 5} ${legY + 3} L ${legX} ${legY - 3} Z`,
            stroke,
            1.2,
            { fill: item.color },
          ),
        );
      }
      elements.push(
        p.text(item.label, legX + 16, legY, 11.5, colors.primaryText, { weight: 'bold' }),
      );
      legX += 130;
    }
  }

  // ─── Tiers & Node Placement ─────────────────────────────────────────────────
  const nodeMap = new Map<string, PlacedNode>();

  function registerPlacedNode(id: string, bounds: Rect) {
    const node: PlacedNode = {
      id,
      bounds,
      center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      left: { x: bounds.x, y: bounds.y + bounds.height / 2 },
      right: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      top: { x: bounds.x + bounds.width / 2, y: bounds.y },
      bottom: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    };
    nodeMap.set(id, node);
    anchors[id] = {
      bounds,
      ports: {
        N: node.top,
        S: node.bottom,
        E: node.right,
        W: node.left,
      },
    };
    return node;
  }

  // ─── Tiers & Node Placement ─────────────────────────────────────────────────
  const tierCardMap = new Map<string, PlacedNode[]>();

  interface TierLayoutInfo {
    tier: PlatformTier;
    colX: number;
    colW: number;
    simpleCards: PlatformCard[];
    boxes: PlatformBox[];
  }

  const tierInfos: TierLayoutInfo[] = doc.tiers.map((t, i) => ({
    tier: t,
    colX: colXs[i] ?? 50,
    colW: tierWidths[i] ?? 200,
    simpleCards: t.items.filter(
      (it): it is PlatformCard => !('grid' in it) && !('branch' in it) && !('cards' in it),
    ),
    boxes: t.items.filter(
      (it): it is PlatformBox => 'grid' in it || 'branch' in it || 'cards' in it,
    ),
  }));

  // 1. Render each tier
  for (const info of tierInfos) {
    const { tier, colX, colW, simpleCards, boxes } = info;
    const cardsList: PlacedNode[] = [];
    tierCardMap.set(tier.id, cardsList);

    elements.push(
      p.text(tier.title.toUpperCase(), colX + colW / 2, tierY, 11, colors.tierTitle, {
        weight: 'bold',
        anchor: 'middle',
      }),
    );

    let curItemY = tierY + 24;

    // Render simple cards
    if (simpleCards.length > 0 && boxes.length === 0) {
      const cardH = simpleCards.some((c) => !!c.subtitle) ? 54 : 46;
      const gap = 14;
      simpleCards.forEach((card, idx) => {
        const y = curItemY + idx * (cardH + gap);
        const b: Rect = { x: colX, y, width: colW, height: cardH };
        const placed = registerPlacedNode(card.id, b);
        registerPlacedNode(`${tier.id}.${card.id}`, b);
        cardsList.push(placed);

        elements.push(p.rect(b, colors.cardBg, colors.cardBorder, 1.5, { rx: 6 }));
        drawIcon(
          elements,
          p,
          card.icon ?? (card.subtitle ? 'database' : 'client'),
          b.x + 12,
          b.y + (card.subtitle ? 18 : 14),
          colors.cardIcon,
        );
        elements.push(
          p.text(
            card.title,
            b.x + 38,
            b.y + (card.subtitle ? 24 : 27),
            card.subtitle ? 12 : 13,
            colors.cardTitle,
            { weight: 'bold' },
          ),
        );
        if (card.subtitle) {
          elements.push(p.text(card.subtitle, b.x + 38, b.y + 40, 10.5, colors.cardSubtitle));
        }
      });
      curItemY += simpleCards.length * (cardH + gap);
    }

    // Render boxes
    for (const box of boxes) {
      if (box.grid) {
        const gridCols = box.grid.columns || 3;
        const colGap = 12;
        const rowGap = 10;
        const cellW = (colW - 32 - (gridCols - 1) * colGap) / gridCols;
        const cellH = 56;
        const gridStartX = colX + 16;
        const gridStartY = curItemY + 36;
        const gridRows = Math.ceil(box.grid.cards.length / gridCols);
        const gridHeight = gridRows > 0 ? gridRows * cellH + (gridRows - 1) * rowGap : 0;

        const routingCard = (box.cards ?? []).find((c) => c.id === 'routing') ?? box.cards?.[0];
        const rH = routingCard ? 54 : 0;
        const routingGap = routingCard ? 16 : 0;
        const boxH =
          isHabitatProfile && gridRows <= 2
            ? 250
            : Math.max(160, 36 + gridHeight + (routingCard ? routingGap + rH : 0) + 16);
        const boxBounds: Rect = { x: colX, y: curItemY, width: colW, height: boxH };
        registerPlacedNode(box.id, boxBounds);
        registerPlacedNode(`${tier.id}.${box.id}`, boxBounds);

        // Outer Habitat Container
        elements.push(p.rect(boxBounds, colors.habitatBg, colors.habitatBorder, 1.8, { rx: 8 }));
        elements.push(
          p.text(box.title, colX + colW / 2, curItemY + 22, 13, colors.habitatTitle, {
            weight: 'bold',
            anchor: 'middle',
          }),
        );

        // Capability Grid
        box.grid.cards.forEach((card, idx) => {
          const col = idx % gridCols;
          const row = Math.floor(idx / gridCols);
          const cx = gridStartX + col * (cellW + colGap);
          const cy = gridStartY + row * (cellH + rowGap);
          const cb: Rect = { x: cx, y: cy, width: cellW, height: cellH };
          const placed = registerPlacedNode(card.id, cb);
          registerPlacedNode(`${box.id}.${card.id}`, cb);
          registerPlacedNode(`${tier.id}.${box.id}.${card.id}`, cb);
          cardsList.push(placed);

          elements.push(p.rect(cb, colors.gridCellBg, colors.gridCellBorder, 1.3, { rx: 6 }));
          elements.push(
            p.text(card.title, cx + 12, cy + 22, 11.5, colors.primaryText, { weight: 'bold' }),
          );
          if (card.subtitle) {
            elements.push(p.text(card.subtitle, cx + 12, cy + 40, 10, colors.secondaryText));
          }
        });

        // Spanning Routing Bar at bottom
        if (routingCard) {
          const rW = colW - 32;
          const rH = 54;
          const rx = colX + 16;
          const ry = curItemY + boxH - rH - 16;
          const rb: Rect = { x: rx, y: ry, width: rW, height: rH };
          const placed = registerPlacedNode(routingCard.id, rb);
          registerPlacedNode(`${box.id}.${routingCard.id}`, rb);
          registerPlacedNode(`${tier.id}.${box.id}.${routingCard.id}`, rb);
          cardsList.push(placed);

          elements.push(p.rect(rb, colors.routingBg, colors.routingBorder, 1.3, { rx: 6 }));
          elements.push(
            p.text(routingCard.title, rx + 16, ry + 22, 12, colors.routingTitle, {
              weight: 'bold',
            }),
          );
          if (routingCard.subtitle) {
            elements.push(
              p.text(routingCard.subtitle, rx + 16, ry + 40, 10.5, colors.routingSubtitle),
            );
          }
        }
        curItemY += boxH + 20;
      } else if (box.branch || box.id === 'cdc') {
        const cdcW = Math.min(230, colW);
        const cdcH = 50;
        const cdcX = colX + (colW - cdcW) / 2;
        const cdcY = isHabitatProfile ? Math.max(curItemY, tierY + 310) : curItemY + 10;
        const cdcBounds: Rect = { x: cdcX, y: cdcY, width: cdcW, height: cdcH };
        const placedBox = registerPlacedNode(box.id, cdcBounds);
        registerPlacedNode(`${tier.id}.${box.id}`, cdcBounds);
        cardsList.push(placedBox);

        elements.push(p.rect(cdcBounds, colors.cdcBg, colors.cdcBorder, 1.5, { rx: 6 }));
        drawIcon(elements, p, box.icon ?? 'cdc', cdcX + 12, cdcY + 16, colors.cardIcon);
        elements.push(
          p.text(box.title, cdcX + 38, cdcY + 22, 12, colors.cardTitle, { weight: 'bold' }),
        );
        if (box.subtitle) {
          elements.push(p.text(box.subtitle, cdcX + 38, cdcY + 38, 10, colors.cardSubtitle));
        }

        // Branch cards
        if (box.branch) {
          const bCards = box.branch.cards;
          const bW = 136;
          const bH = 46;
          const bGap = 14;
          const totalBW = bCards.length * bW + (bCards.length - 1) * bGap;
          const startBX = colX + (colW - totalBW) / 2;
          const bY = cdcY + 90;

          bCards.forEach((card, idx) => {
            const bx = startBX + idx * (bW + bGap);
            const bb: Rect = { x: bx, y: bY, width: bW, height: bH };
            const placed = registerPlacedNode(card.id, bb);
            registerPlacedNode(`${box.id}.${card.id}`, bb);
            registerPlacedNode(`${tier.id}.${box.id}.${card.id}`, bb);
            cardsList.push(placed);

            elements.push(p.rect(bb, colors.cardBg, colors.cardBorder, 1.5, { rx: 6 }));
            drawIcon(elements, p, card.icon ?? card.id, bx + 12, bY + 14, colors.cardIcon);
            elements.push(
              p.text(card.title, bx + 36, bY + 28, 11.5, colors.cardTitle, { weight: 'bold' }),
            );
          });
          curItemY = bY + bH + 20;
        } else {
          curItemY = cdcY + cdcH + 20;
        }
      }
    }
  }

  // ─── Generalized Bus Routing Engine ─────────────────────────────────────────

  function resolveEndpointNodes(spec: string | readonly string[]): PlacedNode[] {
    const list = Array.isArray(spec) ? spec : [spec];
    const out: PlacedNode[] = [];
    for (const item of list) {
      if (tierCardMap.has(item)) {
        out.push(...tierCardMap.get(item)!);
        continue;
      }
      const n = nodeMap.get(item);
      if (n) {
        out.push(n);
        continue;
      }
      for (const [k, v] of nodeMap) {
        if (k.endsWith(`.${item}`)) {
          out.push(v);
          break;
        }
      }
    }
    return out;
  }

  for (const bus of doc.buses) {
    const fromNodes = resolveEndpointNodes(bus.from);
    const toNodes = resolveEndpointNodes(bus.to);
    if (fromNodes.length === 0 || toNodes.length === 0) continue;

    const anim = bus.animation ?? 'stream';
    const isAnim = anim !== 'none';
    const tokenShape = bus.tokenShape ?? doc.legend?.[2]?.shape ?? 'diamond';
    const tokenColor = bus.tokenColor ?? doc.legend?.[2]?.color ?? '#8b5cf6';

    // Case 1: Downstream branch (source node above horizontally aligned target cards)
    const isDownstream =
      fromNodes.length === 1 &&
      toNodes.length > 1 &&
      toNodes.every((t) => t.top.y > fromNodes[0]!.bottom.y);

    if (isDownstream) {
      const src = fromNodes[0]!;
      const srcX = src.bottom.x;
      const bYs = toNodes.map((t) => t.top);
      const branchRailY = src.bottom.y + 24;

      // Stem from source
      elements.push(
        p.path(`M ${srcX} ${src.bottom.y} V ${branchRailY}`, colors.busLine, colors.busLineWidth),
      );

      // Horizontal branch rail
      const minBX = Math.min(...bYs.map((pt) => pt.x));
      const maxBX = Math.max(...bYs.map((pt) => pt.x));
      elements.push(
        p.path(`M ${minBX + 8} ${branchRailY} H ${maxBX - 8}`, colors.busLine, colors.busLineWidth),
      );

      // Drops into each card with rounded bends
      for (const pt of bYs) {
        if (pt.x < srcX) {
          elements.push(
            p.path(
              `M ${pt.x + 8} ${branchRailY} Q ${pt.x} ${branchRailY} ${pt.x} ${branchRailY + 8} V ${pt.y}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else if (pt.x > srcX) {
          elements.push(
            p.path(
              `M ${pt.x - 8} ${branchRailY} Q ${pt.x} ${branchRailY} ${pt.x} ${branchRailY + 8} V ${pt.y}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else {
          elements.push(
            p.path(`M ${pt.x} ${branchRailY} V ${pt.y}`, colors.busLine, colors.busLineWidth),
          );
        }
        addTokenBead(elements, p, tokenShape, pt.x, branchRailY + 12, tokenColor, colors.isDark);
      }

      // Token beads along branch rail
      addTokenBead(
        elements,
        p,
        tokenShape,
        (minBX + srcX) / 2 - 40,
        branchRailY,
        tokenColor,
        colors.isDark,
      );
      addTokenBead(
        elements,
        p,
        tokenShape,
        (minBX + srcX) / 2 + 30,
        branchRailY,
        tokenColor,
        colors.isDark,
      );
      addTokenBead(
        elements,
        p,
        tokenShape,
        (maxBX + srcX) / 2 - 30,
        branchRailY,
        tokenColor,
        colors.isDark,
      );
      addTokenBead(
        elements,
        p,
        tokenShape,
        (maxBX + srcX) / 2 + 40,
        branchRailY,
        tokenColor,
        colors.isDark,
      );
      if (bus.label) {
        addBusLabel(elements, p, bus.label, srcX, branchRailY - 14, colors);
      }
      continue;
    }

    // Case 2: Vertical Pipeline (Single source directly above single target)
    const isVerticalPipeline =
      fromNodes.length === 1 && toNodes.length === 1 && toNodes[0]!.top.y > fromNodes[0]!.bottom.y;

    if (isVerticalPipeline) {
      const src = fromNodes[0]!;
      const tgt = toNodes[0]!;
      const connY1 = src.bottom.y;
      const connY2 = tgt.top.y;
      const cdcX = tgt.top.x;

      elements.push(
        p.path(`M ${cdcX} ${connY1} L ${cdcX} ${connY2}`, colors.busLine, colors.busLineWidth, {
          ...(isAnim ? { animated: anim } : {}),
        }),
      );
      addTokenBead(elements, p, tokenShape, cdcX, (connY1 + connY2) / 2, tokenColor, colors.isDark);
      if (bus.label) {
        addBusLabel(elements, p, bus.label, cdcX, (connY1 + connY2) / 2, colors);
      }
      continue;
    }

    // Case 3: Horizontal Fan-In (Multiple sources on left converging into single target on right)
    const isFanIn =
      fromNodes.length > 1 &&
      toNodes.length === 1 &&
      toNodes[0]!.left.x > Math.max(...fromNodes.map((s) => s.right.x));

    if (isFanIn) {
      const tgt = toNodes[0]!;
      const targetX = tgt.left.x;
      const targetY = tgt.left.y;
      const maxSrcX = Math.max(...fromNodes.map((s) => s.right.x));
      const railX = isHabitatProfile ? 295 : maxSrcX + (targetX - maxSrcX) * 0.45;

      const sourceYs = fromNodes.map((c) => c.right.y);
      const minY = Math.min(...sourceYs);
      const maxY = Math.max(...sourceYs);

      for (const cy of sourceYs) {
        if (cy < targetY) {
          elements.push(
            p.path(
              `M ${maxSrcX} ${cy} H ${railX - 8} Q ${railX} ${cy} ${railX} ${cy + 8}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else if (cy > targetY) {
          elements.push(
            p.path(
              `M ${maxSrcX} ${cy} H ${railX - 8} Q ${railX} ${cy} ${railX} ${cy - 8}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else {
          elements.push(
            p.path(`M ${maxSrcX} ${cy} H ${railX}`, colors.busLine, colors.busLineWidth),
          );
        }
      }

      // Vertical trunk
      elements.push(
        p.path(`M ${railX} ${minY + 8} V ${maxY - 8}`, colors.busLine, colors.busLineWidth),
      );

      // Main ingress trunk line into target
      const ingressPath = `M ${railX} ${targetY} L ${targetX} ${targetY}`;
      elements.push(
        p.path(ingressPath, colors.busLine, colors.busLineWidth, {
          ...(isAnim ? { animated: anim } : {}),
        }),
      );

      // Beads on stubs
      const b1 = doc.legend?.[0] ?? { shape: 'square' as const, color: '#3b82f6' };
      const b2 = doc.legend?.[1] ?? { shape: 'circle' as const, color: '#10b981' };
      sourceYs.forEach((sy, i) => {
        const item = i % 2 === 0 ? b1 : b2;
        addTokenBead(elements, p, item.shape, railX - 35, sy, item.color, colors.isDark);
      });

      // Beads traveling on main trunk
      addTokenBead(elements, p, b1.shape, railX + 22, targetY, b1.color, colors.isDark);
      addTokenBead(elements, p, b2.shape, railX + 42, targetY, b2.color, colors.isDark);
      addTokenBead(elements, p, b2.shape, railX + 54, targetY, b2.color, colors.isDark);

      if (bus.label) {
        addBusLabel(elements, p, bus.label, (railX + targetX) / 2, targetY, colors);
      }
      continue;
    }

    // Case 4: Horizontal Fan-Out (Single source on left branching into multiple targets on right)
    const isFanOut =
      fromNodes.length === 1 &&
      toNodes.length > 1 &&
      Math.min(...toNodes.map((t) => t.left.x)) > fromNodes[0]!.right.x;

    if (isFanOut) {
      const src = fromNodes[0]!;
      const exitX = src.right.x;
      const startY = src.right.y;
      const minTgtX = Math.min(...toNodes.map((t) => t.left.x));
      const railX = isHabitatProfile ? 1060 : exitX + (minTgtX - exitX) * 0.5;

      // Main trunk
      const egressPath = `M ${exitX} ${startY} L ${railX} ${startY}`;
      elements.push(
        p.path(egressPath, colors.busLine, colors.busLineWidth, {
          ...(isAnim ? { animated: anim } : {}),
        }),
      );

      const targetYs = toNodes.map((c) => c.left.y);
      const minY = Math.min(...targetYs);
      const maxY = Math.max(...targetYs);

      // Vertical trunk
      elements.push(
        p.path(`M ${railX} ${minY + 8} V ${maxY - 8}`, colors.busLine, colors.busLineWidth),
      );

      // Fan-out stubs with rounded corners
      for (const sy of targetYs) {
        if (sy < startY) {
          elements.push(
            p.path(
              `M ${railX} ${sy + 8} Q ${railX} ${sy} ${railX + 8} ${sy} H ${minTgtX}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else if (sy > startY) {
          elements.push(
            p.path(
              `M ${railX} ${sy - 8} Q ${railX} ${sy} ${railX + 8} ${sy} H ${minTgtX}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else {
          elements.push(
            p.path(`M ${railX} ${sy} H ${minTgtX}`, colors.busLine, colors.busLineWidth),
          );
        }
      }

      // Beads on egress bus
      const b1 = doc.legend?.[0] ?? { shape: 'square' as const, color: '#3b82f6' };
      const b2 = doc.legend?.[1] ?? { shape: 'circle' as const, color: '#10b981' };
      addTokenBead(elements, p, b2.shape, exitX + 20, startY, b2.color, colors.isDark);
      addTokenBead(elements, p, b1.shape, exitX + 34, startY, b1.color, colors.isDark);
      addTokenBead(elements, p, b1.shape, exitX + 48, startY, b1.color, colors.isDark);

      if (targetYs[1] !== undefined)
        addTokenBead(elements, p, b2.shape, railX + 18, targetYs[1]!, b2.color, colors.isDark);
      if (targetYs[2] !== undefined)
        addTokenBead(elements, p, b1.shape, railX + 18, targetYs[2]!, b1.color, colors.isDark);

      if (bus.label) {
        addBusLabel(elements, p, bus.label, (exitX + railX) / 2, startY, colors);
      }
      continue;
    }

    // Case 5: Horizontal Point-to-Point (Single source to single target)
    if (fromNodes.length === 1 && toNodes.length === 1) {
      const src = fromNodes[0]!;
      const tgt = toNodes[0]!;
      if (tgt.left.x > src.right.x) {
        if (Math.abs(tgt.left.y - src.right.y) < 4) {
          elements.push(
            p.path(
              `M ${src.right.x} ${src.right.y} H ${tgt.left.x}`,
              colors.busLine,
              colors.busLineWidth,
              { ...(isAnim ? { animated: anim } : {}) },
            ),
          );
        } else {
          const midX = (src.right.x + tgt.left.x) / 2;
          const dy = tgt.left.y - src.right.y;
          const sign = dy > 0 ? 1 : -1;
          elements.push(
            p.path(
              `M ${src.right.x} ${src.right.y} H ${midX - 8} Q ${midX} ${src.right.y} ${midX} ${src.right.y + sign * 8} V ${tgt.left.y - sign * 8} Q ${midX} ${tgt.left.y} ${midX + 8} ${tgt.left.y} H ${tgt.left.x}`,
              colors.busLine,
              colors.busLineWidth,
              { ...(isAnim ? { animated: anim } : {}) },
            ),
          );
        }
        addTokenBead(
          elements,
          p,
          tokenShape,
          (src.right.x + tgt.left.x) / 2,
          (src.right.y + tgt.left.y) / 2,
          tokenColor,
          colors.isDark,
        );
        if (bus.label) {
          addBusLabel(
            elements,
            p,
            bus.label,
            (src.right.x + tgt.left.x) / 2,
            (src.right.y + tgt.left.y) / 2,
            colors,
          );
        }
      }
    }
  }

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: canvasW, height: canvasH },
    background: theme.palette.background === '' ? '' : colors.canvasBg,
    elements,
    defs,
  };

  return { scene, anchors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addBusLabel(
  elements: SceneElement[],
  p: ReturnType<typeof pen>,
  text: string,
  x: number,
  y: number,
  colors: ReturnType<typeof resolvePlatformColors>,
) {
  const padH = 8;
  const charWidth = 6.2;
  const badgeW = Math.max(36, text.length * charWidth + padH * 2);
  const badgeH = 18;
  const rx = x - badgeW / 2;
  const ry = y - badgeH / 2;

  elements.push(
    p.rect({ x: rx, y: ry, width: badgeW, height: badgeH }, colors.cardBg, colors.cardBorder, 1.2, {
      rx: 4,
    }),
  );
  elements.push(
    p.text(text, x, y + 3.5, 9.5, colors.cardTitle, {
      weight: 'bold',
      anchor: 'middle',
    }),
  );
}

function addTokenBead(
  elements: SceneElement[],
  p: ReturnType<typeof pen>,
  shape: 'square' | 'circle' | 'diamond',
  cx: number,
  cy: number,
  color: string,
  isDark = false,
) {
  if (shape === 'square') {
    const stroke = isDark ? '#93c5fd' : '#1d4ed8';
    elements.push(
      p.rect({ x: cx - 4, y: cy - 4, width: 8, height: 8 }, color, stroke, 1.2, { rx: 1.5 }),
    );
  } else if (shape === 'circle') {
    const stroke = isDark ? '#a7f3d0' : '#047857';
    elements.push(p.circle({ x: cx, y: cy }, 4, color, stroke, 1.2));
  } else if (shape === 'diamond') {
    const stroke = isDark ? '#ddd6fe' : '#6d28d9';
    elements.push(
      p.path(
        `M ${cx} ${cy - 5} L ${cx + 5} ${cy} L ${cx} ${cy + 5} L ${cx - 5} ${cy} Z`,
        stroke,
        1.2,
        { fill: color },
      ),
    );
  }
}

function drawIcon(
  elements: SceneElement[],
  p: ReturnType<typeof pen>,
  icon: string,
  x: number,
  y: number,
  stroke = '#0f172a',
) {
  const name = icon.toLowerCase();

  if (name.includes('openai') || name.includes('gpt')) {
    // OpenAI pinwheel / flower glyph
    elements.push(p.circle({ x: x + 9, y: y + 9 }, 8, 'none', stroke, 1.2));
    elements.push(p.circle({ x: x + 9, y: y + 9 }, 4, 'none', stroke, 1.2));
  } else if (name.includes('api') || name.includes('fork')) {
    // Fork / branching glyph
    elements.push(p.circle({ x: x + 5, y: y + 5 }, 2.5, 'none', stroke, 1.2));
    elements.push(p.circle({ x: x + 13, y: y + 4 }, 2.5, 'none', stroke, 1.2));
    elements.push(p.circle({ x: x + 13, y: y + 14 }, 2.5, 'none', stroke, 1.2));
    elements.push(
      p.path(
        `M ${x + 5} ${y + 8} V ${y + 14} M ${x + 5} ${y + 8} Q ${x + 9} ${y + 8} ${x + 13} ${y + 6}`,
        stroke,
        1.2,
      ),
    );
  } else if (name.includes('codex') || name.includes('robot')) {
    // Robot head glyph
    elements.push(
      p.rect({ x: x + 2, y: y + 3, width: 14, height: 12 }, 'none', stroke, 1.2, { rx: 3 }),
    );
    elements.push(p.circle({ x: x + 6, y: y + 8 }, 1.5, stroke, stroke, 1));
    elements.push(p.circle({ x: x + 12, y: y + 8 }, 1.5, stroke, stroke, 1));
    elements.push(p.path(`M ${x + 9} ${y + 3} V ${y}`, stroke, 1.2));
  } else if (
    name.includes('database') ||
    name.includes('db') ||
    name.includes('cosmos') ||
    name.includes('nanobase')
  ) {
    // Cylinder database glyph
    elements.push(
      p.rect({ x: x + 2, y: y + 2, width: 14, height: 14 }, 'none', stroke, 1.2, { rx: 3 }),
    );
    elements.push(
      p.path(`M ${x + 2} ${y + 7} Q ${x + 9} ${y + 9} ${x + 16} ${y + 7}`, stroke, 1.2),
    );
    elements.push(
      p.path(`M ${x + 2} ${y + 11} Q ${x + 9} ${y + 13} ${x + 16} ${y + 11}`, stroke, 1.2),
    );
  } else if (name.includes('lightning') || name.includes('valkey') || name.includes('cache')) {
    // Lightning bolt glyph
    elements.push(
      p.path(
        `M ${x + 10} ${y} L ${x + 4} ${y + 9} H ${x + 9} L ${x + 7} ${y + 18} L ${x + 15} ${y + 8} H ${x + 10} Z`,
        stroke,
        1.2,
        { fill: 'none' },
      ),
    );
  } else if (name.includes('cube') || name.includes('blob') || name.includes('storage')) {
    // Isometric 3D box glyph
    elements.push(
      p.path(
        `M ${x + 9} ${y + 1} L ${x + 16} ${y + 5} L ${x + 9} ${y + 9} L ${x + 2} ${y + 5} Z`,
        stroke,
        1.2,
        { fill: 'none' },
      ),
    );
    elements.push(
      p.path(
        `M ${x + 2} ${y + 5} V ${y + 13} L ${x + 9} ${y + 17} V ${y + 9} M ${x + 16} ${y + 5} V ${y + 13} L ${x + 9} ${y + 17}`,
        stroke,
        1.2,
      ),
    );
  } else if (name.includes('cdc')) {
    // CDC branch network glyph
    elements.push(p.circle({ x: x + 4, y: y + 4 }, 2, 'none', stroke, 1.2));
    elements.push(p.circle({ x: x + 14, y: y + 4 }, 2, 'none', stroke, 1.2));
    elements.push(p.circle({ x: x + 9, y: y + 14 }, 2, 'none', stroke, 1.2));
    elements.push(
      p.path(
        `M ${x + 4} ${y + 6} L ${x + 8} ${y + 12} M ${x + 14} ${y + 6} L ${x + 10} ${y + 12}`,
        stroke,
        1.2,
      ),
    );
  } else if (name.includes('cloud')) {
    // Cloud glyph
    elements.push(
      p.path(
        `M ${x + 4} ${y + 13} H ${x + 14} A 2.5 2.5 0 0 0 ${x + 14} ${y + 8} A 3.5 3.5 0 0 0 ${x + 7} ${y + 8} A 2.5 2.5 0 0 0 ${x + 4} ${y + 13} Z`,
        stroke,
        1.2,
        { fill: 'none' },
      ),
    );
  } else if (
    name.includes('shield') ||
    name.includes('lock') ||
    name.includes('auth') ||
    name.includes('security')
  ) {
    // Shield glyph
    elements.push(
      p.path(
        `M ${x + 9} ${y + 2} L ${x + 15} ${y + 5} V ${y + 9} Q ${x + 15} ${y + 15} ${x + 9} ${y + 17} Q ${x + 3} ${y + 15} ${x + 3} ${y + 9} V ${y + 5} Z`,
        stroke,
        1.2,
        { fill: 'none' },
      ),
    );
  } else if (name.includes('queue') || name.includes('kafka') || name.includes('stream')) {
    // Event queue buffer glyph
    elements.push(p.circle({ x: x + 5, y: y + 9 }, 2, stroke, stroke, 1));
    elements.push(p.circle({ x: x + 9, y: y + 9 }, 2, stroke, stroke, 1));
    elements.push(p.circle({ x: x + 13, y: y + 9 }, 2, stroke, stroke, 1));
    elements.push(
      p.path(`M ${x + 2} ${y + 4} H ${x + 16} M ${x + 2} ${y + 14} H ${x + 16}`, stroke, 1.2),
    );
  } else if (
    name.includes('globe') ||
    name.includes('web') ||
    name.includes('browser') ||
    name.includes('client')
  ) {
    // Globe glyph
    elements.push(p.circle({ x: x + 9, y: y + 9 }, 7, 'none', stroke, 1.2));
    elements.push(
      p.path(
        `M ${x + 2} ${y + 9} H ${x + 16} M ${x + 9} ${y + 2} Q ${x + 5} ${y + 9} ${x + 9} ${y + 16} M ${x + 9} ${y + 2} Q ${x + 13} ${y + 9} ${x + 9} ${y + 16}`,
        stroke,
        1.1,
      ),
    );
  } else {
    // Server rack / generic box glyph
    elements.push(
      p.rect({ x: x + 2, y: y + 2, width: 14, height: 14 }, 'none', stroke, 1.2, { rx: 2 }),
    );
    elements.push(
      p.path(`M ${x + 2} ${y + 6} H ${x + 16} M ${x + 2} ${y + 11} H ${x + 16}`, stroke, 1.2),
    );
  }
}
