"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { TriangleAlertIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Timesheet, TimesheetGrid } from "@/lib/resources";
import { useTranslation } from "@/lib/i18n/i18n";
import type { BadgeTone } from "@/lib/format";

const STATUS_TONE: Record<Timesheet["status"], BadgeTone> = {
  draft: "neutral",
  completed: "success",
  superseded: "muted",
  voided: "danger",
  failed: "danger",
};

function formatHours(hours: number): string {
  return hours === 0 ? "–" : hours.toFixed(1);
}

/**
 * Read-only employees × dates grid for one site's pay period. Voiding/audit-trail stay on the
 * existing per-employee timesheet detail page (linked from each employee's row here) — the
 * underlying Timesheet documents, and everything about their lifecycle, are untouched by this view.
 */
export function TimesheetSiteGrid({ grid }: { grid: TimesheetGrid }) {
  const { t } = useTranslation();

  const totalsByDate = new Map<string, number>();
  for (const date of grid.dates) {
    let sum = 0;
    for (const row of grid.rows) sum += row.cellsByDate[date]?.totalHours ?? 0;
    totalsByDate.set(date, sum);
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <div
        className="grid min-w-max tabular-nums"
        style={{ gridTemplateColumns: `220px repeat(${grid.dates.length}, minmax(88px, 1fr)) 110px` }}
      >
        {/* Header row */}
        <div className="sticky start-0 z-10 border-b border-e bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          {t("timesheets.employee")}
        </div>
        {grid.dates.map((date) => (
          <div key={date} className="border-b border-e px-2 py-2 text-center text-xs font-medium last:border-e-0">
            <div className="text-foreground">{format(parseISO(date), "EEE")}</div>
            <div className="text-muted-foreground">{format(parseISO(date), "MMM d")}</div>
          </div>
        ))}
        <div className="border-b px-3 py-2 text-end text-xs font-medium text-muted-foreground">
          {t("timesheets.totalHours")}
        </div>

        {/* Employee rows */}
        {grid.rows.map((row) => (
          <div key={row.timesheetId} className="contents">
            <Link
              href={`/timesheets/${row.timesheetId}`}
              className="sticky start-0 z-10 flex items-center gap-1.5 border-e border-t bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <span className="truncate">{row.employeeId}</span>
              {row.stale ? (
                <span title={t("timesheets.staleHint")}>
                  <TriangleAlertIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                </span>
              ) : null}
              <StatusBadge tone={STATUS_TONE[row.status]} className="ms-auto shrink-0 text-[10px]">
                {t(`timesheets.statusOptions.${row.status}`)}
              </StatusBadge>
            </Link>
            {grid.dates.map((date) => {
              const cell = row.cellsByDate[date];
              return (
                <div key={date} className="border-e border-t p-1.5 text-center last:border-e-0">
                  {cell ? (
                    <>
                      <div className="text-sm font-medium">{formatHours(cell.totalHours)}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{cell.task}</div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground/50">–</div>
                  )}
                </div>
              );
            })}
            <div className="border-t px-3 py-2 text-end text-sm font-semibold">{formatHours(row.totalHours)}</div>
          </div>
        ))}

        {/* Totals row */}
        <div className="sticky start-0 z-10 border-e border-t bg-muted/50 px-3 py-2 text-sm font-semibold">
          {t("timesheets.totalHours")}
        </div>
        {grid.dates.map((date) => (
          <div key={date} className="border-e border-t bg-muted/50 p-1.5 text-center text-sm font-semibold last:border-e-0">
            {formatHours(totalsByDate.get(date) ?? 0)}
          </div>
        ))}
        <div className="border-t bg-muted/50 px-3 py-2 text-end text-sm font-semibold">
          {formatHours(grid.totals.totalHours)}
        </div>
      </div>
    </div>
  );
}
