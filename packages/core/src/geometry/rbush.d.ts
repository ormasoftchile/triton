/**
 * @file rbush.d.ts — Ambient type declarations for `rbush` v4.
 *
 * rbush v4 ships as plain ESM with no bundled `.d.ts`.  This minimal ambient
 * declaration covers exactly the surface the geometry kernel uses (a generic
 * R-tree with axis-aligned bounding-box entries).
 */
declare module 'rbush' {
  export interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export default class RBush<T = BBox> {
    constructor(maxEntries?: number);
    insert(item: T): this;
    load(items: ReadonlyArray<T>): this;
    remove(item: T, equalsFn?: (a: T, b: T) => boolean): this;
    clear(): this;
    search(bbox: BBox): T[];
    collides(bbox: BBox): boolean;
    all(): T[];
    toBBox(item: T): BBox;
    compareMinX(a: T, b: T): number;
    compareMinY(a: T, b: T): number;
  }
}
