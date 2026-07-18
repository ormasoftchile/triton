import type { Scene, ThemeInput, Result, BaseIR, LayoutResult, NodeAnchorRegistry, LayoutOptions, RevealTrack } from '../contracts/index.js';
import type { IconPackMap } from '../contracts/icons.js';
import { ok, err } from '../contracts/index.js';
import { detect } from './detect.js';
import { stripComments } from './preprocess.js';
import { registerDiagram, getModule } from './registry.js';
import { registerRenderer, getRenderer } from '../render/registry.js';
import { defaultTheme, getThemePreset } from '../theme/preset.js';
import { resolveTheme } from '../theme/resolver.js';
import { validateThemeInput, isBuiltinThemeName } from '../theme/validate.js';
import { flowchart } from '../diagrams/mermaid/flowchart/index.js';
import { timeline } from '../diagrams/mermaid/timeline/index.js';
import { poster } from '../diagrams/triton/poster/index.js';
import { pie } from '../diagrams/mermaid/pie/index.js';
import { xychart } from '../diagrams/mermaid/xychart/index.js';
import { quadrant } from '../diagrams/mermaid/quadrant/index.js';
import { radar } from '../diagrams/mermaid/radar/index.js';
import { gantt } from '../diagrams/mermaid/gantt/index.js';
import { journey } from '../diagrams/mermaid/journey/index.js';
import { kanban } from '../diagrams/mermaid/kanban/index.js';
import { sequence } from '../diagrams/mermaid/sequence/index.js';
import { classDiagram } from '../diagrams/mermaid/class/index.js';
import { state } from '../diagrams/mermaid/state/index.js';
import { er } from '../diagrams/mermaid/er/index.js';
import { block } from '../diagrams/triton/block/index.js';
import { requirement } from '../diagrams/mermaid/requirement/index.js';
import { sankey } from '../diagrams/mermaid/sankey/index.js';
import { mindmap } from '../diagrams/mermaid/mindmap/index.js';
import { gitgraph } from '../diagrams/mermaid/gitgraph/index.js';
import { c4 } from '../diagrams/mermaid/c4/index.js';
import { architecture } from '../diagrams/mermaid/architecture/index.js';
import { packet } from '../diagrams/triton/packet/index.js';
import { tree } from '../diagrams/triton/ds/tree/index.js';
import { plan } from '../diagrams/triton/ds/tree/plan.js';
import { avl } from '../diagrams/triton/ds/tree/avl.js';
import { rbtree } from '../diagrams/triton/ds/tree/rbtree.js';
import { btree } from '../diagrams/triton/ds/tree/btree.js';
import { radix } from '../diagrams/triton/ds/tree/radix.js';
import { segtree } from '../diagrams/triton/ds/tree/segtree.js';
import { heap } from '../diagrams/triton/ds/tree/heap.js';
import { array } from '../diagrams/triton/ds/struct/array.js';
import { linkedlist } from '../diagrams/triton/ds/struct/linkedlist.js';
import { memory } from '../diagrams/triton/ds/struct/memory.js';
import { page } from '../diagrams/triton/ds/struct/page.js';
import { queue } from '../diagrams/triton/ds/queue/queue.js';
import { cqueue } from '../diagrams/triton/ds/queue/cqueue.js';
import { deque } from '../diagrams/triton/ds/queue/deque.js';
import { pqueue } from '../diagrams/triton/ds/queue/pqueue.js';
import { stack } from '../diagrams/triton/ds/stack/stack.js';
import { hashmap } from '../diagrams/triton/ds/hashmap/hashmap.js';
import { matrix } from '../diagrams/triton/ds/matrix/matrix.js';
import { trie } from '../diagrams/triton/ds/trie/trie.js';
import { graph } from '../diagrams/triton/ds/graph/graph.js';
import { unionfind } from '../diagrams/triton/ds/unionfind/unionfind.js';
import { topology } from '../diagrams/triton/topology/topology.js';
import { list } from '../diagrams/triton/deck/list/list.js';
import { svgRenderer, embedAnchorManifest } from '../render/svg.js';
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
registerDiagram('queue', queue);
registerDiagram('cqueue', cqueue);
registerDiagram('deque', deque);
registerDiagram('pqueue', pqueue);
registerDiagram('stack', stack);
registerDiagram('hashmap', hashmap);
registerDiagram('matrix', matrix);
registerDiagram('trie', trie);
registerDiagram('nodegraph', graph);
registerDiagram('unionfind', unionfind);
registerDiagram('topology', topology);
registerDiagram('list', list);
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
  forcedThemeName?: string,
  icons?: IconPackMap,
): Result<LayoutResult> {
  const compiled = compileSyncWithTheme(input, themeInput, forcedThemeName, icons);
  return compiled.ok ? ok(compiled.value.layout) : compiled;
}

