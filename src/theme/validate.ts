/**
 * validateThemeInput
 *
 * Pure validator for external `.triton-theme.json` files. No file or network
 * I/O — only validates an already-parsed JSON value against the ThemeInput
 * contract. Returns a Result so callers never need try/catch.
 *
 * Policy (Cristian's decision): unknown keys at any level are a HARD ERROR,
 * not a warning. This catches typos early and keeps the schema unambiguous.
 */

import type { ThemeInput } from '../contracts/theme.js';
import { ok, err, type Result } from '../contracts/result.js';
import { themePresetNames } from './preset.js';

// ─── isBuiltinThemeName ───────────────────────────────────────────────────────

/** Returns true iff `name` is one of the built-in preset names. */
export function isBuiltinThemeName(name: string): boolean {
  return (themePresetNames as readonly string[]).includes(name);
}

// ─── Known key sets ───────────────────────────────────────────────────────────

const TOP_LEVEL_KEYS = new Set([
  'name', 'base', 'palette', 'typography', 'spacing', 'edges', 'panel',
]);

const PALETTE_KEYS = new Set([
  'primary', 'secondary', 'background', 'surface', 'border',
  'text', 'textMuted', 'success', 'warning', 'error',
]);

const TYPOGRAPHY_KEYS = new Set([
  'fontFamily', 'monoFamily', 'baseFontSize', 'titleFontSize', 'smallFontSize', 'lineHeight',
]);

const SPACING_KEYS = new Set([
  'unit', 'nodePadding', 'nodeGap', 'diagramMargin',
]);

const EDGES_KEYS = new Set([
  'strokeWidth', 'arrowSize', 'labelFontSize', 'curveTension',
]);

