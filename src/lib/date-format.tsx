"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMyClient, useMyProfile } from "./hooks";
import {
  CALENDAR_FORMAT_PATTERNS,
  TIME_FORMAT_PATTERNS,
  formatDate as formatDateWith,
  formatDateTime as formatDateTimeWith,
  formatTime as formatTimeWith,
} from "./format";
import type { CalendarFormat, TimeFormat } from "./resources";

const DEFAULT_DATE_FORMAT: CalendarFormat = "MM/DD/YYYY";
const DEFAULT_TIME_FORMAT: TimeFormat = "12h";

interface DateFormatContextValue {
  calendarFormat: CalendarFormat;
  timeFormat: TimeFormat;
  formatDate: (iso?: string | Date | null) => string;
  formatDateTime: (iso?: string | Date | null) => string;
  formatTime: (iso?: string | Date | null) => string;
}

const DateFormatContext = createContext<DateFormatContextValue | null>(null);

/**
 * Resolves the date/time format to render throughout the app, in priority order: the user's own
 * preferredDateFormat/preferredTimeFormat (set on the Profile page) > their client's shared
 * calendarFormat/timeFormat (via GET /clients/me) > MM/DD/YYYY + 12h before either loads, or for a
 * PLATFORM_ADMIN with no single client.
 */
export function DateFormatProvider({ children }: { children: ReactNode }) {
  const { data: clientData } = useMyClient();
  const { data: profileData } = useMyProfile();
  const calendarFormat = profileData?.preferredDateFormat ?? clientData?.client?.calendarFormat ?? DEFAULT_DATE_FORMAT;
  const timeFormat = profileData?.preferredTimeFormat ?? clientData?.client?.timeFormat ?? DEFAULT_TIME_FORMAT;

  const value = useMemo<DateFormatContextValue>(() => {
    const datePattern = CALENDAR_FORMAT_PATTERNS[calendarFormat];
    const timePattern = TIME_FORMAT_PATTERNS[timeFormat];
    return {
      calendarFormat,
      timeFormat,
      formatDate: (iso) => (iso ? formatDateWith(iso, datePattern) : "—"),
      formatDateTime: (iso) => (iso ? formatDateTimeWith(iso, datePattern, timePattern) : "—"),
      formatTime: (iso) => (iso ? formatTimeWith(iso, timePattern) : "—"),
    };
  }, [calendarFormat, timeFormat]);

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat(): DateFormatContextValue {
  const ctx = useContext(DateFormatContext);
  if (!ctx) throw new Error("useDateFormat must be used within a DateFormatProvider");
  return ctx;
}