function compileSyncWithTheme(
  input: string,
  themeInput?: ThemeInput,
  forcedThemeName?: string,
  icons?: IconPackMap,
): Result<{ readonly layout: LayoutResult; readonly theme: ReturnType<typeof resolveTheme> }> {
  const cleaned = stripComments(input);
  const { format, diagramType } = detect(cleaned);

  const module = getModule(diagramType);
  if (!module) {
    return err('UNKNOWN_DIAGRAM', `No module registered for diagram type: ${diagramType}`);
  }

  try {
    const ir: BaseIR = format === 'yaml'
      ? module.parseYaml(cleaned)
      : module.parseMermaid(cleaned);

    // Build theme: forced preset → metadata preset → global input → module defaults → per-IR override
    const themeName = typeof ir.metadata?.theme === 'string' ? ir.metadata.theme : undefined;
    const base = resolveTheme(themeInput ?? {}, getThemePreset(forcedThemeName ?? themeName));
    const withModuleDefaults = module.defaultThemeOverride
      ? resolveTheme(module.defaultThemeOverride, base)
      : base;
    const finalTheme = ir.themeOverride
      ? resolveTheme(ir.themeOverride, withModuleDefaults)
      : withModuleDefaults;

    const layoutOptions: LayoutOptions | undefined = icons !== undefined ? { icons } : undefined;
    const result = module.layout(ir, finalTheme, layoutOptions);
    return ok({ layout: result, theme: finalTheme });
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
  forcedThemeName?: string,
  icons?: IconPackMap,
): Result<string> {
  const compileResult = compileSync(input, themeInput, forcedThemeName, icons);
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
 * Compile and render input text to SVG with an embedded anchor manifest.
 *
 * Identical parameter list to {@link renderSync}. Returns both the SVG string
 * (with the anchor manifest embedded as an inert `<script type="application/json">`
 * element) and the raw anchor registry for callers that need programmatic access.
 *
 * Use this in interactive contexts (e.g. VS Code preview) where node-reference
 * discovery is desired. For plain SVG output (golden tests, markdown preview)
 * use {@link renderSync} — it is intentionally kept anchor-manifest-free.
 *
 * Returns a Result — never throws.
 */
export function compileAndRenderSync(
  input: string,
  themeInput?: ThemeInput,
  rendererName = 'svg',
  forcedThemeName?: string,
  icons?: IconPackMap,
): Result<{ svg: string; anchors: NodeAnchorRegistry; reveal?: RevealTrack }> {
  const compileResult = compileSync(input, themeInput, forcedThemeName, icons);
  if (!compileResult.ok) return compileResult;

  const renderer = getRenderer<string>(rendererName);
  if (!renderer) {
    return err('UNKNOWN_RENDERER', `No renderer registered: ${rendererName}`);
  }

  try {
    const { scene, anchors, reveal } = compileResult.value;
    const svg = renderer.render(scene);
    // `reveal` is returned as DATA (svg stays manifest-free, mirroring anchors).
    // Hosts that opt into progressive reveal embed it via embedRevealManifest.
    return ok(reveal ? { svg, anchors, reveal } : { svg, anchors });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err('LAYOUT_ERROR', message, cause);
  }
}

export function compileAndRenderWithThemeSync(
  input: string,
  themeInput?: ThemeInput,
  rendererName = 'svg',
  forcedThemeName?: string,
  icons?: IconPackMap,
): Result<{ svg: string; anchors: NodeAnchorRegistry; theme: ReturnType<typeof resolveTheme> }> {
  const compileResult = compileSyncWithTheme(input, themeInput, forcedThemeName, icons);
  if (!compileResult.ok) return compileResult;

  const renderer = getRenderer<string>(rendererName);
  if (!renderer) {
    return err('UNKNOWN_RENDERER', `No renderer registered: ${rendererName}`);
  }

  try {
    const { layout, theme } = compileResult.value;
    const svg = renderer.render(layout.scene);
    return ok({ svg, anchors: layout.anchors, theme });
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
  forcedThemeName?: string,
): Promise<Result<LayoutResult>> {
  return compileSync(input, themeInput, forcedThemeName);
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
  forcedThemeName?: string,
): Promise<Result<string>> {
  return renderSync(input, themeInput, rendererName, forcedThemeName);
}

// ─── Theme validation (re-exported for npm consumers) ─────────────────────────

export { validateThemeInput, isBuiltinThemeName } from '../theme/validate.js';
