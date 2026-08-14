"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payrollCalendarsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";

export default function PayrollCalendarDetailPage() {
  const params = useParams<{ calendarId: string }>();
  const calendarId = params.calendarId;

  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatDate } = useDateFormat();
  const canWrite = hasPermission(user, "payrollCalendar:write");

  const query = useQuery({
    queryKey: queryKeys.payrollCalendar(calendarId),
    queryFn: () => payrollCalendarsApi.get(calendarId),
    enabled: Boolean(calendarId),
  });

  const calendar = query.data;

  return (
    <>
      <Link
        href="/payroll-calendars"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("payrollCalendars.backToCalendars")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !calendar ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={calendar.name}
            actions={
              canWrite ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/payroll-calendars/${calendarId}/edit`} />}
                >
                  {t("common.edit")}
                </Button>
              ) : null
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("payrollCalendars.rows")}</CardTitle>
            </CardHeader>
            <CardContent>
              {calendar.rows.length === 0 ? (
                <EmptyState title={t("common.noEntriesYet")} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("payrollCalendars.periodEnd")}</TableHead>
                        <TableHead>{t("payrollCalendars.payDate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calendar.rows.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{formatDate(row.periodEnd)}</TableCell>
                          <TableCell>{formatDate(row.payDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
