import type { Scene, ThemeInput, Result, BaseIR, LayoutResult } from '../contracts/index.js';
import { ok, err } from '../contracts/index.js';
import { detect } from './detect.js';
import { registerDiagram, getModule } from './registry.js';
import { registerRenderer, getRenderer } from '../render/registry.js';
import { defaultTheme, getThemePreset } from '../theme/preset.js';
import { resolveTheme } from '../theme/resolver.js';
import { flowchart } from '../diagrams/flowchart/index.js';
import { timeline } from '../diagrams/timeline/index.js';
import { poster } from '../diagrams/poster/index.js';
import { pie } from '../diagrams/pie/index.js';
import { xychart } from '../diagrams/xychart/index.js';
import { quadrant } from '../diagrams/quadrant/index.js';
import { radar } from '../diagrams/radar/index.js';
import { gantt } from '../diagrams/gantt/index.js';
import { journey } from '../diagrams/journey/index.js';
import { kanban } from '../diagrams/kanban/index.js';
import { sequence } from '../diagrams/sequence/index.js';
import { classDiagram } from '../diagrams/class/index.js';
import { state } from '../diagrams/state/index.js';
import { er } from '../diagrams/er/index.js';
import { block } from '../diagrams/block/index.js';
import { requirement } from '../diagrams/requirement/index.js';
import { sankey } from '../diagrams/sankey/index.js';
import { mindmap } from '../diagrams/mindmap/index.js';
import { gitgraph } from '../diagrams/gitgraph/index.js';
import { c4 } from '../diagrams/c4/index.js';
import { architecture } from '../diagrams/architecture/index.js';
import { packet } from '../diagrams/packet/index.js';
import { tree } from '../diagrams/tree/index.js';
import { plan } from '../diagrams/tree/plan.js';
import { avl } from '../diagrams/tree/avl.js';
import { rbtree } from '../diagrams/tree/rbtree.js';
import { btree } from '../diagrams/tree/btree.js';
import { radix } from '../diagrams/tree/radix.js';
import { segtree } from '../diagrams/tree/segtree.js';
import { heap } from '../diagrams/tree/heap.js';
import { array } from '../diagrams/struct/array.js';
import { linkedlist } from '../diagrams/struct/linkedlist.js';
import { memory } from '../diagrams/struct/memory.js';
import { page } from '../diagrams/struct/page.js';
import { topology } from '../diagrams/topology/topology.js';
import { svgRenderer } from '../render/svg.js';
import { registerRouter } from '../routing/registry.js';
import {
  straightRouter,
  orthogonalRouter,
  bezierRouter,
  polylineRouter,
} from '../routing/router.js';

// ─── Register built-ins ───────────────────────────────────────────────────────

registerDiagram('flowchart', flowchart);
registerDiagram('timeline', timeline);
registerDiagram('poster', poster);
registerDiagram('pie', pie);
registerDiagram('xychart', xychart);
registerDiagram('quadrant', quadrant);
registerDiagram('radar', radar);
registerDiagram('gantt', gantt);
registerDiagram('journey', journey);
registerDiagram('kanban', kanban);
registerDiagram('sequence', sequence);
registerDiagram('class', classDiagram);
registerDiagram('state', state);
registerDiagram('er', er);
registerDiagram('block', block);
registerDiagram('requirement', requirement);
registerDiagram('sankey', sankey);
registerDiagram('mindmap', mindmap);
registerDiagram('gitgraph', gitgraph);
registerDiagram('c4', c4);
registerDiagram('architecture', architecture);
registerDiagram('packet', packet);
registerDiagram('tree', tree);
registerDiagram('plan', plan);
registerDiagram('avl', avl);
registerDiagram('rbtree', rbtree);
registerDiagram('btree', btree);
registerDiagram('radix', radix);
registerDiagram('segtree', segtree);
registerDiagram('heap', heap);
registerDiagram('array', array);
registerDiagram('linkedlist', linkedlist);
registerDiagram('memory', memory);
registerDiagram('page', page);
registerDiagram('topology', topology);
registerRenderer(svgRenderer);
registerRouter('straight', straightRouter);
registerRouter('orthogonal', orthogonalRouter);
registerRouter('bezier', bezierRouter);
registerRouter('polyline', polylineRouter);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compile input text to a LayoutResult (Scene + anchor registry) — synchronous.
 *
 * Every Triton layout engine is synchronous (no font I/O, WASM, or fetching),
 * so the whole parse → theme → layout pipeline runs without promises. This is
 * the canonical implementation; the async `compile()` is a thin wrapper.
 *
 * Theme resolution order (later overrides earlier):
 *   defaultTheme ← themeInput ← module.defaultThemeOverride ← ir.themeOverride
 *
 * Returns a Result — never throws.
 */
export function compileSync(
  input: string,
  themeInput?: ThemeInput,
): Result<LayoutResult> {
  const { format, diagramType } = detect(input);

  const module = getModule(diagramType);
  if (!module) {
    return err('UNKNOWN_DIAGRAM', `No module registered for diagram type: ${diagramType}`);
  }

  try {
    const ir: BaseIR = format === 'yaml'
      ? module.parseYaml(input)
      : module.parseMermaid(input);

    // Build theme: named preset (metadata.theme) → global input → module defaults → per-IR override
    const themeName = typeof ir.metadata?.theme === 'string' ? ir.metadata.theme : undefined;
    const base = resolveTheme(themeInput ?? {}, getThemePreset(themeName));
    const withModuleDefaults = module.defaultThemeOverride
      ? resolveTheme(module.defaultThemeOverride, base)
      : base;
    const finalTheme = ir.themeOverride
      ? resolveTheme(ir.themeOverride, withModuleDefaults)
      : withModuleDefaults;

    const result = module.layout(ir, finalTheme);
    return ok(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err('PARSE_ERROR', message, cause);
  }
}

/**
 * Render input text to an output string (default: SVG) — synchronous.
 *
 * This is the canonical render path; the async `render()` is a thin wrapper.
 * Returns a Result — never throws.
 * Pass rendererName to use a non-default registered renderer.
 */
export function renderSync(
  input: string,
  themeInput?: ThemeInput,
  rendererName = 'svg',
): Result<string> {
  const compileResult = compileSync(input, themeInput);
  if (!compileResult.ok) return compileResult;

  const renderer = getRenderer<string>(rendererName);
  if (!renderer) {
    return err('UNKNOWN_RENDERER', `No renderer registered: ${rendererName}`);
  }

  try {
    return ok(renderer.render(compileResult.value.scene));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err('LAYOUT_ERROR', message, cause);
  }
}

/**
 * Compile input text to a LayoutResult (Scene + anchor registry).
 *
 * Async wrapper over {@link compileSync} — the signature and behavior are
 * unchanged for existing callers. Theme resolution order (later overrides
 * earlier):
 *   defaultTheme ← themeInput ← module.defaultThemeOverride ← ir.themeOverride
 *
 * Returns a Result — never throws.
 */
export async function compile(
  input: string,
  themeInput?: ThemeInput,
): Promise<Result<LayoutResult>> {
  return compileSync(input, themeInput);
}

/**
 * Render input text to an output string (default: SVG).
 *
 * Async wrapper over {@link renderSync} — the signature and behavior are
 * unchanged for existing callers.
 *
 * Returns a Result — never throws.
 * Pass rendererName to use a non-default registered renderer.
 */
export async function render(
  input: string,
  themeInput?: ThemeInput,
  rendererName = 'svg',
): Promise<Result<string>> {
  return renderSync(input, themeInput, rendererName);
}

