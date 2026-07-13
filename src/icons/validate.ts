/**
 * validateIconPack
 *
 * Pure validator for `.triton-icons.json` icon pack files. No file or network
 * I/O — only validates an already-parsed JSON value against the IconifyJSON
 * contract. Returns a Result so callers never need try/catch.
 *
 * Strictness policy:
 *   - Top-level Triton keys: strict (unknown keys are an error).
 *   - IconData and IconAlias entries: strict (unknown keys are an error).
 *   - All required fields must be present with the correct types.
 *   - Icon names and prefix format are validated against the token grammar.
 *
 * Token grammar (enforced here):
 *   prefix  ::= [a-z][a-z0-9-]*
 *   name    ::= [a-z0-9][a-z0-9-]*
 */

import type { IconifyJSON, IconData, IconAlias } from '../contracts/icons.js';
import { ok, err, type Result } from '../contracts/result.js';

// ─── Known key sets ───────────────────────────────────────────────────────────

const TOP_LEVEL_KEYS = new Set([
  'prefix', 'icons', 'aliases', 'width', 'height', 'left', 'top',
]);

const ICON_DATA_KEYS = new Set([
  'body', 'width', 'height', 'left', 'top', 'rotate', 'hFlip', 'vFlip',
]);

const ICON_ALIAS_KEYS = new Set([
  'parent', 'rotate', 'hFlip', 'vFlip', 'width', 'height', 'left', 'top',
]);

// ─── Token grammar regexes ────────────────────────────────────────────────────

/** Pack prefix: starts with a lowercase letter, then lowercase alnum/hyphens. */
const PREFIX_RE = /^[a-z][a-z0-9-]*$/;

/** Icon/alias name: starts with lowercase alnum, then lowercase alnum/hyphens. */
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

