import { format, isValid, parseISO } from "date-fns";
import type { CalendarFormat, TimeFormat } from "./resources";

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

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

/** Locale-agnostic fallback (e.g. "Jul 27, 2026") for call sites outside useDateFormat's reach. */
export function formatDate(iso: string | Date, datePattern: string = "MMM d, yyyy"): string {
  const d = toDate(iso);
  return isValid(d) ? format(d, datePattern) : "—";
}

/** Locale-agnostic fallback (e.g. "Jul 27, 2026, 9:00 AM") for call sites outside useDateFormat's reach. */
export function formatDateTime(iso: string | Date, datePattern: string = "MMM d, yyyy", timePattern: string = "h:mm a"): string {
  const d = toDate(iso);
  return isValid(d) ? format(d, `${datePattern}, ${timePattern}`) : "—";
}

/** Locale-agnostic fallback (e.g. "9:00 AM") for call sites outside useDateFormat's reach. */
export function formatTime(iso: string | Date, timePattern: string = "h:mm a"): string {
  const d = toDate(iso);
  return isValid(d) ? format(d, timePattern) : "—";
}

/** Minutes -> compact duration, e.g. 90 -> "1h 30m", 45 -> "45m", 120 -> "2h". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  const sign = minutes < 0 ? "-" : "";
  const totalMinutes = Math.round(Math.abs(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}
