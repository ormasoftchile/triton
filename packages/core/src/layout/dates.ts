/**
 * @file layout/dates.ts — Deterministic date arithmetic for the layout pipeline.
 *
 * All functions are pure: no system clock, no locale queries.  The day-ordinal
 * representation (integer count of days since 2000-01-01 = day 0) underpins
 * every horizontal coordinate calculation (§5.3.2).
 */

import type { AxisUnit, IRDate } from '../types.js';

// ---------------------------------------------------------------------------
// Parsed date structure
// ---------------------------------------------------------------------------

export type DatePrecision = 'day' | 'month' | 'year' | 'quarter' | 'half';

export interface ParsedDate {
  precision: DatePrecision;
  year: number;
  /** 1-12; present for precision month/day */
  month?: number;
  /** 1-31; present for precision day */
  day?: number;
  /** 1-4; present for precision quarter */
  quarter?: number;
  /** 1-2; present for precision half */
  half?: number;
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1] ?? 30;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

// ---------------------------------------------------------------------------
// Day ordinal (days since 2000-01-01 = 0)
// ---------------------------------------------------------------------------

/**
 * Convert a (year, month, day) tuple to a day ordinal.
 * Handles dates before 2000 (negative ordinals).
 */
export function dateToOrdinal(year: number, month: number, day: number): number {
  let ord = 0;
  if (year >= 2000) {
    for (let y = 2000; y < year; y++) ord += daysInYear(y);
  } else {
    for (let y = year; y < 2000; y++) ord -= daysInYear(y);
  }
  for (let m = 1; m < month; m++) ord += daysInMonth(year, m);
  ord += day - 1;
  return ord;
}

/**
 * Convert a day ordinal back to (year, month, day).
 */
export function ordinalToDate(ord: number): [number, number, number] {
  let year = 2000;
  let remaining = ord;
  if (remaining >= 0) {
    while (remaining >= daysInYear(year)) {
      remaining -= daysInYear(year);
      year += 1;
    }
  } else {
    while (remaining < 0) {
      year -= 1;
      remaining += daysInYear(year);
    }
  }
  let month = 1;
  while (month <= 12 && remaining >= daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month += 1;
  }
  return [year, month, remaining + 1];
}

// ---------------------------------------------------------------------------
// IRDate parsing
// ---------------------------------------------------------------------------

/**
 * Parse an IRDate string into a structured form.
 * Supports: ISO day (2026-06-09), ISO month (2026-06), year (2026),
 * quarter (2026-Q2), half (2026-H1).
 * Does NOT handle 'now', relative dates, or fiscal dates (those need an anchor;
 * callers must resolve them before calling parseIRDate).
 */
export function parseIRDate(s: IRDate): ParsedDate {
  // ISO day: YYYY-MM-DD
  const dayM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dayM) {
    return { precision: 'day', year: +dayM[1]!, month: +dayM[2]!, day: +dayM[3]! };
  }
  // ISO month: YYYY-MM
  const monthM = /^(\d{4})-(\d{2})$/.exec(s);
  if (monthM) {
    return { precision: 'month', year: +monthM[1]!, month: +monthM[2]! };
  }
  // Quarter: YYYY-QN
  const quarterM = /^(\d{4})-Q([1-4])$/.exec(s);
  if (quarterM) {
    return { precision: 'quarter', year: +quarterM[1]!, quarter: +quarterM[2]! };
  }
  // Half: YYYY-HN
  const halfM = /^(\d{4})-H([12])$/.exec(s);
  if (halfM) {
    return { precision: 'half', year: +halfM[1]!, half: +halfM[2]! };
  }
  // Year only: YYYY
  const yearM = /^(\d{4})$/.exec(s);
  if (yearM) {
    return { precision: 'year', year: +yearM[1]! };
  }
  throw new Error(`Unsupported IRDate format: "${s}"`);
}

// ---------------------------------------------------------------------------
// Date coercion (§5.3.3 Table 5.3)
// ---------------------------------------------------------------------------

/** Coerce a parsed date to its period-start day (left-edge rule). */
export function coerceLeft(parsed: ParsedDate): [number, number, number] {
  switch (parsed.precision) {
    case 'day':     return [parsed.year, parsed.month!, parsed.day!];
    case 'month':   return [parsed.year, parsed.month!, 1];
    case 'year':    return [parsed.year, 1, 1];
    case 'quarter': return [parsed.year, (parsed.quarter! - 1) * 3 + 1, 1];
    case 'half':    return [parsed.year, parsed.half! === 1 ? 1 : 7, 1];
  }
}

/** Coerce a parsed date to its period-end day (right-edge rule). */
export function coerceRight(parsed: ParsedDate): [number, number, number] {
  switch (parsed.precision) {
    case 'day':   return [parsed.year, parsed.month!, parsed.day!];
    case 'month': return [parsed.year, parsed.month!, daysInMonth(parsed.year, parsed.month!)];
    case 'year':  return [parsed.year, 12, 31];
    case 'quarter': {
      const lastMonth = parsed.quarter! * 3;
      return [parsed.year, lastMonth, daysInMonth(parsed.year, lastMonth)];
    }
    case 'half': {
      const lastMonth = parsed.half! === 1 ? 6 : 12;
      return [parsed.year, lastMonth, daysInMonth(parsed.year, lastMonth)];
    }
  }
}

/** Parse an IRDate string and coerce it to its period-start ordinal. */
export function parseAndCoerceLeft(s: IRDate): number {
  const [y, m, d] = coerceLeft(parseIRDate(s));
  return dateToOrdinal(y, m, d);
}

/** Parse an IRDate string and coerce it to its period-end ordinal. */
export function parseAndCoerceRight(s: IRDate): number {
  const [y, m, d] = coerceRight(parseIRDate(s));
  return dateToOrdinal(y, m, d);
}