const VALID_ROTATE = new Set([0, 1, 2, 3]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function fail(message: string): Result<never> {
  return err('ICON_VALIDATION_ERROR', message);
}

// ─── IconData validator ───────────────────────────────────────────────────────

function validateIconData(iconName: string, obj: unknown): Result<IconData> {
  const ctx = `icons["${iconName}"]`;

  if (!isPlainObject(obj)) {
    return fail(`${ctx} must be a plain object`);
  }

  for (const key of Object.keys(obj)) {
    if (!ICON_DATA_KEYS.has(key)) {
      return fail(`Unknown key in ${ctx}: "${key}"`);
    }
  }

  // body — required, non-empty string
  if (!('body' in obj)) {
    return fail(`${ctx} is missing required field "body"`);
  }
  const body = obj['body'];
  if (typeof body !== 'string' || body.length === 0) {
    return fail(`${ctx}.body must be a non-empty string, got ${JSON.stringify(body)}`);
  }

  // width / height — optional positive numbers
  for (const dim of ['width', 'height'] as const) {
    if (dim in obj) {
      const val = obj[dim];
      if (typeof val !== 'number' || val <= 0) {
        return fail(`${ctx}.${dim} must be a positive number, got ${JSON.stringify(val)}`);
      }
    }
  }

  // left / top — optional numbers (may be zero or negative for unusual viewBoxes)
  for (const origin of ['left', 'top'] as const) {
    if (origin in obj) {
      const val = obj[origin];
      if (typeof val !== 'number') {
        return fail(`${ctx}.${origin} must be a number, got ${JSON.stringify(val)}`);
      }
    }
  }

  // rotate — optional, must be 0 | 1 | 2 | 3
  if ('rotate' in obj) {
    const val = obj['rotate'];
    if (!VALID_ROTATE.has(val as number)) {
      return fail(`${ctx}.rotate must be 0, 1, 2, or 3, got ${JSON.stringify(val)}`);
    }
  }

  // hFlip / vFlip — optional booleans
  for (const flip of ['hFlip', 'vFlip'] as const) {
    if (flip in obj) {
      const val = obj[flip];
      if (typeof val !== 'boolean') {
        return fail(`${ctx}.${flip} must be a boolean, got ${JSON.stringify(val)}`);
      }
    }
  }

  return ok(obj as unknown as IconData);
}

// ─── IconAlias validator ──────────────────────────────────────────────────────

function validateIconAlias(aliasName: string, obj: unknown): Result<IconAlias> {
  const ctx = `aliases["${aliasName}"]`;

  if (!isPlainObject(obj)) {
    return fail(`${ctx} must be a plain object`);
  }

  for (const key of Object.keys(obj)) {
    if (!ICON_ALIAS_KEYS.has(key)) {
      return fail(`Unknown key in ${ctx}: "${key}"`);
    }
  }

  // parent — required, non-empty string
  if (!('parent' in obj)) {
    return fail(`${ctx} is missing required field "parent"`);
  }
  const parent = obj['parent'];
  if (typeof parent !== 'string' || parent.length === 0) {
    return fail(`${ctx}.parent must be a non-empty string, got ${JSON.stringify(parent)}`);
  }

  // rotate — optional, 0 | 1 | 2 | 3
  if ('rotate' in obj) {
    const val = obj['rotate'];
    if (!VALID_ROTATE.has(val as number)) {
      return fail(`${ctx}.rotate must be 0, 1, 2, or 3, got ${JSON.stringify(val)}`);
    }
  }

  // hFlip / vFlip — optional booleans
  for (const flip of ['hFlip', 'vFlip'] as const) {
    if (flip in obj) {
      const val = obj[flip];
      if (typeof val !== 'boolean') {
        return fail(`${ctx}.${flip} must be a boolean, got ${JSON.stringify(val)}`);
      }
    }
  }

  // width / height — optional positive numbers
  for (const dim of ['width', 'height'] as const) {
    if (dim in obj) {
      const val = obj[dim];
      if (typeof val !== 'number' || val <= 0) {
        return fail(`${ctx}.${dim} must be a positive number, got ${JSON.stringify(val)}`);
      }
    }
  }

  // left / top — optional numbers
  for (const origin of ['left', 'top'] as const) {
    if (origin in obj) {
      const val = obj[origin];
      if (typeof val !== 'number') {
        return fail(`${ctx}.${origin} must be a number, got ${JSON.stringify(val)}`);
      }
    }
  }

  return ok(obj as unknown as IconAlias);
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validate an unknown value against the IconifyJSON contract.
 *
 * Pure and synchronous — never throws, never reads files.
 * Returns ok(IconifyJSON) on success, err(ICON_VALIDATION_ERROR, ...) on any violation.
 *
 * Validates:
 *   - Required fields: prefix, icons
 *   - prefix format: [a-z][a-z0-9-]*
 *   - icons: at least one entry; each key matches [a-z0-9][a-z0-9-]*
 *   - Each IconData: required body, optional dims (positive), rotate (0–3), flips (boolean)
 *   - aliases: each alias key matches [a-z0-9][a-z0-9-]*; required parent
 *   - Pack-level dims: positive numbers if present
 *   - Unknown keys at any level: hard error
 */
export function validateIconPack(json: unknown): Result<IconifyJSON> {
  if (!isPlainObject(json)) {
    return fail(
      `IconifyJSON must be a non-null plain object, got ${json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json}`,
    );
  }

  // Unknown top-level key check
  for (const key of Object.keys(json)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      return fail(`Unknown top-level key: "${key}"`);
    }
  }

  // prefix — required string matching [a-z][a-z0-9-]*
  if (!('prefix' in json)) {
    return fail('Missing required field "prefix"');
  }
  const prefix = json['prefix'];
  if (typeof prefix !== 'string') {
    return fail(`"prefix" must be a string, got ${JSON.stringify(prefix)}`);
  }
  if (!PREFIX_RE.test(prefix)) {
    return fail(
      `"prefix" must match ^[a-z][a-z0-9-]*$ (lowercase letter start, then lowercase alnum/hyphens), got ${JSON.stringify(prefix)}`,
    );
  }

  // icons — required plain object with ≥1 entry
  if (!('icons' in json)) {
    return fail('Missing required field "icons"');
  }
  const iconsRaw = json['icons'];
  if (!isPlainObject(iconsRaw)) {
    return fail('"icons" must be a plain object');
  }
  const iconNames = Object.keys(iconsRaw);
  if (iconNames.length === 0) {
    return fail('"icons" must contain at least one icon entry');
  }

  const icons: Record<string, IconData> = {};
  for (const name of iconNames) {
    if (!NAME_RE.test(name)) {
      return fail(
        `Icon name ${JSON.stringify(name)} must match ^[a-z0-9][a-z0-9-]*$ (lowercase alnum start, then lowercase alnum/hyphens)`,
      );
    }
    const r = validateIconData(name, iconsRaw[name]);
    if (!r.ok) return r;
    icons[name] = r.value;
  }

  // aliases — optional plain object
  let aliases: Record<string, IconAlias> | undefined;
  if ('aliases' in json) {
    const aliasesRaw = json['aliases'];
    if (!isPlainObject(aliasesRaw)) {
      return fail('"aliases" must be a plain object');
    }
    aliases = {};
    for (const aliasName of Object.keys(aliasesRaw)) {
      if (!NAME_RE.test(aliasName)) {
        return fail(
          `Alias name ${JSON.stringify(aliasName)} must match ^[a-z0-9][a-z0-9-]*$`,
        );
      }
      const r = validateIconAlias(aliasName, aliasesRaw[aliasName]);
      if (!r.ok) return r;
      aliases[aliasName] = r.value;
    }
  }

  // Pack-level dimension defaults — optional positive numbers (width/height) or numbers (left/top)
  for (const dim of ['width', 'height'] as const) {
    if (dim in json) {
      const val = json[dim];
      if (typeof val !== 'number' || val <= 0) {
        return fail(`"${dim}" must be a positive number, got ${JSON.stringify(val)}`);
      }
    }
  }
  for (const origin of ['left', 'top'] as const) {
    if (origin in json) {
      const val = json[origin];
      if (typeof val !== 'number') {
        return fail(`"${origin}" must be a number, got ${JSON.stringify(val)}`);
      }
    }
  }

  const result: IconifyJSON = {
    prefix: prefix as string,
    icons,
    ...(aliases !== undefined ? { aliases } : {}),
    ...('width'  in json ? { width:  json['width']  as number } : {}),
    ...('height' in json ? { height: json['height'] as number } : {}),
    ...('left'   in json ? { left:   json['left']   as number } : {}),
    ...('top'    in json ? { top:    json['top']    as number } : {}),
  };

  return ok(result);
}
