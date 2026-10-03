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

interface PlacedNode {
  readonly id: string;
  readonly bounds: Rect;
  readonly center: Point;
  readonly left: Point;
  readonly right: Point;
  readonly top: Point;
  readonly bottom: Point;
}

export function layoutPlatform(doc: PlatformDocument, theme: ResolvedTheme): LayoutResult {
  const p = pen(theme);
  const { palette, typography } = theme;
  const elements: SceneElement[] = [];
  const defs: string[] = [];
  const anchors: Record<string, NodeAnchor> = {};

  // Add dot-matrix grid definition
  defs.push(
    '<pattern id="platform-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#cbd5e1" opacity="0.8"/></pattern>',
  );

  const canvasW = 1380;
  const canvasH = 780;

  // Background with dot pattern
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
    elements.push(p.text(doc.figure.toUpperCase(), 50, curY, 11, '#64748b', { weight: 'bold' }));
    curY += 26;
  }

  if (doc.title) {
    elements.push(p.text(doc.title, 50, curY + 6, 22, '#0f172a', { weight: 'bold' }));
    curY += 32;
  }

  if (doc.desc) {
    elements.push(p.text(doc.desc, 50, curY + 4, 13, '#475569'));
    curY += 28;
  }

  // Pause button badge (Top right)
  const btnX = canvasW - 130;
  const btnY = 36;
  elements.push(
    p.rect({ x: btnX, y: btnY, width: 80, height: 28 }, '#ffffff', '#0f172a', 1.5, { rx: 6 }),
  );
  elements.push(
    p.rect({ x: btnX + 16, y: btnY + 9, width: 2.5, height: 10 }, '#0f172a', '#0f172a', 0),
  );
  elements.push(
    p.rect({ x: btnX + 21, y: btnY + 9, width: 2.5, height: 10 }, '#0f172a', '#0f172a', 0),
  );
  elements.push(
    p.text('Pause', btnX + 48, btnY + 18, 12, '#0f172a', { weight: 'bold', anchor: 'middle' }),
  );

  // Legend (Requests, Responses, Changes)
  if (doc.legend && doc.legend.length > 0) {
    let legX = 50;
    const legY = curY + 8;
    for (const item of doc.legend) {
      if (item.shape === 'square') {
        elements.push(
          p.rect({ x: legX, y: legY - 8, width: 10, height: 10 }, item.color, '#1d4ed8', 1, {
            rx: 1,
          }),
        );
      } else if (item.shape === 'circle') {
        elements.push(p.circle({ x: legX + 5, y: legY - 3 }, 5, item.color, '#047857', 1));
      } else if (item.shape === 'diamond') {
        elements.push(
          p.path(
            `M ${legX + 5} ${legY - 9} L ${legX + 10} ${legY - 3} L ${legX + 5} ${legY + 3} L ${legX} ${legY - 3} Z`,
            '#6d28d9',
            1,
            { fill: item.color },
          ),
        );
      }
      elements.push(p.text(item.label, legX + 16, legY, 11.5, '#0f172a', { weight: 'bold' }));
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
      p.text(clientTier.title.toUpperCase(), leftColX + leftColW / 2, tierY, 11, '#0f172a', {
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

      elements.push(p.rect(b, '#ffffff', '#0f172a', 1.5, { rx: 6 }));
      drawIcon(elements, p, card.icon ?? 'client', b.x + 12, b.y + 14);
      elements.push(p.text(card.title, b.x + 38, b.y + 27, 13, '#0f172a', { weight: 'bold' }));
    });
  }

  // 2. Render Center Tier (ONLINE STORAGE PLATFORM)
  let routingCenterY = 390;

  if (platformTier) {
    elements.push(
      p.text(platformTier.title.toUpperCase(), centerColX + centerColW / 2, tierY, 11, '#0f172a', {
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
      elements.push(p.rect(boxBounds, '#ffffff', '#0f172a', 1.8, { rx: 8 }));
      elements.push(
        p.text(habitatBox.title, centerColX + centerColW / 2, boxY + 22, 13, '#0f172a', {
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

          elements.push(p.rect(cb, '#ffffff', '#334155', 1.3, { rx: 6 }));
          elements.push(p.text(card.title, cx + 12, cy + 22, 11.5, '#0f172a', { weight: 'bold' }));
          if (card.subtitle) {
            elements.push(p.text(card.subtitle, cx + 12, cy + 40, 10, '#64748b'));
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

        elements.push(p.rect(rb, '#ffffff', '#334155', 1.3, { rx: 6 }));
        elements.push(
          p.text(routingCard.title, rx + 16, ry + 22, 12, '#0f172a', { weight: 'bold' }),
        );
        if (routingCard.subtitle) {
          elements.push(p.text(routingCard.subtitle, rx + 16, ry + 40, 10.5, '#64748b'));
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

      elements.push(p.rect(cdcBounds, '#ffffff', '#0f172a', 1.5, { rx: 6 }));
      drawIcon(elements, p, 'cdc', cdcX + 12, cdcY + 16);
      elements.push(p.text(cdcBox.title, cdcX + 38, cdcY + 22, 12, '#0f172a', { weight: 'bold' }));
      if (cdcBox.subtitle) {
        elements.push(p.text(cdcBox.subtitle, cdcX + 38, cdcY + 38, 10, '#64748b'));
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

          elements.push(p.rect(bb, '#ffffff', '#0f172a', 1.5, { rx: 6 }));
          drawIcon(elements, p, card.icon ?? card.id, bx + 12, bY + 14);
          elements.push(p.text(card.title, bx + 36, bY + 28, 11.5, '#0f172a', { weight: 'bold' }));
        });
      }
    }
  }

  // 3. Render Right Tier (STORAGE RESOURCES)
  if (storageTier) {
    elements.push(
      p.text(storageTier.title.toUpperCase(), rightColX + rightColW / 2, tierY, 11, '#0f172a', {
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

      elements.push(p.rect(b, '#ffffff', '#0f172a', 1.5, { rx: 6 }));
      drawIcon(elements, p, card.icon ?? 'database', b.x + 12, b.y + 18);
      elements.push(p.text(card.title, b.x + 38, b.y + 24, 12, '#0f172a', { weight: 'bold' }));
      if (card.subtitle) {
        elements.push(p.text(card.subtitle, b.x + 38, b.y + 40, 10.5, '#64748b'));
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
            '#334155',
            1.5,
          ),
        );
      } else if (cy > targetY) {
        // Bend up to meet trunk
        elements.push(
          p.path(
            `M ${leftColX + leftColW} ${cy} H ${railX - 8} Q ${railX} ${cy} ${railX} ${cy - 8}`,
            '#334155',
            1.5,
          ),
        );
      } else {
        elements.push(p.path(`M ${leftColX + leftColW} ${cy} H ${railX}`, '#334155', 1.5));
      }
    }

    // Vertical trunk
    elements.push(p.path(`M ${railX} ${minY + 8} V ${maxY - 8}`, '#334155', 1.5));

    // Main ingress trunk line into Habitat
    const ingressPath = `M ${railX} ${targetY} L ${targetX} ${targetY}`;
    elements.push(p.path(ingressPath, '#334155', 1.5, { animated: 'stream' }));

    // Static / animated semantic beads on ingress bus
    addTokenBead(elements, p, 'square', railX - 35, clientYs[0]!, '#3b82f6');
    addTokenBead(elements, p, 'square', railX - 35, clientYs[1]!, '#3b82f6');
    addTokenBead(elements, p, 'circle', railX - 35, clientYs[2]!, '#10b981');
    addTokenBead(elements, p, 'circle', railX - 35, clientYs[3]!, '#10b981');

    // Beads traveling on main trunk
    addTokenBead(elements, p, 'square', railX + 22, targetY, '#3b82f6');
    addTokenBead(elements, p, 'circle', railX + 42, targetY, '#10b981');
    addTokenBead(elements, p, 'circle', railX + 54, targetY, '#10b981');
  }

  // Egress Bus (Habitat.Routing -> Storage Resources)
  if (storageCards.length > 0) {
    const exitX = centerColX + centerColW;
    const railX = 1060;
    const startY = routingCenterY;

    // Main egress trunk
    const egressPath = `M ${exitX} ${startY} L ${railX} ${startY}`;
    elements.push(p.path(egressPath, '#334155', 1.5, { animated: 'stream' }));

    const storageYs = storageCards.map((c) => nodeMap.get(c.id)?.left.y ?? 0);
    const minY = Math.min(...storageYs);
    const maxY = Math.max(...storageYs);

    // Vertical trunk
    elements.push(p.path(`M ${railX} ${minY + 8} V ${maxY - 8}`, '#334155', 1.5));

    // Fan-out stubs with rounded corners
    for (const sy of storageYs) {
      if (sy < startY) {
        elements.push(
          p.path(
            `M ${railX} ${sy + 8} Q ${railX} ${sy} ${railX + 8} ${sy} H ${rightColX}`,
            '#334155',
            1.5,
          ),
        );
      } else if (sy > startY) {
        elements.push(
          p.path(
            `M ${railX} ${sy - 8} Q ${railX} ${sy} ${railX + 8} ${sy} H ${rightColX}`,
            '#334155',
            1.5,
          ),
        );
      } else {
        elements.push(p.path(`M ${railX} ${sy} H ${rightColX}`, '#334155', 1.5));
      }
    }

    // Beads on egress bus
    addTokenBead(elements, p, 'circle', exitX + 20, startY, '#10b981');
    addTokenBead(elements, p, 'square', exitX + 34, startY, '#3b82f6');
    addTokenBead(elements, p, 'square', exitX + 48, startY, '#3b82f6');

    addTokenBead(elements, p, 'circle', railX + 18, storageYs[1]!, '#10b981');
    addTokenBead(elements, p, 'square', railX + 18, storageYs[2]!, '#3b82f6');
  }

  // CDC Pipeline Connector
  const habitatNode = nodeMap.get('habitat');
  const cdcNode = nodeMap.get('cdc');
  if (habitatNode && cdcNode) {
    const cdcConnY1 = habitatNode.bottom.y;
    const cdcConnY2 = cdcNode.top.y;
    const cdcX = cdcNode.top.x;

    elements.push(
      p.path(`M ${cdcX} ${cdcConnY1} L ${cdcX} ${cdcConnY2}`, '#334155', 1.5, {
        animated: 'particle',
      }),
    );

    // Purple diamond token
    addTokenBead(elements, p, 'diamond', cdcX, (cdcConnY1 + cdcConnY2) / 2, '#8b5cf6');

    // Downstream branching bus from CDC Services
    const cdcBox = platformTier?.items.find(
      (it): it is PlatformBox => 'branch' in it || it.id === 'cdc',
    );
    if (cdcBox?.branch) {
      const bCards = cdcBox.branch.cards;
      const bYs = bCards.map((c) => nodeMap.get(c.id)?.top ?? { x: 0, y: 0 });
      const branchRailY = cdcNode.bottom.y + 24;

      // Stem from CDC
      elements.push(p.path(`M ${cdcX} ${cdcNode.bottom.y} V ${branchRailY}`, '#334155', 1.5));

      // Horizontal branch rail
      const minBX = Math.min(...bYs.map((pt) => pt.x));
      const maxBX = Math.max(...bYs.map((pt) => pt.x));
      elements.push(p.path(`M ${minBX + 8} ${branchRailY} H ${maxBX - 8}`, '#334155', 1.5));

      // Drops into each card with rounded bends
      for (const pt of bYs) {
        if (pt.x < cdcX) {
          elements.push(
            p.path(
              `M ${pt.x + 8} ${branchRailY} Q ${pt.x} ${branchRailY} ${pt.x} ${branchRailY + 8} V ${pt.y}`,
              '#334155',
              1.5,
            ),
          );
        } else if (pt.x > cdcX) {
          elements.push(
            p.path(
              `M ${pt.x - 8} ${branchRailY} Q ${pt.x} ${branchRailY} ${pt.x} ${branchRailY + 8} V ${pt.y}`,
              '#334155',
              1.5,
            ),
          );
        } else {
          elements.push(p.path(`M ${pt.x} ${branchRailY} V ${pt.y}`, '#334155', 1.5));
        }

        // Diamond token on each branch
        addTokenBead(elements, p, 'diamond', pt.x, branchRailY + 12, '#8b5cf6');
      }

      // Diamond tokens along branch rail
      addTokenBead(elements, p, 'diamond', (minBX + cdcX) / 2 - 40, branchRailY, '#8b5cf6');
      addTokenBead(elements, p, 'diamond', (minBX + cdcX) / 2 + 30, branchRailY, '#8b5cf6');
      addTokenBead(elements, p, 'diamond', (maxBX + cdcX) / 2 - 30, branchRailY, '#8b5cf6');
      addTokenBead(elements, p, 'diamond', (maxBX + cdcX) / 2 + 40, branchRailY, '#8b5cf6');
    }
  }

  const scene: Scene = {
    viewBox: { x: 0, y: 0, width: canvasW, height: canvasH },
    background: '#ffffff',
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
) {
  if (shape === 'square') {
    elements.push(
      p.rect({ x: cx - 4, y: cy - 4, width: 8, height: 8 }, color, '#1d4ed8', 1, { rx: 1 }),
    );
  } else if (shape === 'circle') {
    elements.push(p.circle({ x: cx, y: cy }, 4, color, '#047857', 1));
  } else if (shape === 'diamond') {
    elements.push(
      p.path(
        `M ${cx} ${cy - 5} L ${cx + 5} ${cy} L ${cx} ${cy + 5} L ${cx - 5} ${cy} Z`,
        '#6d28d9',
        1,
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
) {
  const stroke = '#0f172a';
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
