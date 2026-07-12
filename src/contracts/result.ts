/**
 * Result
 *
 * A discriminated union for all public API return values.
 *
 * All public-facing functions (render, compile) return Result<T> instead
 * of throwing. Internal functions may still throw — errors are caught at
 * the pipeline boundary and wrapped into Err values.
 *
 * Usage:
 *   const result = await render(input);
 *   if (!result.ok) { console.error(result.error.message); return; }
 *   console.log(result.value); // string
 */

export type DiagramErrorCode =
  | 'PARSE_ERROR'
  | 'LAYOUT_ERROR'
  | 'UNKNOWN_DIAGRAM'
  | 'UNSUPPORTED_FORMAT'
  | 'UNKNOWN_RENDERER'
  | 'THEME_VALIDATION_ERROR';

export interface DiagramError {
  readonly code: DiagramErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type Result<T> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: DiagramError };

/** Construct a successful result. */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** Construct a failed result. */
export function err(
  code: DiagramErrorCode,
  message: string,
  cause?: unknown,
): Result<never> {
  return {
    ok: false,
    error: { code, message, ...(cause !== undefined ? { cause } : {}) },
  };
}
