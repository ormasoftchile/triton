declare module 'pathfinding' {
  export class Grid {
    constructor(width: number, height: number, matrix?: number[][]): Grid;
    constructor(matrix: number[][]): Grid;
  }

  export class AStarFinder {
    constructor(options?: {
      allowDiagonal?: boolean;
      dontCrossCorners?: boolean;
      heuristic?: (dx: number, dy: number) => number;
      weight?: number;
    });
    findPath(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      grid: Grid
    ): Array<[number, number]>;
  }
}
