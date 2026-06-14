/**
 * @file grammars/class/types.ts — Class Grammar Domain IR.
 *
 * Semantic-only UML class diagram representation. Visual decisions are deferred
 * to ClassTheme and the layout engine.
 */

// Visibility: '+' public, '-' private, '#' protected, '~' package
// MemberModifier: 'abstract' | 'static'
// Stereotype: '<<interface>>' | '<<abstract>>' | '<<enumeration>>' | string
// RelationshipKind: 'inheritance' | 'realization' | 'composition' | 'aggregation' | 'association' | 'dependency'
// direction: '-->' means from→to; for cardinality labels, from_cardinality and to_cardinality

export interface ClassMember {
  visibility?: '+' | '-' | '#' | '~';
  name: string;
  type?: string;
  isMethod: boolean;
  params?: string;
  modifiers?: Array<'abstract' | 'static'>;
}

export interface ClassDef {
  id: string;
  name: string;
  stereotype?: string;
  members: ClassMember[];
}

export interface ClassRelationship {
  from: string;
  to: string;
  kind: 'inheritance' | 'realization' | 'composition' | 'aggregation' | 'association' | 'dependency';
  fromCardinality?: string;
  toCardinality?: string;
  label?: string;
}

export interface ClassMetadata {
  title?: string;
  theme?: string;
}

export interface ClassDocument {
  version: string;
  metadata: ClassMetadata;
  classes: ClassDef[];
  relationships: ClassRelationship[];
}
