"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { PayrollCalendarForm } from "@/components/pay-configs/payroll-calendar-form";
import { payrollCalendarsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function EditPayrollCalendarPage() {
  const params = useParams<{ calendarId: string }>();
  const calendarId = params.calendarId;
  const router = useRouter();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: queryKeys.payrollCalendar(calendarId),
    queryFn: () => payrollCalendarsApi.get(calendarId),
    enabled: Boolean(calendarId),
  });

  return (
    <>
      <Link
        href={`/payroll-calendars/${calendarId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("common.back")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !query.data ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={t("payrollCalendars.editCalendar")}
            description={t("payrollCalendars.editCalendarDescription")}
          />

          <Card>
            <CardContent className="pt-6">
              <PayrollCalendarForm
                calendar={query.data}
                onDone={(saved) => router.push(`/payroll-calendars/${saved._id}`)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