// ---------------------------------------------------------------------------
// Axis unit inference (§5.3.1 Table 5.2)
// ---------------------------------------------------------------------------

/** Infer the axis unit from the span in days (first-match rule). */
export function inferAxisUnit(spanDays: number): AxisUnit {
  if (spanDays <= 14)   return 'day';
  if (spanDays <= 91)   return 'week';
  if (spanDays <= 548)  return 'month';
  if (spanDays <= 1461) return 'quarter';
  if (spanDays <= 2922) return 'half';
  return 'year';
}

// ---------------------------------------------------------------------------
// Tick enumeration
// ---------------------------------------------------------------------------

export interface TickDate {
  year: number;
  month: number;
  day: number;
  ordinal: number;
}

/**
 * Advance a (year, month, day) by one axis-unit period.
 * Returns the start of the NEXT period.
 */
function advancePeriod(year: number, month: number, day: number, unit: AxisUnit): [number, number, number] {
  switch (unit) {
    case 'day': {
      const o = dateToOrdinal(year, month, day) + 1;
      return ordinalToDate(o);
    }
    case 'week': {
      const o = dateToOrdinal(year, month, day) + 7;
      return ordinalToDate(o);
    }
    case 'month': {
      let m = month + 1;
      let y = year;
      if (m > 12) { m = 1; y += 1; }
      return [y, m, 1];
    }
    case 'quarter': {
      let m = month + 3;
      let y = year;
      if (m > 12) { m = m - 12; y += 1; }
      return [y, m, 1];
    }
    case 'half': {
      let m = month + 6;
      let y = year;
      if (m > 12) { m = m - 12; y += 1; }
      return [y, m, 1];
    }
    case 'year': {
      return [year + 1, 1, 1];
    }
  }
}

/**
 * Snap a date to the start of its containing axis-unit period.
 * This is the "period start" for a given unit.
 */
function snapToPeriodStart(year: number, month: number, _day: number, unit: AxisUnit): [number, number, number] {
  switch (unit) {
    case 'day': return [year, month, _day];
    case 'week': {
      // ISO Monday-start weeks
      const o = dateToOrdinal(year, month, _day);
      // 2000-01-01 was a Saturday; dow: Sat=0,Sun=1,Mon=2,...,Fri=6 in our epoch
      // ISO Monday: dow offset from epoch Saturday
      // Actually simpler: compute JS dow then adjust
      // Epoch 2000-01-01 is Saturday (JS: 6)
      const jsEpoch = 946684800000; // 2000-01-01 UTC ms
      const ms = jsEpoch + o * 86400000;
      const jsDay = new Date(ms).getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const daysToMonday = jsDay === 0 ? 6 : jsDay - 1;
      return ordinalToDate(o - daysToMonday);
    }
    case 'month': return [year, month, 1];
    case 'quarter': {
      const q = Math.floor((month - 1) / 3);
      return [year, q * 3 + 1, 1];
    }
    case 'half': {
      return [year, month <= 6 ? 1 : 7, 1];
    }
    case 'year': return [year, 1, 1];
  }
}

/**
 * Enumerate all period-start tick dates within [tsOrd, teOrd] (inclusive).
 * Returns an array sorted by ordinal ascending.
 */
export function enumTicks(tsOrd: number, teOrd: number, unit: AxisUnit): TickDate[] {
  const ticks: TickDate[] = [];
  const [sy, sm, sd] = ordinalToDate(tsOrd);
  let [cy, cm, cd] = snapToPeriodStart(sy, sm, sd, unit);
  let curOrd = dateToOrdinal(cy, cm, cd);

  // If the snap went before Ts, advance one period
  if (curOrd < tsOrd) {
    [cy, cm, cd] = advancePeriod(cy, cm, cd, unit);
    curOrd = dateToOrdinal(cy, cm, cd);
  }

  let safety = 0;
  while (curOrd <= teOrd && safety < 2000) {
    ticks.push({ year: cy, month: cm, day: cd, ordinal: curOrd });
    [cy, cm, cd] = advancePeriod(cy, cm, cd, unit);
    curOrd = dateToOrdinal(cy, cm, cd);
    safety += 1;
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// Date label formatting
// ---------------------------------------------------------------------------

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ordinalSuffix(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Format an axis tick label according to the axis unit (§5.3.4 Table 5.4). */
export function formatTickLabel(tick: TickDate, unit: AxisUnit, tickIndex: number): string {
  switch (unit) {
    case 'day':
      if (tickIndex % 7 === 0) return MONTH_ABBR[tick.month - 1] ?? '';
      return String(tick.day);
    case 'week':
      if (tickIndex % 4 === 0) return MONTH_ABBR[tick.month - 1] ?? '';
      return String(tick.day);
    case 'month':
      if (tick.month === 1 || tickIndex === 0) return String(tick.year);
      return MONTH_ABBR[tick.month - 1] ?? '';
    case 'quarter': {
      const q = Math.ceil(tick.month / 3);
      if (q === 1 || tickIndex === 0) return `Q${q} ${tick.year}`;
      return `Q${q}`;
    }
    case 'half': {
      const h = tick.month <= 6 ? 1 : 2;
      if (h === 1 || tickIndex === 0) return `H${h} ${tick.year}`;
      return `H${h}`;
    }
    case 'year':
      return String(tick.year);
  }
}

/**
 * Format a concrete day date as the milestone label style:
 * "15th May 2021"
 */
export function formatMilestoneDate(year: number, month: number, day: number): string {
  const dayStr = ordinalSuffix(day);
  const monthStr = MONTH_FULL[month - 1] ?? '';
  return `${dayStr} ${monthStr} ${year}`;
}
