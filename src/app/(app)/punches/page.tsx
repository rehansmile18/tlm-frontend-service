"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PunchFormDialog } from "@/components/punches/punch-form-dialog";
import { employeesApi, sitesApi, punchesApi, type Punch, type PunchListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDateTime, formatDuration, type BadgeTone } from "@/lib/format";

const PAGE_SIZE = 25;

const STATUS_TONE: Record<Punch["status"], BadgeTone> = {
  open: "info",
  closed: "success",
  corrected: "muted",
  rejected: "danger",
};

function workedMinutes(clockIn: string, clockOut: string): number {
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000;
}

export default function PunchesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "punch:write");
  const clientId = user?.clientId ?? "";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [from, setFrom] = useState(() => format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [page, setPage] = useState(1);

  const params: PunchListParams = {
    employeeId: employeeId || undefined,
    siteId: siteId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: queryKeys.punches(params),
    queryFn: () => punchesApi.list(params),
    placeholderData: keepPreviousData,
  });

  // Directory lookups to resolve the business-key employeeId/siteId that punches are stored
  // against into a friendlier picker label + table display. Scoped to the current client and
  // capped at a generous page size — good enough for v1 (see EmployeesPage/EmployeeSitesPanel
  // for the same pattern elsewhere in the app).
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
        title={t("punches.title")}
        description={t("punches.description")}
        actions={
          canWrite ? (
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon className="size-4" />
              {t("punches.newPunch")}
            </Button>
          ) : null
        }
      />

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="employeeFilter">{t("punches.employee")}</Label>
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
            <Label htmlFor="siteFilter">{t("punches.site")}</Label>
            <Combobox
              id="siteFilter"
              value={siteId}
              onValueChange={resetToFirstPage(setSiteId)}
              placeholder={t("common.all")}
            >
              <ComboboxItem value="">{t("common.all")}</ComboboxItem>
              {(sitesQuery.data?.items ?? []).map((site) => (
                <ComboboxItem key={site._id} value={site.siteId}>
                  {site.name} ({site.siteId})
                </ComboboxItem>
              ))}
            </Combobox>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fromDate">From</Label>
            <Input
              id="fromDate"
              type="date"
              value={from}
              onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="toDate">To</Label>
            <Input id="toDate" type="date" value={to} onChange={(e) => resetToFirstPage(setTo)(e.target.value)} />
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
          title={t("punches.noneFound")}
          description={t("punches.noneFoundHint")}
          action={
            canWrite ? (
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon className="size-4" />
                {t("punches.newPunch")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("punches.employee")}</TableHead>
                  <TableHead>{t("punches.site")}</TableHead>
                  <TableHead>{t("punches.task")}</TableHead>
                  <TableHead>{t("punches.clockIn")}</TableHead>
                  <TableHead>{t("punches.clockOut")}</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((punch) => (
                  <TableRow
                    key={punch._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/punches/${punch._id}`)}
                  >
                    <TableCell className="font-medium">{punch.employeeId}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {siteNameBySiteId.get(punch.siteId) ?? punch.siteId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{punch.task}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(punch.clockIn)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {punch.clockOut ? formatDateTime(punch.clockOut) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {punch.clockOut ? formatDuration(workedMinutes(punch.clockIn, punch.clockOut)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[punch.status]}>{t(`punches.status.${punch.status}`)}</StatusBadge>
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

      <PunchFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
