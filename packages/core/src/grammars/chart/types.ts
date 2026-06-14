/**
 * @file grammars/chart/types.ts — Chart Grammar Domain IR.
 */

export interface ChartDocument {
  version: string;
  chartType: 'pie' | 'xy' | 'quadrant' | 'radar';
  title?: string;
  data: ChartData;
  encoding: ChartEncoding;
  config?: ChartConfig;
}

export interface ChartData {
  values: Array<Record<string, number | string>>;
}

export interface ChartEncoding {
  x?: FieldEncoding;
  y?: FieldEncoding;
  color?: FieldEncoding;
  size?: FieldEncoding;
  theta?: FieldEncoding;
  label?: FieldEncoding;
}

export interface FieldEncoding {
  field: string;
  type: 'quantitative' | 'nominal' | 'ordinal';
  scale?: ScaleConfig;
}

export interface ScaleConfig {
  domain?: [number, number] | string[];
  range?: [number, number];
  nice?: boolean;
}

export interface ChartConfig {
  marks?: string[];
  showData?: boolean;
  innerRadius?: number;
  padding?: number;
  xTitle?: string;
  yTitle?: string;
  yMin?: number;
  yMax?: number;
}
