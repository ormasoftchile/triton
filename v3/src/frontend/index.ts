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
registerRenderer(svgRenderer);
registerRouter('straight', straightRouter);
registerRouter('orthogonal', orthogonalRouter);
registerRouter('bezier', bezierRouter);
registerRouter('polyline', polylineRouter);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compile input text to a LayoutResult (Scene + anchor registry).
 *
 * Theme resolution order (later overrides earlier):
 *   defaultTheme ← themeInput ← module.defaultThemeOverride ← ir.themeOverride
 *
 * Returns a Result — never throws.
 */
export async function compile(
  input: string,
  themeInput?: ThemeInput,
): Promise<Result<LayoutResult>> {
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

    const result = await module.layout(ir, finalTheme);
    return ok(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err('PARSE_ERROR', message, cause);
  }
}

/**
 * Render input text to an output string (default: SVG).
 *
 * Returns a Result — never throws.
 * Pass rendererName to use a non-default registered renderer.
 */
export async function render(
  input: string,
  themeInput?: ThemeInput,
  rendererName = 'svg',
): Promise<Result<string>> {
  const compileResult = await compile(input, themeInput);
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

