"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, HistoryIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoidTimesheetDialog } from "@/components/timesheets/void-timesheet-dialog";
import { AuditTrailTimeline } from "@/components/timesheets/audit-trail-timeline";
import { sitesApi, timesheetsApi, type Timesheet } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";
import { type BadgeTone } from "@/lib/format";

const STATUS_TONE: Record<Timesheet["status"], BadgeTone> = {
  draft: "neutral",
  completed: "success",
  superseded: "muted",
  voided: "danger",
  failed: "danger",
};

export default function TimesheetDetailPage() {
  // The [timesheetId] route param is actually the timesheet's Mongo _id (that's what
  // timesheetsApi.get/auditTrail/void expect) — the folder name mirrors the task brief's naming,
  // not the Timesheet.employeeId business-key field (see EmployeeDetailPage/PunchDetailPage for
  // the same convention elsewhere in the app).
  const params = useParams<{ timesheetId: string }>();
  const timesheetId = params.timesheetId;

  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const [voidOpen, setVoidOpen] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.timesheet(timesheetId),
    queryFn: () => timesheetsApi.get(timesheetId),
    enabled: Boolean(timesheetId),
  });

  const timesheet = query.data;
  const canVoid = hasPermission(user, "timesheet:void") && Boolean(timesheet) && timesheet!.status !== "voided";

  // Timesheet lines are stored against Site.siteId (a business key, not the Mongo _id) — resolve
  // it to a friendlier display name the same way PunchDetailPage resolves punch.siteId.
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId: timesheet?.clientId ?? "", pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId: timesheet!.clientId, pageSize: 200 }),
    enabled: Boolean(timesheet?.clientId),
  });
  const siteNameBySiteId = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sitesQuery.data?.items ?? []) map.set(site.siteId, site.name);
    return map;
  }, [sitesQuery.data]);

  const auditTrailQuery = useQuery({
    queryKey: queryKeys.timesheetAuditTrail(timesheetId),
    queryFn: () => timesheetsApi.auditTrail(timesheetId),
    enabled: Boolean(timesheetId),
  });

  return (
    <>
      <Link
        href="/timesheets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("timesheets.backToTimesheets")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !timesheet ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={timesheet.employeeId}
            description={`${formatDate(timesheet.periodStartDate)} – ${formatDate(timesheet.periodEndDate)}`}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge tone={STATUS_TONE[timesheet.status]}>
                  {t(`timesheets.statusOptions.${timesheet.status}`)}
                </StatusBadge>
                {canVoid ? (
                  <Button variant="destructive" onClick={() => setVoidOpen(true)}>
                    {t("timesheets.void")}
                  </Button>
                ) : null}
              </div>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("timesheets.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.payPeriod")}</dt>
                  <dd className="text-sm font-medium">{timesheet.payPeriodId}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.periodStart")}</dt>
                  <dd className="text-sm font-medium">{formatDate(timesheet.periodStartDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.periodEnd")}</dt>
                  <dd className="text-sm font-medium">{formatDate(timesheet.periodEndDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.payDate")}</dt>
                  <dd className="text-sm font-medium">{formatDate(timesheet.payDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.version")}</dt>
                  <dd className="text-sm font-medium">{timesheet.version}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.totalHours")}</dt>
                  <dd className="text-sm font-medium">{timesheet.totalHours.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.totalAmount")}</dt>
                  <dd className="text-sm font-medium">{timesheet.totalAmount.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("timesheets.stale")}</dt>
                  <dd className="text-sm font-medium">
                    {timesheet.stale ? (
                      <StatusBadge tone="warning">{t("common.yes")}</StatusBadge>
                    ) : (
                      t("common.no")
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Run ID</dt>
                  <dd className="text-sm font-medium break-all">{timesheet.runId}</dd>
                </div>
                {timesheet.supersedesTimesheetId ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Supersedes</dt>
                    <dd className="text-sm font-medium">
                      <Link
                        href={`/timesheets/${timesheet.supersedesTimesheetId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {timesheet.supersedesTimesheetId}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader className="px-4 pt-4">
              <CardTitle>{t("timesheets.lines")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("timesheets.businessDate")}</TableHead>
                    <TableHead>{t("timesheets.site")}</TableHead>
                    <TableHead>{t("timesheets.task")}</TableHead>
                    <TableHead>{t("timesheets.rateType")}</TableHead>
                    <TableHead>{t("timesheets.rate")}</TableHead>
                    <TableHead>{t("timesheets.dailyAmount")}</TableHead>
                    <TableHead>{t("timesheets.additionalAmount")}</TableHead>
                    <TableHead>{t("timesheets.additionalHours")}</TableHead>
                    <TableHead>{t("timesheets.totalHours")}</TableHead>
                    <TableHead>{t("timesheets.totalAmount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheet.lines.map((line, i) => (
                    <TableRow key={`${line.businessDate}-${line.siteId}-${i}`}>
                      <TableCell className="font-medium">{formatDate(line.businessDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {siteNameBySiteId.get(line.siteId) ?? line.siteId}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{line.task}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t(`timesheets.rateTypeOptions.${line.rateType}`)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{line.rate.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{line.dailyAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{line.additionalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{line.additionalHours.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{line.totalHours.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{line.totalAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="size-4" />
                {t("timesheets.auditTrail")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditTrailQuery.isError ? (
                <ErrorState error={auditTrailQuery.error} onRetry={() => auditTrailQuery.refetch()} />
              ) : auditTrailQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (auditTrailQuery.data?.entries.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.noEntriesYet")}</p>
              ) : (
                <AuditTrailTimeline entries={auditTrailQuery.data!.entries} />
              )}
            </CardContent>
          </Card>

          <VoidTimesheetDialog timesheet={timesheet} open={voidOpen} onOpenChange={setVoidOpen} />
        </>
      )}
    </>
  );
}
