import type { DiagramModule, LayoutResult } from '../../contracts/index.js';
import type { XYChartDocument } from './ir.js';
import type { ResolvedTheme } from '../../contracts/index.js';
import { layoutXYChart } from './layout.js';
import * as parser from './parser.js';

export type { XYChartDocument, XYSeries, XYSeriesKind } from './ir.js';

export const xychart: DiagramModule<XYChartDocument> = {
  parseMermaid(input: string): XYChartDocument {
    return parser.parse(input) as XYChartDocument;
  },

  parseYaml(input: string): XYChartDocument {
    return JSON.parse(input) as XYChartDocument;
  },

  layout(ir: XYChartDocument, theme: ResolvedTheme): LayoutResult {
    return layoutXYChart(ir, theme);
  },
};
