"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { TimesheetSiteGrid } from "@/components/timesheets/timesheet-site-grid";
import { sitesApi, timesheetsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

export default function TimesheetSiteGridPage() {
  const params = useParams<{ siteId: string; payPeriodId: string }>();
  const siteId = decodeURIComponent(params.siteId);
  const payPeriodId = decodeURIComponent(params.payPeriodId);

  const { user } = useAuth();
  const { t } = useTranslation();
  const clientId = user?.clientId ?? "";

  const gridQuery = useQuery({
    queryKey: queryKeys.timesheetGrid(siteId, payPeriodId),
    queryFn: () => timesheetsApi.getGrid(siteId, payPeriodId),
    enabled: Boolean(siteId && payPeriodId),
  });

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });
  const siteName = sitesQuery.data?.items.find((site) => site.siteId === siteId)?.name ?? siteId;

  const grid = gridQuery.data;

  return (
    <>
      <Link
        href="/timesheets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("timesheets.backToTimesheets")}
      </Link>

      {gridQuery.isError ? (
        <ErrorState error={gridQuery.error} onRetry={() => gridQuery.refetch()} />
      ) : gridQuery.isLoading || !grid ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <PageHeader title={siteName} description={`${formatDate(grid.periodStartDate)} – ${formatDate(grid.periodEndDate)}`} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("timesheets.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{t("timesheets.payDate")}</dt>
                  <dd className="text-sm font-medium">{formatDate(grid.payDate)}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{t("timesheets.employees")}</dt>
                  <dd className="text-sm font-medium">{grid.totals.employeeCount}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{t("timesheets.totalHours")}</dt>
                  <dd className="text-sm font-medium">{grid.totals.totalHours.toFixed(2)}</dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">{t("timesheets.totalAmount")}</dt>
                  <dd className="text-sm font-medium">{grid.totals.totalAmount.toFixed(2)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <TimesheetSiteGrid grid={grid} />
        </>
      )}
    </>
  );
}
