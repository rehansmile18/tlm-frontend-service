import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDuration, formatTime, TONE_CLASSES, type BadgeTone } from "../format";

describe("format helpers", () => {
  it("formats a date, datetime, and time from an ISO string", () => {
    expect(formatDate("2026-07-27T09:00:00.000Z")).toContain("2026");
    expect(formatDateTime("2026-07-27T09:00:00.000Z")).toMatch(/2026.*\d{1,2}:\d{2}\s?(AM|PM)/);
    expect(formatTime("2026-07-27T09:00:00.000Z")).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });

  it("returns a dash for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
    expect(formatTime("not-a-date")).toBe("—");
  });

  it("formats a minute count into a compact duration", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(0)).toBe("0m");
  });

  it("handles negative and non-finite durations", () => {
    expect(formatDuration(-90)).toBe("-1h 30m");
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(Infinity)).toBe("—");
  });

  it("defines a Tailwind class string for every badge tone", () => {
    const tones: BadgeTone[] = ["neutral", "info", "success", "warning", "muted", "danger"];
    for (const tone of tones) {
      expect(TONE_CLASSES[tone]).toBeTruthy();
    }
  });
});
