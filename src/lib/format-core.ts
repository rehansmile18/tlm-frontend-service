import { format, isValid, parseISO } from "date-fns";

/**
 * Formatting primitives shared by both frontends: the date/time preference vocabulary, the
 * date-fns patterns each preference maps to, the badge tone scale, and the locale-agnostic
 * formatters.
 *
 * This owns CALENDAR_FORMATS/TIME_FORMATS rather than importing them from either app's domain
 * types, because the two apps keep their domain types in differently-named modules — depending on
 * one would fork this file over an import path. The apps re-export these from their own type
 * modules instead, so call sites are unaffected.
 */

// Mirrors TLM's own CALENDAR_FORMATS (src/types/domain.ts) exactly.
export const CALENDAR_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD.MM.YYYY", "DD-MM-YYYY", "YYYY/MM/DD"] as const;
export type CalendarFormat = (typeof CALENDAR_FORMATS)[number];

// Mirrors TLM's own TIME_FORMATS (src/types/domain.ts) exactly.
export const TIME_FORMATS = ["12h", "24h"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

// date-fns pattern for each CalendarFormat/TimeFormat setting (see useDateFormat/DateFormatProvider
// in date-format.tsx, which is the preference-aware entry point most UI should use instead of these).
export const CALENDAR_FORMAT_PATTERNS: Record<CalendarFormat, string> = {
  "MM/DD/YYYY": "MM/dd/yyyy",
  "DD/MM/YYYY": "dd/MM/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
  "DD.MM.YYYY": "dd.MM.yyyy",
  "DD-MM-YYYY": "dd-MM-yyyy",
  "YYYY/MM/DD": "yyyy/MM/dd",
};

export const TIME_FORMAT_PATTERNS: Record<TimeFormat, string> = {
  "12h": "h:mm a",
  "24h": "HH:mm",
};

// Maps a status to a shadcn Badge variant + tailwind accent, so status reads at a glance.
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "muted" | "danger";

export const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-secondary text-secondary-foreground",
  info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  muted: "border-transparent bg-muted text-muted-foreground",
  danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

/** Em dash rather than an empty cell, so a missing value is visibly absent instead of ambiguous. */
export const EMPTY_VALUE = "—";

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

/**
 * Locale-agnostic fallback (e.g. "Jul 27, 2026) for call sites outside useDateFormat's reach.
 * Prefer useDateFormat(), which applies the viewer's own saved preference.
 */
export function formatDate(value?: string | Date | null, datePattern: string = "MMM d, yyyy"): string {
  if (!value) return EMPTY_VALUE;
  const d = toDate(value);
  return isValid(d) ? format(d, datePattern) : EMPTY_VALUE;
}

/** Locale-agnostic fallback (e.g. "Jul 27, 2026, 9:00 AM") for call sites outside useDateFormat's reach. */
export function formatDateTime(
  value?: string | Date | null,
  datePattern: string = "MMM d, yyyy",
  timePattern: string = "h:mm a"
): string {
  if (!value) return EMPTY_VALUE;
  const d = toDate(value);
  return isValid(d) ? format(d, `${datePattern}, ${timePattern}`) : EMPTY_VALUE;
}

/** Locale-agnostic fallback (e.g. "9:00 AM") for call sites outside useDateFormat's reach. */
export function formatTime(value?: string | Date | null, timePattern: string = "h:mm a"): string {
  if (!value) return EMPTY_VALUE;
  const d = toDate(value);
  return isValid(d) ? format(d, timePattern) : EMPTY_VALUE;
}

/** ISO string -> "yyyy-MM-dd" for <input type="date">. Empty string, not a dash: this feeds an input. */
export function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const d = toDate(value);
  return isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

/** Minutes -> compact duration, e.g. 90 -> "1h 30m", 45 -> "45m", 120 -> "2h". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return EMPTY_VALUE;
  const sign = minutes < 0 ? "-" : "";
  const totalMinutes = Math.round(Math.abs(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}
