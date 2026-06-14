/**
 * @file grammars/requirement/types.ts — Requirement Diagram Domain IR.
 *
 * Semantic-only IR for Mermaid requirementDiagram syntax. Visual decisions
 * are deferred to RequirementTheme and the layout engine.
 *
 * Mermaid supports five requirement block keywords plus element blocks and
 * seven relationship kinds (satisfies, contains, copies, derives, verifies,
 * refines, traces).
 */

/** Requirement block type — rendered as «stereotype» in the title band. */
export type RequirementKind =
  | 'requirement'
  | 'functionalRequirement'
  | 'interfaceRequirement'
  | 'performanceRequirement'
  | 'physicalRequirement'
  | 'designConstraint';

/** Risk level for a requirement. */
export type RequirementRisk = 'high' | 'medium' | 'low';

/** Verify method for a requirement. */
export type RequirementVerifyMethod = 'test' | 'analysis' | 'inspection' | 'demonstration';

/** Relationship kind between two requirements/elements. */
export type RequirementRelKind =
  | 'satisfies'
  | 'contains'
  | 'copies'
  | 'derives'
  | 'verifies'
  | 'refines'
  | 'traces';

/** A requirement block node. */
export interface RequirementNode {
  /** Unique name/id used in relationships. */
  name: string;
  /** Block keyword — determines «stereotype» label. */
  kind: RequirementKind;
  /** Optional numeric or string id field. */
  id?: string;
  /** Requirement text description. */
  text?: string;
  /** Risk level. */
  risk?: RequirementRisk;
  /** Verification method. */
  verifymethod?: RequirementVerifyMethod;
}

/** An element block node. */
export interface RequirementElement {
  /** Unique name/id used in relationships. */
  name: string;
  /** Element type description. */
  type?: string;
  /** Document reference. */
  docref?: string;
}

/** A relationship between two nodes (requirements or elements). */
export interface RequirementRelationship {
  /** Source node name. */
  src: string;
  /** Destination node name. */
  dst: string;
  /** Relationship kind — rendered as «kind» pill on the edge. */
  kind: RequirementRelKind;
}

export interface RequirementMetadata {
  title?: string;
  theme?: string;
}

/** Top-level domain IR document for requirementDiagram. */
export interface RequirementDocument {
  version: string;
  metadata: RequirementMetadata;
  /** All requirement nodes in declaration order. */
  requirements: RequirementNode[];
  /** All element nodes in declaration order. */
  elements: RequirementElement[];
  /** All relationships in declaration order. */
  relationships: RequirementRelationship[];
}
