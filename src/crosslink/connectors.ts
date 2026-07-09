/**
 * Diagram-agnostic post-layout connector stage.
 *
 * This is the neutral seam over the existing cross-link routing/rendering
 * engine. Callers lower their own semantics to local endpoint keys; poster uses
 * its NodeAddress adapter, while single diagrams can use plain keys like `c3`.
 */

import type { SceneElement } from '../contracts/scene.js';
import type { CardinalSide, NodeAnchorRegistry, OccupiedPort } from '../contracts/anchors.js';
import type { CrossLink, CrossLinkAnimation, CrossLinkDirection, CrossLinkEdgeStyle, NodeAddress } from '../contracts/crosslink.js';
import type { Rect } from '../contracts/primitives.js';
import type { CurveStyle, RouteStyle } from '../contracts/routing.js';
import type { ResolvedTheme } from '../contracts/theme.js';
import { routeAndRenderCrossLinks3 } from './engine3.js';

export interface NormalizedConnectorSpec {
  readonly fromKey: string;
  readonly toKey: string;
  readonly direction: CrossLinkDirection;
  readonly style: CrossLinkEdgeStyle;
  readonly label?: string;
  readonly routing?: RouteStyle;
  readonly curveStyle?: CurveStyle;
  readonly exitWall?: CardinalSide;
  readonly entryWall?: CardinalSide;
  readonly animation?: CrossLinkAnimation;
  readonly props?: Readonly<Record<string, string | number>>;
  /**
   * Optional blocked-container IDs for endpoint-aware obstacle exclusion.
   * Poster passes cell paths here; local DS diagrams normally omit them.
   */
  readonly fromContainerKey?: string;
  readonly toContainerKey?: string;
}

export interface ConnectorDiagnostic {
  readonly connectorIndex: number;
  readonly message: string;
}

