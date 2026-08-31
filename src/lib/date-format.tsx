"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMyClient, useMyProfile } from "./hooks";
import {
  CALENDAR_FORMAT_PATTERNS,
  TIME_FORMAT_PATTERNS,
  formatDate as formatDateWith,
  formatDateTime as formatDateTimeWith,
  formatTime as formatTimeWith,
  type CalendarFormat,
  type TimeFormat,
} from "./format";

const DEFAULT_DATE_FORMAT: CalendarFormat = "MM/DD/YYYY";
const DEFAULT_TIME_FORMAT: TimeFormat = "12h";

interface DateFormatContextValue {
  calendarFormat: CalendarFormat;
  timeFormat: TimeFormat;
  formatDate: (value?: string | Date | null) => string;
  formatDateTime: (value?: string | Date | null) => string;
  formatTime: (value?: string | Date | null) => string;
}

const DateFormatContext = createContext<DateFormatContextValue | null>(null);

/**
 * Resolves the date/time format to render throughout the app, in priority order: the user's own
 * preferredDateFormat/preferredTimeFormat (set on the Profile page) > their client's shared
 * calendarFormat/timeFormat (via GET /clients/me) > MM/DD/YYYY + 12h before either loads, or for a
 * PLATFORM_ADMIN with no single client.
 *
 * Both frontends resolve this identically and read the same saved preference, so a user who sets
 * their format in one app sees it honoured in the other.
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
      formatDate: (value) => formatDateWith(value, datePattern),
      formatDateTime: (value) => formatDateTimeWith(value, datePattern, timePattern),
      formatTime: (value) => formatTimeWith(value, timePattern),
    };
  }, [calendarFormat, timeFormat]);

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat(): DateFormatContextValue {
  const ctx = useContext(DateFormatContext);
  if (!ctx) throw new Error("useDateFormat must be used within a DateFormatProvider");
  return ctx;
}
