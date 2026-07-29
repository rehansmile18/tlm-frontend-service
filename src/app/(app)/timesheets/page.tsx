"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlayIcon, TriangleAlertIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { employeesApi, timesheetsApi, type Timesheet, type TimesheetListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate, type BadgeTone } from "@/lib/format";

const PAGE_SIZE = 25;

const STATUS_TONE: Record<Timesheet["status"], BadgeTone> = {
  draft: "neutral",
  completed: "success",
  superseded: "muted",
  voided: "danger",
  failed: "danger",
};

const STATUSES: Timesheet["status"][] = ["draft", "completed", "superseded", "voided", "failed"];

export default function TimesheetsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canTriggerProcessing = hasPermission(user, "processing:trigger");
  const clientId = user?.clientId ?? "";

  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [includeSuperseded, setIncludeSuperseded] = useState(false);
  const [page, setPage] = useState(1);

  // TODO: PLATFORM_ADMIN has no clientId of their own — this scopes the list to "no client"
  // (i.e. backend's own default) until a client picker exists for that role.
  const params: TimesheetListParams = {
    clientId: clientId || undefined,
    employeeId: employeeId || undefined,
    status: status || undefined,
    includeSuperseded: includeSuperseded || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: queryKeys.timesheets(params),
    queryFn: () => timesheetsApi.list(params),
    placeholderData: keepPreviousData,
  });

  // Directory lookup to resolve the business-key employeeId into a filter picker label — same
  // pattern as PunchesPage.
  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 200 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title={t("timesheets.title")}
        description={t("timesheets.description")}
        actions={
          canTriggerProcessing ? (
            <Button variant="outline" onClick={() => router.push("/processing")}>
              <PlayIcon className="size-4" />
              {t("processing.title")}
            </Button>
          ) : null
        }
      />

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="employeeFilter">{t("timesheets.employee")}</Label>
            <Combobox
              id="employeeFilter"
              value={employeeId}
              onValueChange={resetToFirstPage(setEmployeeId)}
              placeholder={t("common.all")}
            >
              <ComboboxItem value="">{t("common.all")}</ComboboxItem>
              {(employeesQuery.data?.items ?? []).map((employee) => (
                <ComboboxItem key={employee._id} value={employee.employeeId}>
                  {employee.employeeId}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="statusFilter">{t("timesheets.status")}</Label>
            <Combobox
              id="statusFilter"
              value={status}
              onValueChange={resetToFirstPage(setStatus)}
              placeholder={t("common.all")}
            >
              <ComboboxItem value="">{t("common.all")}</ComboboxItem>
              {STATUSES.map((s) => (
                <ComboboxItem key={s} value={s}>
                  {t(`timesheets.statusOptions.${s}`)}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>

          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={includeSuperseded}
                onChange={(e) => resetToFirstPage(setIncludeSuperseded)(e.target.checked)}
              />
              {t("timesheets.includeSuperseded")}
            </label>
          </div>
        </div>
      </Card>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={employeeId || status || includeSuperseded ? t("timesheets.noneMatch") : t("timesheets.noneFound")}
          description={!employeeId && !status && !includeSuperseded ? t("timesheets.noneFoundHint") : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("timesheets.employee")}</TableHead>
                  <TableHead>{t("timesheets.payPeriod")}</TableHead>
                  <TableHead>{t("timesheets.payDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("timesheets.stale")}</TableHead>
                  <TableHead>{t("timesheets.totalHours")}</TableHead>
                  <TableHead>{t("timesheets.totalAmount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((timesheet) => (
                  <TableRow
                    key={timesheet._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/timesheets/${timesheet._id}`)}
                  >
                    <TableCell className="font-medium">{timesheet.employeeId}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(timesheet.periodStart)} – {formatDate(timesheet.periodEnd)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(timesheet.payDate)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[timesheet.status]}>
                        {t(`timesheets.statusOptions.${timesheet.status}`)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {timesheet.stale ? (
                        <span title={t("timesheets.staleHint")}>
                          <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{timesheet.totalHours.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{timesheet.totalAmount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("common.pageOfTotal", { page, totalPages, total })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("common.previous")}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t("common.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
