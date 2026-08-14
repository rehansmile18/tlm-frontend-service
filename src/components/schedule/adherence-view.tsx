"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInMinutes, isValid, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { employeesApi, sitesApi, schedulesApi, type AdherenceEntry } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation, type TranslationKey } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";
import { formatDuration, type BadgeTone } from "@/lib/format";

function toneForAdherence(status: AdherenceEntry["status"]): BadgeTone {
  switch (status) {
    case "on_time":
      return "success";
    case "late":
      return "warning";
    case "no_show":
      return "danger";
    case "early":
      return "info";
    default:
      return "neutral";
  }
}

function formatVarianceMinutes(minutes: number | null): string {
  return minutes === null ? "—" : formatDuration(minutes);
}

export function AdherenceView({
  clientId,
  siteId,
  employeeId,
  from,
  to,
}: {
  clientId: string;
  siteId: string;
  employeeId?: string;
  from: Date;
  to: Date;
}) {
  const { t } = useTranslation();
  const { formatDate, formatTime } = useDateFormat();

  const params = { siteId, employeeId, from: from.toISOString(), to: to.toISOString() };
  const query = useQuery({
    queryKey: queryKeys.scheduleAdherence(params),
    queryFn: () => schedulesApi.adherence(params),
    enabled: Boolean(siteId),
  });

  // Adherence entries only carry raw employeeId/siteId — resolve them to human-readable labels
  // for the table via the same client-scoped lookups the roster grid uses.
  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 200 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const employeeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeesQuery.data?.items ?? []) map.set(employee._id, employee.employeeId);
    return map;
  }, [employeesQuery.data]);

  const siteLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sitesQuery.data?.items ?? []) map.set(site._id, site.name);
    return map;
  }, [sitesQuery.data]);

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const stats = useMemo(() => {
    let onTime = 0;
    let late = 0;
    let noShow = 0;
    let totalMinutes = 0;
    for (const item of items) {
      if (item.status === "on_time") onTime++;
      else if (item.status === "late") late++;
      else if (item.status === "no_show") noShow++;
      const start = parseISO(item.shiftStart);
      const end = parseISO(item.shiftEnd);
      if (isValid(start) && isValid(end)) totalMinutes += differenceInMinutes(end, start);
    }
    return { onTime, late, noShow, scheduledHours: formatDuration(totalMinutes) };
  }, [items]);

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const statTiles: { label: string; value: string; tone: BadgeTone }[] = [
    { label: t("schedule.onTimeCount"), value: String(stats.onTime), tone: "success" },
    { label: t("schedule.lateCount"), value: String(stats.late), tone: "warning" },
    { label: t("schedule.noShowCount"), value: String(stats.noShow), tone: "danger" },
    { label: t("schedule.scheduledHours"), value: stats.scheduledHours, tone: "info" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {statTiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <StatusBadge tone={tile.tone}>{tile.label}</StatusBadge>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{tile.value}</div>
          </Card>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title={t("schedule.noShiftsThisWeek")} />
      ) : (
        <Card className="overflow-hidden p-0">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("schedule.employee")}</TableHead>
                  <TableHead>{t("schedule.site")}</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.shiftId}>
                    <TableCell className="font-medium">
                      {employeeLabelById.get(entry.employeeId) ?? entry.employeeId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {siteLabelById.get(entry.siteId) ?? entry.siteId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(entry.businessDate)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(entry.shiftStart)}–{formatTime(entry.shiftEnd)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForAdherence(entry.status)}>
                        {t(`schedule.adherenceStatus.${entry.status}` as TranslationKey)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>In: {formatVarianceMinutes(entry.clockInVarianceMinutes)}</div>
                      <div>Out: {formatVarianceMinutes(entry.clockOutVarianceMinutes)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
