import type {
  PlatformDocument,
  PlatformTier,
  PlatformBox,
  PlatformCard,
  PlatformBus,
} from './ir.js';
import type { LayoutResult, Rect } from '../../../contracts/index.js';
import { layoutPlatform } from './layout.js';

export interface PlatformDiagnostic {
  readonly rule:
    | 'unmatched-bus-endpoint'
    | 'dangling-node'
    | 'badge-collision'
    | 'unsupported-geometry';
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly nodeOrBusId?: string;
}

function intersects(a: Rect, b: Rect, margin = 0): boolean {
  return (
    a.x + margin < b.x + b.width &&
    a.x + a.width - margin > b.x &&
    a.y + margin < b.y + b.height &&
    a.y + a.height - margin > b.y
  );
}

/**
 * Lints a PlatformDocument and its corresponding layout for:
 * 1. Unmatched Bus Endpoints: Typos in card, box, or tier IDs.
 * 2. Dangling Nodes: Cards that have 0 incoming and 0 outgoing buses.
 * 3. Visual Collisions: AABB overlap between bus label badges and card boundaries.
 */
export function lintPlatform(
  doc: PlatformDocument,
  layoutResult?: LayoutResult,
): PlatformDiagnostic[] {
  const diagnostics: PlatformDiagnostic[] = [];
  const layout = layoutResult ?? layoutPlatform(doc);

  // 1. Build lookup tables for all known endpoints
  const tierCardsMap = new Map<string, Set<string>>();
  const boxCardsMap = new Map<string, Set<string>>();
  const allCardIds = new Set<string>();
  const knownEndpointKeys = new Set<string>();

  for (const tier of doc.tiers) {
    knownEndpointKeys.add(tier.id);
    const tierCards = new Set<string>();
    tierCardsMap.set(tier.id, tierCards);

    for (const item of tier.items) {
      if ('grid' in item || 'branch' in item || 'cards' in item) {
        const box = item as PlatformBox;
        knownEndpointKeys.add(box.id);
        knownEndpointKeys.add(`${tier.id}.${box.id}`);
        const boxCards = new Set<string>();
        boxCardsMap.set(box.id, boxCards);
        boxCardsMap.set(`${tier.id}.${box.id}`, boxCards);

        const subCards: PlatformCard[] = [
          ...(box.cards ?? []),
          ...(box.grid?.cards ?? []),
          ...(box.branch?.cards ?? []),
        ];

        for (const card of subCards) {
          allCardIds.add(card.id);
          tierCards.add(card.id);
          boxCards.add(card.id);
          knownEndpointKeys.add(card.id);
          knownEndpointKeys.add(`${box.id}.${card.id}`);
          knownEndpointKeys.add(`${tier.id}.${box.id}.${card.id}`);
        }
      } else {
        const card = item as PlatformCard;
        allCardIds.add(card.id);
        tierCards.add(card.id);
        knownEndpointKeys.add(card.id);
        knownEndpointKeys.add(`${tier.id}.${card.id}`);
      }
    }
  }

  const isResolved = (endpoint: string): boolean => {
    if (knownEndpointKeys.has(endpoint)) return true;
    for (const k of knownEndpointKeys) {
      if (k.endsWith(`.${endpoint}`)) return true;
    }
    return false;
  };

  const connectedCards = new Set<string>();

  function markConnected(endpoint: string) {
    if (tierCardsMap.has(endpoint)) {
      for (const cid of tierCardsMap.get(endpoint)!) connectedCards.add(cid);
      return;
    }
    if (boxCardsMap.has(endpoint)) {
      for (const cid of boxCardsMap.get(endpoint)!) connectedCards.add(cid);
      return;
    }
    if (allCardIds.has(endpoint)) {
      connectedCards.add(endpoint);
      return;
    }
    for (const [boxKey, cardSet] of boxCardsMap) {
      if (boxKey.endsWith(`.${endpoint}`)) {
        for (const cid of cardSet) connectedCards.add(cid);
        return;
      }
    }
    for (const cid of allCardIds) {
      if (endpoint.endsWith(`.${cid}`)) {
        connectedCards.add(cid);
      }
    }
  }

  // 2. Validate Buses
  for (const bus of doc.buses) {
    const fromList = Array.isArray(bus.from) ? bus.from : [bus.from];
    const toList = Array.isArray(bus.to) ? bus.to : [bus.to];

    for (const ep of fromList) {
      if (!isResolved(ep)) {
        diagnostics.push({
          rule: 'unmatched-bus-endpoint',
          severity: 'error',
          message: `Bus source "${ep}" does not match any card, box, or tier in the diagram.`,
          nodeOrBusId: ep,
        });
      } else {
        markConnected(ep);
      }
    }

    for (const ep of toList) {
      if (!isResolved(ep)) {
        diagnostics.push({
          rule: 'unmatched-bus-endpoint',
          severity: 'error',
          message: `Bus target "${ep}" does not match any card, box, or tier in the diagram.`,
          nodeOrBusId: ep,
        });
      } else {
        markConnected(ep);
      }
    }

    // 2b. Validate Multi-to-Many Geometry (N -> M dual-rail bus targets must lie to the right of sources)
    if (fromList.length > 1 && toList.length > 1) {
      const getCards = (eps: string[]): string[] => {
        const res: string[] = [];
        for (const ep of eps) {
          if (allCardIds.has(ep)) res.push(ep);
          else if (tierCardsMap.has(ep)) res.push(...tierCardsMap.get(ep)!);
          else if (boxCardsMap.has(ep)) res.push(...boxCardsMap.get(ep)!);
        }
        return res;
      };
      const srcCards = getCards(fromList);
      const tgtCards = getCards(toList);
      if (srcCards.length > 1 && tgtCards.length > 1) {
        let maxSrcX = -Infinity;
        for (const cid of srcCards) {
          const a = layout.anchors[cid];
          if (a) maxSrcX = Math.max(maxSrcX, a.bounds.x + a.bounds.width);
        }
        let minTgtX = Infinity;
        for (const cid of tgtCards) {
          const a = layout.anchors[cid];
          if (a) minTgtX = Math.min(minTgtX, a.bounds.x);
        }
        if (maxSrcX >= minTgtX && Number.isFinite(maxSrcX) && Number.isFinite(minTgtX)) {
          diagnostics.push({
            rule: 'unsupported-geometry',
            severity: 'warning',
            message: `Bus "${fromList.join(', ')} --> ${toList.join(', ')}" (${srcCards.length} -> ${tgtCards.length} nodes) has unsupported multi-to-many geometry and was skipped.`,
          });
        }
      }
    }
  }

  // 3. Dangling Nodes (Cards that have 0 incoming and 0 outgoing buses)
  for (const cardId of allCardIds) {
    if (!connectedCards.has(cardId)) {
      diagnostics.push({
        rule: 'dangling-node',
        severity: 'warning',
        message: `Card "${cardId}" has 0 incoming and 0 outgoing buses.`,
        nodeOrBusId: cardId,
      });
    }
  }

  // 4. Visual Collisions (AABB detection between badges and cards)
  const cardBounds = Array.from(allCardIds)
    .map((id) => layout.anchors[id]?.bounds)
    .filter((b): b is Rect => Boolean(b));

  for (const el of layout.scene.elements) {
    // Platform bus badges are rects with rx: 4, height: 18
    if (el.type === 'rect' && el.rx === 4 && el.bounds && el.bounds.height === 18) {
      const badge = el.bounds;
      for (const card of cardBounds) {
        if (intersects(badge, card, 2)) {
          diagnostics.push({
            rule: 'badge-collision',
            severity: 'warning',
            message: `Bus badge at (${badge.x}, ${badge.y}) collides with card at (${card.x}, ${card.y}).`,
          });
        }
      }
    }
  }

  return diagnostics;
}