export interface ConnectorExtents {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ConnectorStageInput {
  readonly elements?: readonly SceneElement[];
  readonly layerBuckets?: Readonly<Record<string, readonly SceneElement[]>>;
  readonly anchors: NodeAnchorRegistry;
  readonly connectors: readonly NormalizedConnectorSpec[];
  readonly theme: ResolvedTheme;
  readonly occupiedPorts?: readonly OccupiedPort[];
  readonly occupiedTextRects?: readonly Rect[];
  readonly routingObstacles?: readonly Rect[];
  readonly containerObstacles?: ReadonlyMap<string, Rect>;
}

export interface ConnectorStageResult {
  readonly pathElements: SceneElement[];
  readonly labelElements: SceneElement[];
  readonly elements: SceneElement[];
  readonly defs: string[];
  readonly diagnostics: ConnectorDiagnostic[];
  readonly extents: ConnectorExtents;
}

export function routeConnectors(input: ConnectorStageInput): ConnectorStageResult {
  const diagnostics = connectorDiagnostics(input.connectors, input.anchors);
  const resolvable = input.connectors.filter(spec =>
    input.anchors[spec.fromKey] !== undefined && input.anchors[spec.toKey] !== undefined,
  );

  const links = resolvable.map(specToCrossLink);
  const rendered = links.length > 0
    ? routeAndRenderCrossLinks3(
      links,
      input.theme,
      input.anchors,
      input.occupiedPorts,
      input.occupiedTextRects,
      input.routingObstacles,
      input.containerObstacles,
    )
    : { defs: [], elements: [] };

  const pathElements = rendered.elements.filter(e => e.type !== 'text');
  const labelElements = rendered.elements.filter(e => e.type === 'text');

  return {
    pathElements,
    labelElements,
    elements: rendered.elements,
    defs: rendered.defs,
    diagnostics,
    extents: connectorExtents(rendered.elements),
  };
}

export function crossLinksToConnectorSpecs(
  links: readonly CrossLink[],
  defaults?: { curveStyle?: CurveStyle },
): NormalizedConnectorSpec[] {
  return links.map(link => {
    const fromKey = addressToKey(link.from);
    const toKey = addressToKey(link.to);
    const curveStyle = link.curveStyle ?? defaults?.curveStyle;
    return {
      fromKey,
      toKey,
      direction: link.direction,
      style: link.style,
      ...(link.label !== undefined ? { label: link.label } : {}),
      ...(link.routing !== undefined ? { routing: link.routing } : {}),
      ...(curveStyle !== undefined ? { curveStyle } : {}),
      ...(link.exitWall !== undefined ? { exitWall: link.exitWall } : {}),
      ...(link.entryWall !== undefined ? { entryWall: link.entryWall } : {}),
      ...(link.animation !== undefined ? { animation: link.animation } : {}),
      ...(link.props !== undefined ? { props: link.props } : {}),
      ...(link.from.cellPath.length > 0 ? { fromContainerKey: link.from.cellPath.join('.') } : {}),
      ...(link.to.cellPath.length > 0 ? { toContainerKey: link.to.cellPath.join('.') } : {}),
    };
  });
}

function connectorDiagnostics(
  connectors: readonly NormalizedConnectorSpec[],
  anchors: NodeAnchorRegistry,
): ConnectorDiagnostic[] {
  const diagnostics: ConnectorDiagnostic[] = [];
  for (let i = 0; i < connectors.length; i++) {
    const spec = connectors[i]!;
    if (!anchors[spec.fromKey]) {
      diagnostics.push({ connectorIndex: i, message: `Cannot resolve source: "${spec.fromKey}" not found in anchor registry` });
    }
    if (!anchors[spec.toKey]) {
      diagnostics.push({ connectorIndex: i, message: `Cannot resolve target: "${spec.toKey}" not found in anchor registry` });
    }
  }
  return diagnostics;
}

function specToCrossLink(spec: NormalizedConnectorSpec): CrossLink {
  return {
    from: keyToAddress(spec.fromKey, spec.fromContainerKey),
    to: keyToAddress(spec.toKey, spec.toContainerKey),
    direction: spec.direction,
    style: spec.style,
    ...(spec.label !== undefined ? { label: spec.label } : {}),
    ...(spec.routing !== undefined ? { routing: spec.routing } : {}),
    ...(spec.curveStyle !== undefined ? { curveStyle: spec.curveStyle } : {}),
    ...(spec.exitWall !== undefined ? { exitWall: spec.exitWall } : {}),
    ...(spec.entryWall !== undefined ? { entryWall: spec.entryWall } : {}),
    ...(spec.animation !== undefined ? { animation: spec.animation } : {}),
    ...(spec.props !== undefined ? { props: spec.props } : {}),
  };
}

function keyToAddress(key: string, containerKey?: string): NodeAddress {
  if (containerKey && key.startsWith(`${containerKey}.`)) {
    return {
      cellPath: containerKey.split('.'),
      nodeId: key.slice(containerKey.length + 1),
    };
  }
  return { cellPath: [], nodeId: key };
}

function addressToKey(addr: NodeAddress): string {
  return [...addr.cellPath, addr.nodeId].join('.');
}

function connectorExtents(elements: readonly SceneElement[]): ConnectorExtents {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    if (el.type === 'path') {
      const nums: number[] = [];
      for (const m of el.d.matchAll(/-?\d+(?:\.\d+)?/g)) {
        const n = parseFloat(m[0]);
        if (!Number.isNaN(n)) nums.push(n);
      }
      for (let i = 0; i + 1 < nums.length; i += 2) {
        minX = Math.min(minX, nums[i]!);
        minY = Math.min(minY, nums[i + 1]!);
        maxX = Math.max(maxX, nums[i]!);
        maxY = Math.max(maxY, nums[i + 1]!);
      }
    } else if (el.type === 'text') {
      const approxW = el.content.length * (el.fontSize ?? 12) * 0.65;
      const left = el.anchor === 'middle'
        ? el.position.x - approxW / 2
        : el.anchor === 'end'
          ? el.position.x - approxW
          : el.position.x;
      const top = el.position.y - (el.fontSize ?? 12);
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + approxW);
      maxY = Math.max(maxY, el.position.y + (el.fontSize ?? 12));
    }
  }

  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
