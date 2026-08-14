"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/data-state";
import { ShiftFormDialog, type ShiftFormPrefill } from "@/components/schedule/shift-form-dialog";
import { employeesApi, schedulesApi, type ScheduledShift, type ScheduleListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";

type DialogState =
  | { mode: "closed" }
  | { mode: "create"; prefill: ShiftFormPrefill }
  | { mode: "edit"; shift: ScheduledShift };

export function RosterGrid({
  clientId,
  siteId,
  employeeId,
  weekStart,
  mode,
}: {
  clientId: string;
  siteId: string;
  employeeId?: string;
  weekStart: Date;
  mode: "week" | "day";
}) {
  const { t } = useTranslation();
  const { formatTime } = useDateFormat();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "schedule:write");
  const [dialogState, setDialogState] = useState<DialogState>({ mode: "closed" });

  const days = useMemo(() => {
    const start = startOfDay(weekStart);
    const count = mode === "day" ? 1 : 7;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [weekStart, mode]);

  const rangeParams: ScheduleListParams = {
    siteId,
    employeeId,
    from: days[0].toISOString(),
    to: endOfDay(days[days.length - 1]).toISOString(),
    status: "scheduled",
    // A generous ceiling for a single site's week — good enough for v1 without paging the grid.
    pageSize: 500,
  };
  const shiftsQuery = useQuery({
    queryKey: queryKeys.schedules(rangeParams),
    queryFn: () => schedulesApi.list(rangeParams),
    enabled: Boolean(siteId),
  });

  // Lists every employee for the client rather than only those assigned to this site, since
  // employeesApi has no "assigned to site X" filter yet.
  // TODO: filter to employees actually assigned to this site once an API supports it.
  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 200 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const employees = useMemo(() => {
    const items = employeesQuery.data?.items ?? [];
    return employeeId ? items.filter((e) => e._id === employeeId) : items;
  }, [employeesQuery.data, employeeId]);

  const shifts = useMemo(() => shiftsQuery.data?.items ?? [], [shiftsQuery.data]);

  const shiftsByKey = useMemo(() => {
    const map = new Map<string, ScheduledShift[]>();
    for (const shift of shifts) {
      const key = `${shift.employeeId}__${shift.businessDate}`;
      const list = map.get(key);
      if (list) list.push(shift);
      else map.set(key, [shift]);
    }
    for (const list of map.values()) list.sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
    return map;
  }, [shifts]);

  function openCreate(prefill: ShiftFormPrefill) {
    setDialogState({ mode: "create", prefill });
  }
  function openEdit(shift: ScheduledShift) {
    setDialogState({ mode: "edit", shift });
  }
  function closeDialog() {
    setDialogState({ mode: "closed" });
  }

  if (shiftsQuery.isError) {
    return <ErrorState error={shiftsQuery.error} onRetry={() => shiftsQuery.refetch()} />;
  }
  if (employeesQuery.isError) {
    return <ErrorState error={employeesQuery.error} onRetry={() => employeesQuery.refetch()} />;
  }

  if (shiftsQuery.isLoading || employeesQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // A blank slate (no employees to show as rows, or literally nothing scheduled anywhere in
  // range) gets a friendly empty state instead of an all-ghost-buttons grid. A partially built
  // roster (some shifts, some gaps) renders the real grid below, with "+ Add" cells for the gaps.
  const isEmpty = employees.length === 0 || shifts.length === 0;

  if (isEmpty) {
    return (
      <>
        <EmptyState
          title={t("schedule.noShiftsThisWeek")}
          action={
            canWrite ? (
              <Button onClick={() => openCreate({ siteId, date: days[0] })}>
                <PlusIcon className="size-4" />
                {t("schedule.addShift")}
              </Button>
            ) : undefined
          }
        />
        <ShiftFormDialog
          open={dialogState.mode !== "closed"}
          onOpenChange={(open) => !open && closeDialog()}
          shift={dialogState.mode === "edit" ? dialogState.shift : undefined}
          prefill={dialogState.mode === "create" ? dialogState.prefill : undefined}
        />
      </>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(160px, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky start-0 z-10 border-b border-e bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          {t("schedule.employee")}
        </div>
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-e px-3 py-2 text-center text-xs font-medium last:border-e-0">
            <div className="text-foreground">{format(day, "EEE")}</div>
            <div className="text-muted-foreground">{format(day, "MMM d")}</div>
          </div>
        ))}

        {/* Employee rows */}
        {employees.map((employee) => (
          <div key={employee._id} className="contents">
            <div className="sticky start-0 z-10 flex items-center border-e bg-background px-3 py-2 text-sm font-medium last:border-b-0">
              {employee.employeeId}
            </div>
            {days.map((day) => {
              const key = `${employee._id}__${format(day, "yyyy-MM-dd")}`;
              const dayShifts = shiftsByKey.get(key) ?? [];
              return (
                <div key={key} className="flex flex-col gap-1 border-e border-t p-1.5 last:border-e-0">
                  {dayShifts.map((shift) => (
                    <button
                      key={shift._id}
                      type="button"
                      onClick={() => openEdit(shift)}
                      className="w-full rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-start text-xs transition-colors hover:bg-primary/20"
                    >
                      <div className="font-medium">
                        {formatTime(shift.shiftStart)}–{formatTime(shift.shiftEnd)}
                      </div>
                      {shift.task ? <div className="truncate text-muted-foreground">{shift.task}</div> : null}
                    </button>
                  ))}
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => openCreate({ employeeId: employee._id, siteId, date: day })}
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-muted-foreground/30 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                    >
                      <PlusIcon className="size-3" />
                      {t("common.add")}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ShiftFormDialog
        open={dialogState.mode !== "closed"}
        onOpenChange={(open) => !open && closeDialog()}
        shift={dialogState.mode === "edit" ? dialogState.shift : undefined}
        prefill={dialogState.mode === "create" ? dialogState.prefill : undefined}
      />
    </div>
  );
}
