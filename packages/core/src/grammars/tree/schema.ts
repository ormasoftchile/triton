/**
 * @file grammars/tree/schema.ts — Zod schema for TreeDocument.
 *
 * Validates:
 *  - version is present.
 *  - tree.root is non-empty (id + label).
 *  - Node ids are globally unique across all levels of nesting.
 *  - Recursive children structure is well-formed.
 *
 * The canonical children-list form prevents cycles and orphans by
 * construction (nested YAML/JSON cannot reference an ancestor). Uniqueness
 * is the only cross-node constraint that requires an explicit check.
 *
 * Mirrors the style of packages/core/src/grammars/sequence/schema.ts.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

/** Kebab-case id: must start with a letter, then letters/digits/hyphens. */
const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, {
    message: 'id must match ^[a-z][a-z0-9-]*$ (e.g. "doc", "ch1", "s1-2")',
  });

// ---------------------------------------------------------------------------
// TreeNode (recursive)
// ---------------------------------------------------------------------------

/** Zod-typed leaf before recursion. */
const treeNodeBaseSchema = z.object({
  id: idSchema,
  label: z.string().min(1, 'Node label must not be empty'),
  kind: z.string().optional(),
  icon: z.string().optional(),
  collapsed: z.boolean().optional(),
  description: z.string().optional(),
});

/**
 * Recursive tree node schema.
 * `z.lazy` is required for self-referential types.
 */
export type TreeNodeInput = z.input<typeof treeNodeBaseSchema> & {
  children?: TreeNodeInput[];
};

const treeNodeSchema: z.ZodType<TreeNodeInput> = treeNodeBaseSchema.extend({
  children: z.lazy(() => z.array(treeNodeSchema)).optional(),
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const treeMetadataSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  theme: z.string().optional(),
});

// ---------------------------------------------------------------------------
// TreeDefinition — cross-node uniqueness check
// ---------------------------------------------------------------------------

/** Collect all ids from a (possibly nested) tree node recursively. */
function collectIds(
  node: TreeNodeInput,
  ids: Map<string, string>,
  path: string,
): void {
  if (ids.has(node.id)) {
    throw new Error(
      `Duplicate node id '${node.id}' found at path '${path}' (first seen at '${ids.get(node.id)}')`,
    );
  }
  ids.set(node.id, path);
  for (const [i, child] of (node.children ?? []).entries()) {
    collectIds(child, ids, `${path}.children[${i}]`);
  }
}

const treeDefinitionSchema = z
  .object({
    root: treeNodeSchema,
  })
  .superRefine((def, ctx) => {
    try {
      const ids = new Map<string, string>();
      collectIds(def.root, ids, 'tree.root');
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: (err as Error).message,
      });
    }
  });

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

export const treeDocumentSchema = z.object({
  version: z.string().min(1, 'version is required'),
  metadata: treeMetadataSchema,
  tree: treeDefinitionSchema,
});

export type TreeDocumentInput = z.input<typeof treeDocumentSchema>;
