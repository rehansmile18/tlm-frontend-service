"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlayIcon, TriangleAlertIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sitesApi, timesheetsApi, type TimesheetSiteGroupListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";

const PAGE_SIZE = 25;

export default function TimesheetsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const canTriggerProcessing = hasPermission(user, "processing:trigger");
  const clientId = user?.clientId ?? "";

  const [siteId, setSiteId] = useState("");
  const [includeSuperseded, setIncludeSuperseded] = useState(false);
  const [page, setPage] = useState(1);

  // TODO: PLATFORM_ADMIN has no clientId of their own — this scopes the list to "no client"
  // (i.e. backend's own default) until a client picker exists for that role.
  const params: TimesheetSiteGroupListParams = {
    clientId: clientId || undefined,
    siteId: siteId || undefined,
    includeSuperseded: includeSuperseded || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: queryKeys.timesheetSiteGroups(params),
    queryFn: () => timesheetsApi.listBySite(params),
    placeholderData: keepPreviousData,
  });

  // Directory lookup to resolve the business-key siteId into a filter picker label and a friendly
  // name in the table — same pattern PunchDetailPage/TimesheetDetailPage already use for lines.
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });
  const siteNameBySiteId = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sitesQuery.data?.items ?? []) map.set(site.siteId, site.name);
    return map;
  }, [sitesQuery.data]);

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
            <Label htmlFor="siteFilter">{t("timesheets.site")}</Label>
            <Combobox id="siteFilter" value={siteId} onValueChange={resetToFirstPage(setSiteId)} placeholder={t("common.all")}>
              <ComboboxItem value="">{t("common.all")}</ComboboxItem>
              {(sitesQuery.data?.items ?? []).map((site) => (
                <ComboboxItem key={site._id} value={site.siteId}>
                  {site.name}
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
          title={siteId || includeSuperseded ? t("timesheets.noneMatch") : t("timesheets.noneFound")}
          description={!siteId && !includeSuperseded ? t("timesheets.noneFoundHint") : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("timesheets.site")}</TableHead>
                  <TableHead>{t("timesheets.payPeriod")}</TableHead>
                  <TableHead>{t("timesheets.payDate")}</TableHead>
                  <TableHead>{t("timesheets.employees")}</TableHead>
                  <TableHead>{t("timesheets.totalHours")}</TableHead>
                  <TableHead>{t("timesheets.totalAmount")}</TableHead>
                  <TableHead>{t("timesheets.stale")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((group) => (
                  <TableRow
                    key={`${group.siteId}__${group.payPeriodId}`}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/timesheets/site/${encodeURIComponent(group.siteId)}/${encodeURIComponent(group.payPeriodId)}`)
                    }
                  >
                    <TableCell className="font-medium">{siteNameBySiteId.get(group.siteId) ?? group.siteId}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(group.periodStartDate)} – {formatDate(group.periodEndDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(group.payDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{group.employeeCount}</TableCell>
                    <TableCell className="text-muted-foreground">{group.totalHours.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{group.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      {group.stale ? (
                        <span title={t("timesheets.staleHint")}>
                          <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
                        </span>
                      ) : null}
                    </TableCell>
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
