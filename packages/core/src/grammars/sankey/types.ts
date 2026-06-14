/**
 * @file grammars/sankey/types.ts — Sankey Grammar Domain IR.
 *
 * Semantic-only IR: nodes inferred from links, no geometry or color.
 * Links carry source, target, value. Nodes carry stable first-appearance order.
 */

export interface SankeyNode {
  /** Unique node identifier (from source/target CSV fields). */
  id: string;
  /** Display label (same as id for Mermaid sankey-beta CSV syntax). */
  label: string;
  /** Index of first appearance in the input (for stable ordering). */
  order: number;
}

export interface SankeyLink {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Non-negative numeric flow value. */
  value: number;
}

export interface SankeyMetadata {
  title?: string;
  theme?: string;
}

export interface SankeyDocument {
  version: string;
  metadata: SankeyMetadata;
  /** Nodes in stable first-appearance order. */
  nodes: SankeyNode[];
  /** Links in declaration order. */
  links: SankeyLink[];
}
