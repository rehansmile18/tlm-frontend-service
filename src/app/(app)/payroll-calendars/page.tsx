"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PayrollCalendarFormDialog } from "@/components/pay-configs/payroll-calendar-form-dialog";
import { payrollCalendarsApi, type PayrollCalendarListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

export default function PayrollCalendarsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "payrollCalendar:write");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  // TODO: PLATFORM_ADMIN has no clientId of their own — this scopes the list to "no client"
  // (i.e. backend's own default) until a client picker exists for that role.
  const params: PayrollCalendarListParams = { clientId: user?.clientId ?? undefined, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.payrollCalendars(params),
    queryFn: () => payrollCalendarsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title={t("payrollCalendars.title")}
        description={t("payrollCalendars.description")}
        actions={
          canWrite ? (
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon className="size-4" />
              {t("payrollCalendars.newCalendar")}
            </Button>
          ) : null
        }
      />

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
          title={t("payrollCalendars.noneFound")}
          description={canWrite ? t("payrollCalendars.noneFoundHint") : undefined}
          action={
            canWrite ? (
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon className="size-4" />
                {t("payrollCalendars.newCalendar")}
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
                  <TableHead>{t("payrollCalendars.name")}</TableHead>
                  <TableHead>{t("payrollCalendars.rows")}</TableHead>
                  <TableHead>{t("common.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((calendar) => (
                  <TableRow
                    key={calendar._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/payroll-calendars/${calendar._id}`)}
                  >
                    <TableCell className="font-medium">{calendar.name}</TableCell>
                    <TableCell className="text-muted-foreground">{calendar.rows.length}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(calendar.createdAt)}</TableCell>
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

      <PayrollCalendarFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
