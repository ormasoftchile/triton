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

export function layoutPlatform(doc: PlatformDocument, theme: ResolvedTheme): LayoutResult {
  const p = pen(theme);
  const colors = resolvePlatformColors(theme);
  const elements: SceneElement[] = [];
  const defs: string[] = [];
  const anchors: Record<string, NodeAnchor> = {};

  // Add dot-matrix grid definition
  defs.push(
    `<pattern id="platform-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="${colors.dotColor}" opacity="${colors.dotOpacity}"/></pattern>`,
  );

  const canvasW = 1380;
  const canvasH = 780;

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
    p.rect(
      { x: btnX, y: btnY, width: 80, height: 28 },
      colors.pauseBg,
      colors.pauseBorder,
      1.5,
      { rx: 6 },
    ),
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

  // Layout parameters
  const tierY = 175;
  const leftColX = 50;
  const leftColW = 195;

  const centerColX = 350;
  const centerColW = 660;

  const rightColX = 1110;
  const rightColW = 210;

  // Find tiers
  const clientTier = doc.tiers.find((t) => t.id === 'clients') ?? doc.tiers[0];
  const platformTier = doc.tiers.find((t) => t.id === 'platform') ?? doc.tiers[1];
  const storageTier = doc.tiers.find((t) => t.id === 'storage') ?? doc.tiers[2];

  // 1. Render Left Tier (CLIENTS)
  if (clientTier) {
    elements.push(
      p.text(clientTier.title.toUpperCase(), leftColX + leftColW / 2, tierY, 11, colors.tierTitle, {
        weight: 'bold',
        anchor: 'middle',
      }),
    );

    const clientCards = clientTier.items.filter(
      (it): it is PlatformCard => !('items' in it) && !('grid' in it) && !('cards' in it),
    );
    const cardH = 46;
    const gap = 14;
    const startY = tierY + 24;

    clientCards.forEach((card, idx) => {
      const y = startY + idx * (cardH + gap);
      const b: Rect = { x: leftColX, y, width: leftColW, height: cardH };
      registerPlacedNode(card.id, b);

      elements.push(p.rect(b, colors.cardBg, colors.cardBorder, 1.5, { rx: 6 }));
      drawIcon(elements, p, card.icon ?? 'client', b.x + 12, b.y + 14, colors.cardIcon);
      elements.push(p.text(card.title, b.x + 38, b.y + 27, 13, colors.cardTitle, { weight: 'bold' }));
    });
  }

  // 2. Render Center Tier (ONLINE STORAGE PLATFORM)
  let routingCenterY = 390;

  if (platformTier) {
    elements.push(
      p.text(platformTier.title.toUpperCase(), centerColX + centerColW / 2, tierY, 11, colors.tierTitle, {
        weight: 'bold',
        anchor: 'middle',
      }),
    );

    const habitatBox = platformTier.items.find(
      (it): it is PlatformBox => 'grid' in it || 'cards' in it,
    );
    const cdcBox = platformTier.items.find(
      (it): it is PlatformBox => 'branch' in it || it.id === 'cdc',
    );

    if (habitatBox) {
      const boxY = tierY + 24;
      const boxH = 250;
      const boxBounds: Rect = { x: centerColX, y: boxY, width: centerColW, height: boxH };
      registerPlacedNode(habitatBox.id, boxBounds);

      // Outer Habitat Container
      elements.push(p.rect(boxBounds, colors.habitatBg, colors.habitatBorder, 1.8, { rx: 8 }));
      elements.push(
        p.text(habitatBox.title, centerColX + centerColW / 2, boxY + 22, 13, colors.habitatTitle, {
          weight: 'bold',
          anchor: 'middle',
        }),
      );

      // 3x2 Capability Grid
      if (habitatBox.grid) {
        const gridCols = habitatBox.grid.columns || 3;
        const colGap = 12;
        const rowGap = 10;
        const cellW = (centerColW - 32 - (gridCols - 1) * colGap) / gridCols;
        const cellH = 56;
        const gridStartX = centerColX + 16;
        const gridStartY = boxY + 36;

        habitatBox.grid.cards.forEach((card, idx) => {
          const col = idx % gridCols;
          const row = Math.floor(idx / gridCols);
          const cx = gridStartX + col * (cellW + colGap);
          const cy = gridStartY + row * (cellH + rowGap);
          const cb: Rect = { x: cx, y: cy, width: cellW, height: cellH };
          registerPlacedNode(card.id, cb);

          elements.push(p.rect(cb, colors.gridCellBg, colors.gridCellBorder, 1.3, { rx: 6 }));
          elements.push(p.text(card.title, cx + 12, cy + 22, 11.5, colors.primaryText, { weight: 'bold' }));
          if (card.subtitle) {
            elements.push(p.text(card.subtitle, cx + 12, cy + 40, 10, colors.secondaryText));
          }
        });
      }

      // Spanning Routing Bar at bottom
      const routingCard =
        (habitatBox.cards ?? []).find((c) => c.id === 'routing') ?? habitatBox.cards?.[0];
      if (routingCard) {
        const rW = centerColW - 32;
        const rH = 54;
        const rx = centerColX + 16;
        const ry = boxY + boxH - rH - 16;
        const rb: Rect = { x: rx, y: ry, width: rW, height: rH };
        const placed = registerPlacedNode(routingCard.id, rb);
        registerPlacedNode(`${habitatBox.id}.${routingCard.id}`, rb);
        routingCenterY = placed.center.y;

        elements.push(p.rect(rb, colors.routingBg, colors.routingBorder, 1.3, { rx: 6 }));
        elements.push(
          p.text(routingCard.title, rx + 16, ry + 22, 12, colors.routingTitle, { weight: 'bold' }),
        );
        if (routingCard.subtitle) {
          elements.push(p.text(routingCard.subtitle, rx + 16, ry + 40, 10.5, colors.routingSubtitle));
        }
      }
    }

    // CDC Services & Downstream Branch
    if (cdcBox) {
      const cdcW = 230;
      const cdcH = 50;
      const cdcX = centerColX + (centerColW - cdcW) / 2;
      const cdcY = tierY + 310;
      const cdcBounds: Rect = { x: cdcX, y: cdcY, width: cdcW, height: cdcH };
      registerPlacedNode(cdcBox.id, cdcBounds);

      elements.push(p.rect(cdcBounds, colors.cdcBg, colors.cdcBorder, 1.5, { rx: 6 }));
      drawIcon(elements, p, 'cdc', cdcX + 12, cdcY + 16, colors.cardIcon);
      elements.push(p.text(cdcBox.title, cdcX + 38, cdcY + 22, 12, colors.cardTitle, { weight: 'bold' }));
      if (cdcBox.subtitle) {
        elements.push(p.text(cdcBox.subtitle, cdcX + 38, cdcY + 38, 10, colors.cardSubtitle));
      }

      // Branch cards
      if (cdcBox.branch) {
        const bCards = cdcBox.branch.cards;
        const bW = 136;
        const bH = 46;
        const bGap = 14;
        const totalBW = bCards.length * bW + (bCards.length - 1) * bGap;
        const startBX = centerColX + (centerColW - totalBW) / 2;
        const bY = cdcY + 90;

        bCards.forEach((card, idx) => {
          const bx = startBX + idx * (bW + bGap);
          const bb: Rect = { x: bx, y: bY, width: bW, height: bH };
          registerPlacedNode(card.id, bb);

          elements.push(p.rect(bb, colors.cardBg, colors.cardBorder, 1.5, { rx: 6 }));
          drawIcon(elements, p, card.icon ?? card.id, bx + 12, bY + 14, colors.cardIcon);
          elements.push(p.text(card.title, bx + 36, bY + 28, 11.5, colors.cardTitle, { weight: 'bold' }));
        });
      }
    }
  }

  // 3. Render Right Tier (STORAGE RESOURCES)
  if (storageTier) {
    elements.push(
      p.text(storageTier.title.toUpperCase(), rightColX + rightColW / 2, tierY, 11, colors.tierTitle, {
        weight: 'bold',
        anchor: 'middle',
      }),
    );

    const storageCards = storageTier.items.filter(
      (it): it is PlatformCard => !('items' in it) && !('grid' in it) && !('cards' in it),
    );
    const cardH = 54;
    const gap = 14;
    const startY = tierY + 24;

    storageCards.forEach((card, idx) => {
      const y = startY + idx * (cardH + gap);
      const b: Rect = { x: rightColX, y, width: rightColW, height: cardH };
      registerPlacedNode(card.id, b);

      elements.push(p.rect(b, colors.cardBg, colors.cardBorder, 1.5, { rx: 6 }));
      drawIcon(elements, p, card.icon ?? 'database', b.x + 12, b.y + 18, colors.cardIcon);
      elements.push(p.text(card.title, b.x + 38, b.y + 24, 12, colors.cardTitle, { weight: 'bold' }));
      if (card.subtitle) {
        elements.push(p.text(card.subtitle, b.x + 38, b.y + 40, 10.5, colors.cardSubtitle));
      }
    });
  }

  // ─── Bus Routing & Flow Particles ───────────────────────────────────────────
  const clientCards =
    clientTier?.items.filter(
      (it): it is PlatformCard => !('items' in it) && !('grid' in it) && !('cards' in it),
    ) ?? [];
  const storageCards =
    storageTier?.items.filter(
      (it): it is PlatformCard => !('items' in it) && !('grid' in it) && !('cards' in it),
    ) ?? [];

  // Ingress Bus (Clients -> Habitat.Routing)
  if (clientCards.length > 0) {
    const railX = 295;
    const targetX = centerColX;
    const targetY = routingCenterY;

    // Draw stubs and trunk
    const clientYs = clientCards.map((c) => nodeMap.get(c.id)?.right.y ?? 0);
    const minY = Math.min(...clientYs);
    const maxY = Math.max(...clientYs);

    // Connecting stubs with rounded bends into vertical trunk
    for (const cy of clientYs) {
      if (cy < targetY) {
        // Bend down to meet trunk
        elements.push(
          p.path(
            `M ${leftColX + leftColW} ${cy} H ${railX - 8} Q ${railX} ${cy} ${railX} ${cy + 8}`,
            colors.busLine,
            colors.busLineWidth,
          ),
        );
      } else if (cy > targetY) {
        // Bend up to meet trunk
        elements.push(
          p.path(
            `M ${leftColX + leftColW} ${cy} H ${railX - 8} Q ${railX} ${cy} ${railX} ${cy - 8}`,
            colors.busLine,
            colors.busLineWidth,
          ),
        );
      } else {
        elements.push(p.path(`M ${leftColX + leftColW} ${cy} H ${railX}`, colors.busLine, colors.busLineWidth));
      }
    }

    // Vertical trunk
    elements.push(p.path(`M ${railX} ${minY + 8} V ${maxY - 8}`, colors.busLine, colors.busLineWidth));

    // Main ingress trunk line into Habitat
    const ingressPath = `M ${railX} ${targetY} L ${targetX} ${targetY}`;
    elements.push(p.path(ingressPath, colors.busLine, colors.busLineWidth, { animated: 'stream' }));

    // Static / animated semantic beads on ingress bus
    addTokenBead(elements, p, 'square', railX - 35, clientYs[0]!, '#3b82f6', colors.isDark);
    addTokenBead(elements, p, 'square', railX - 35, clientYs[1]!, '#3b82f6', colors.isDark);
    addTokenBead(elements, p, 'circle', railX - 35, clientYs[2]!, '#10b981', colors.isDark);
    addTokenBead(elements, p, 'circle', railX - 35, clientYs[3]!, '#10b981', colors.isDark);

    // Beads traveling on main trunk
    addTokenBead(elements, p, 'square', railX + 22, targetY, '#3b82f6', colors.isDark);
    addTokenBead(elements, p, 'circle', railX + 42, targetY, '#10b981', colors.isDark);
    addTokenBead(elements, p, 'circle', railX + 54, targetY, '#10b981', colors.isDark);
  }

  // Egress Bus (Habitat.Routing -> Storage Resources)
  if (storageCards.length > 0) {
    const exitX = centerColX + centerColW;
    const railX = 1060;
    const startY = routingCenterY;

    // Main egress trunk
    const egressPath = `M ${exitX} ${startY} L ${railX} ${startY}`;
    elements.push(p.path(egressPath, colors.busLine, colors.busLineWidth, { animated: 'stream' }));

    const storageYs = storageCards.map((c) => nodeMap.get(c.id)?.left.y ?? 0);
    const minY = Math.min(...storageYs);
    const maxY = Math.max(...storageYs);

    // Vertical trunk
    elements.push(p.path(`M ${railX} ${minY + 8} V ${maxY - 8}`, colors.busLine, colors.busLineWidth));

    // Fan-out stubs with rounded corners
    for (const sy of storageYs) {
      if (sy < startY) {
        elements.push(
          p.path(
            `M ${railX} ${sy + 8} Q ${railX} ${sy} ${railX + 8} ${sy} H ${rightColX}`,
            colors.busLine,
            colors.busLineWidth,
          ),
        );
      } else if (sy > startY) {
        elements.push(
          p.path(
            `M ${railX} ${sy - 8} Q ${railX} ${sy} ${railX + 8} ${sy} H ${rightColX}`,
            colors.busLine,
            colors.busLineWidth,
          ),
        );
      } else {
        elements.push(p.path(`M ${railX} ${sy} H ${rightColX}`, colors.busLine, colors.busLineWidth));
      }
    }

    // Beads on egress bus
    addTokenBead(elements, p, 'circle', exitX + 20, startY, '#10b981', colors.isDark);
    addTokenBead(elements, p, 'square', exitX + 34, startY, '#3b82f6', colors.isDark);
    addTokenBead(elements, p, 'square', exitX + 48, startY, '#3b82f6', colors.isDark);

    addTokenBead(elements, p, 'circle', railX + 18, storageYs[1]!, '#10b981', colors.isDark);
    addTokenBead(elements, p, 'square', railX + 18, storageYs[2]!, '#3b82f6', colors.isDark);
  }

  // CDC Pipeline Connector
  const habitatNode = nodeMap.get('habitat');
  const cdcNode = nodeMap.get('cdc');
  if (habitatNode && cdcNode) {
    const cdcConnY1 = habitatNode.bottom.y;
    const cdcConnY2 = cdcNode.top.y;
    const cdcX = cdcNode.top.x;

    elements.push(
      p.path(`M ${cdcX} ${cdcConnY1} L ${cdcX} ${cdcConnY2}`, colors.busLine, colors.busLineWidth, {
        animated: 'particle',
      }),
    );

    // Purple diamond token
    addTokenBead(elements, p, 'diamond', cdcX, (cdcConnY1 + cdcConnY2) / 2, '#8b5cf6', colors.isDark);

    // Downstream branching bus from CDC Services
    const cdcBox = platformTier?.items.find(
      (it): it is PlatformBox => 'branch' in it || it.id === 'cdc',
    );
    if (cdcBox?.branch) {
      const bCards = cdcBox.branch.cards;
      const bYs = bCards.map((c) => nodeMap.get(c.id)?.top ?? { x: 0, y: 0 });
      const branchRailY = cdcNode.bottom.y + 24;

      // Stem from CDC
      elements.push(p.path(`M ${cdcX} ${cdcNode.bottom.y} V ${branchRailY}`, colors.busLine, colors.busLineWidth));

      // Horizontal branch rail
      const minBX = Math.min(...bYs.map((pt) => pt.x));
      const maxBX = Math.max(...bYs.map((pt) => pt.x));
      elements.push(p.path(`M ${minBX + 8} ${branchRailY} H ${maxBX - 8}`, colors.busLine, colors.busLineWidth));

      // Drops into each card with rounded bends
      for (const pt of bYs) {
        if (pt.x < cdcX) {
          elements.push(
            p.path(
              `M ${pt.x + 8} ${branchRailY} Q ${pt.x} ${branchRailY} ${pt.x} ${branchRailY + 8} V ${pt.y}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else if (pt.x > cdcX) {
          elements.push(
            p.path(
              `M ${pt.x - 8} ${branchRailY} Q ${pt.x} ${branchRailY} ${pt.x} ${branchRailY + 8} V ${pt.y}`,
              colors.busLine,
              colors.busLineWidth,
            ),
          );
        } else {
          elements.push(p.path(`M ${pt.x} ${branchRailY} V ${pt.y}`, colors.busLine, colors.busLineWidth));
        }

        // Diamond token on each branch
        addTokenBead(elements, p, 'diamond', pt.x, branchRailY + 12, '#8b5cf6', colors.isDark);
      }

      // Diamond tokens along branch rail
      addTokenBead(elements, p, 'diamond', (minBX + cdcX) / 2 - 40, branchRailY, '#8b5cf6', colors.isDark);
      addTokenBead(elements, p, 'diamond', (minBX + cdcX) / 2 + 30, branchRailY, '#8b5cf6', colors.isDark);
      addTokenBead(elements, p, 'diamond', (maxBX + cdcX) / 2 - 30, branchRailY, '#8b5cf6', colors.isDark);
      addTokenBead(elements, p, 'diamond', (maxBX + cdcX) / 2 + 40, branchRailY, '#8b5cf6', colors.isDark);
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
