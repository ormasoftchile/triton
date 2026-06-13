/**
 * @file grammars/tree/types.ts — Tree Grammar Domain IR.
 *
 * The Tree Grammar is the fourth grammar in the diagram compiler and the
 * second de-risked grammar (after Sequence). Its layout engine is the
 * Buchheim–Jünger–Leipert tidy-tree algorithm: deterministic and O(n).
 *
 * Canonical representation: nested children-list per node. This is chosen
 * because nesting structurally prevents cycles and orphans, and sibling
 * order is explicit (list order = left-to-right placement).
 *
 * LOWERING: TreeDocument → layoutTree() → Scene (shared kernel IR)
 * The Scene is then consumed by sceneToSvg / sceneToPngSkia unchanged.
 */

// ---------------------------------------------------------------------------
// TreeNode
// ---------------------------------------------------------------------------

/**
 * A single node in the rooted tree.
 *
 * Nodes are nested: each node's `children` list contains its direct
 * children in left-to-right display order. The root is the top-level node
 * in `tree.root`. Nesting guarantees no cycles and no orphans by construction.
 *
 * SEMANTIC FIELDS ONLY — no colors, fonts, or layout parameters here.
 * All visual decisions belong in TreeTheme.
 */
export interface TreeNode {
  /** Document-unique identifier (kebab-case, e.g. "ch1", "s2-3"). */
  id: string;
  /** Display text rendered inside the node box. */
  label: string;
  /**
   * Ordered child nodes. List order defines left-to-right placement.
   * Leaf nodes omit this field or set it to [].
   */
  children?: TreeNode[];
  /**
   * Semantic kind hint. A TreeTheme may use this to select visual treatment
   * (fill color, shape, border style) per kind. The grammar assigns no visual
   * meaning — only the theme does. Free-string; common values: "root",
   * "chapter", "section", "person", "folder", "decision".
   */
  kind?: string;
  /**
   * Icon registry key (e.g. "folder", "people"). The theme controls whether
   * icons are shown and how they are sized/positioned.
   */
  icon?: string;
  /**
   * Rendering hint: when true, the subtree rooted at this node is visually
   * elided. The node itself is rendered; children are hidden. Static backends
   * render a "+" expander indicator below the node.
   */
  collapsed?: boolean;
  /** Tooltip or secondary text. Not rendered in v1. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Document root
// ---------------------------------------------------------------------------

export interface TreeMetadata {
  /** Diagram title (not rendered; used for metadata/export). */
  title?: string;
  /** Optional subtitle. Not rendered in v1. */
  subtitle?: string;
  /** Theme name. Default: 'default-tree'. */
  theme?: string;
}

export interface TreeDefinition {
  /** The single root node of the tree. */
  root: TreeNode;
}

/** Root document for the Tree Grammar IR. */
export interface TreeDocument {
  /** Spec version (semver string, e.g. "1.0"). */
  version: string;
  metadata: TreeMetadata;
  /** The tree definition (contains the single root node). */
  tree: TreeDefinition;
}