const PANEL_KEYS = new Set([
  'titleAlign', 'titlePosition', 'titleChrome',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SLUG      = /^[a-z0-9-]+$/;
const CSS_INJECTION = /url\s*\(|expression\s*\(/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function fail(message: string): Result<never> {
  return err('THEME_VALIDATION_ERROR', message);
}

// ─── Group validators ─────────────────────────────────────────────────────────

function validatePalette(obj: unknown): Result<Partial<import('../contracts/theme.js').ThemePalette>> {
  if (!isPlainObject(obj)) return fail('"palette" must be a plain object');

  for (const key of Object.keys(obj)) {
    if (!PALETTE_KEYS.has(key)) return fail(`Unknown key in palette: "${key}"`);
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val !== 'string' || !HEX_COLOR.test(val)) {
      return fail(`palette.${key} must be a CSS hex color (e.g. "#RGB" or "#RRGGBB"), got ${JSON.stringify(val)}`);
    }
  }

  return ok(obj as Partial<import('../contracts/theme.js').ThemePalette>);
}

function validateTypography(obj: unknown): Result<Partial<import('../contracts/theme.js').ThemeTypography>> {
  if (!isPlainObject(obj)) return fail('"typography" must be a plain object');

  for (const key of Object.keys(obj)) {
    if (!TYPOGRAPHY_KEYS.has(key)) return fail(`Unknown key in typography: "${key}"`);
  }

  const stringFields = ['fontFamily', 'monoFamily'] as const;
  for (const key of stringFields) {
    if (key in obj) {
      const val = obj[key];
      if (typeof val !== 'string') return fail(`typography.${key} must be a string`);
      if (CSS_INJECTION.test(val)) return fail(`typography.${key} contains disallowed CSS expression`);
    }
  }

  const positiveFields = ['baseFontSize', 'titleFontSize', 'smallFontSize', 'lineHeight'] as const;
  for (const key of positiveFields) {
    if (key in obj) {
      const val = obj[key];
      if (typeof val !== 'number' || val <= 0) {
        return fail(`typography.${key} must be a positive number, got ${JSON.stringify(val)}`);
      }
    }
  }

  return ok(obj as Partial<import('../contracts/theme.js').ThemeTypography>);
}

function validateSpacing(obj: unknown): Result<Partial<import('../contracts/theme.js').ThemeSpacing>> {
  if (!isPlainObject(obj)) return fail('"spacing" must be a plain object');

  for (const key of Object.keys(obj)) {
    if (!SPACING_KEYS.has(key)) return fail(`Unknown key in spacing: "${key}"`);
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val !== 'number' || val < 0) {
      return fail(`spacing.${key} must be a non-negative number, got ${JSON.stringify(val)}`);
    }
  }

  return ok(obj as Partial<import('../contracts/theme.js').ThemeSpacing>);
}

function validateEdges(obj: unknown): Result<Partial<import('../contracts/theme.js').ThemeEdges>> {
  if (!isPlainObject(obj)) return fail('"edges" must be a plain object');

  for (const key of Object.keys(obj)) {
    if (!EDGES_KEYS.has(key)) return fail(`Unknown key in edges: "${key}"`);
  }

  const nonNegativeFields = ['strokeWidth', 'arrowSize', 'labelFontSize'] as const;
  for (const key of nonNegativeFields) {
    if (key in obj) {
      const val = obj[key];
      if (typeof val !== 'number' || val < 0) {
        return fail(`edges.${key} must be a non-negative number, got ${JSON.stringify(val)}`);
      }
    }
  }

  if ('curveTension' in obj) {
    const val = obj['curveTension'];
    if (typeof val !== 'number' || val < 0 || val > 1) {
      return fail(`edges.curveTension must be a number between 0 and 1, got ${JSON.stringify(val)}`);
    }
  }

  return ok(obj as Partial<import('../contracts/theme.js').ThemeEdges>);
}

function validatePanel(obj: unknown): Result<Partial<import('../contracts/theme.js').ThemePanel>> {
  if (!isPlainObject(obj)) return fail('"panel" must be a plain object');

  for (const key of Object.keys(obj)) {
    if (!PANEL_KEYS.has(key)) return fail(`Unknown key in panel: "${key}"`);
  }

  if ('titleAlign' in obj) {
    const val = obj['titleAlign'];
    if (val !== 'left' && val !== 'center' && val !== 'right') {
      return fail(`panel.titleAlign must be "left", "center", or "right", got ${JSON.stringify(val)}`);
    }
  }

  if ('titlePosition' in obj) {
    const val = obj['titlePosition'];
    if (val !== 'inside' && val !== 'on-border' && val !== 'above') {
      return fail(`panel.titlePosition must be "inside", "on-border", or "above", got ${JSON.stringify(val)}`);
    }
  }

  if ('titleChrome' in obj) {
    const val = obj['titleChrome'];
    if (val !== 'none' && val !== 'box' && val !== 'pill') {
      return fail(`panel.titleChrome must be "none", "box", or "pill", got ${JSON.stringify(val)}`);
    }
  }

  return ok(obj as Partial<import('../contracts/theme.js').ThemePanel>);
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validate an unknown value against the ThemeInput contract.
 *
 * Pure and synchronous — never throws, never reads files.
 * Returns ok(ThemeInput) on success, err(...) on any violation.
 */
export function validateThemeInput(json: unknown): Result<ThemeInput> {
  if (!isPlainObject(json)) {
    return fail(`ThemeInput must be a non-null plain object, got ${json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json}`);
  }

  // Strict unknown-key check at top level
  for (const key of Object.keys(json)) {
    if (!TOP_LEVEL_KEYS.has(key)) return fail(`Unknown top-level key: "${key}"`);
  }

  const result: Record<string, unknown> = {};

  // name
  if ('name' in json) {
    const v = json['name'];
    if (typeof v !== 'string') return fail(`"name" must be a string, got ${JSON.stringify(v)}`);
    if (v.length < 1 || v.length > 64) return fail(`"name" must be 1–64 characters, got length ${v.length}`);
    if (!SLUG.test(v)) return fail(`"name" must match ^[a-z0-9-]+$, got ${JSON.stringify(v)}`);
    result['name'] = v;
  }

  // base
  if ('base' in json) {
    const v = json['base'];
    if (typeof v !== 'string') return fail(`"base" must be a string, got ${JSON.stringify(v)}`);
    if (!isBuiltinThemeName(v)) return fail(`"base" must be a built-in preset name; "${v}" is not recognised`);
    result['base'] = v;
  }

  // palette
  if ('palette' in json) {
    const r = validatePalette(json['palette']);
    if (!r.ok) return r;
    result['palette'] = r.value;
  }

  // typography
  if ('typography' in json) {
    const r = validateTypography(json['typography']);
    if (!r.ok) return r;
    result['typography'] = r.value;
  }

  // spacing
  if ('spacing' in json) {
    const r = validateSpacing(json['spacing']);
    if (!r.ok) return r;
    result['spacing'] = r.value;
  }

  // edges
  if ('edges' in json) {
    const r = validateEdges(json['edges']);
    if (!r.ok) return r;
    result['edges'] = r.value;
  }

  // panel
  if ('panel' in json) {
    const r = validatePanel(json['panel']);
    if (!r.ok) return r;
    result['panel'] = r.value;
  }

  return ok(result as ThemeInput);
}
