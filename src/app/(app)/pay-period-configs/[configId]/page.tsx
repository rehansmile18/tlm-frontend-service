"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { PayPeriodConfigFormDialog } from "@/components/pay-configs/pay-period-config-form-dialog";
import { payPeriodConfigsApi, payrollCalendarsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate, formatDateTime } from "@/lib/format";

// No i18n key exists for weekday names — see the matching comment in
// pay-period-config-form-dialog.tsx for why these are plain hardcoded English labels.
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function PayPeriodConfigDetailPage() {
  const params = useParams<{ configId: string }>();
  const configId = params.configId;

  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "payPeriodConfig:write");
  const [editOpen, setEditOpen] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.payPeriodConfig(configId),
    queryFn: () => payPeriodConfigsApi.get(configId),
    enabled: Boolean(configId),
  });

  const config = query.data;

  const payrollCalendarQuery = useQuery({
    queryKey: queryKeys.payrollCalendar(config?.payCalendarId ?? ""),
    queryFn: () => payrollCalendarsApi.get(config!.payCalendarId!),
    enabled: Boolean(config?.payCalendarId),
  });

  return (
    <>
      <Link
        href="/pay-period-configs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("payPeriodConfigs.backToConfigs")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !config ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={config.name}
            actions={
              canWrite ? (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  {t("common.edit")}
                </Button>
              ) : null
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("payPeriodConfigs.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.cadence")}</dt>
                  <dd className="text-sm font-medium">{t(`payPeriodConfigs.cadenceOptions.${config.cadence}`)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.timezone")}</dt>
                  <dd className="text-sm font-medium">{config.timezone}</dd>
                </div>

                {config.cadence === "weekly" || config.cadence === "biweekly" ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.weekStartDay")}</dt>
                    <dd className="text-sm font-medium">
                      {config.weekStartDay != null ? WEEKDAY_LABELS[config.weekStartDay] : "—"}
                    </dd>
                  </div>
                ) : null}

                {config.cadence === "biweekly" ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.anchorDate")}</dt>
                    <dd className="text-sm font-medium">
                      {config.anchorDate ? formatDate(config.anchorDate) : "—"}
                    </dd>
                  </div>
                ) : null}

                {config.cadence === "semi_monthly" ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.semiMonthlySplitDay")}</dt>
                    <dd className="text-sm font-medium">{config.semiMonthlySplitDay}</dd>
                  </div>
                ) : null}

                <div>
                  <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.payDateOffsetDays")}</dt>
                  <dd className="text-sm font-medium">{config.payDateOffsetDays}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.payDateWeekendRule")}</dt>
                  <dd className="text-sm font-medium">
                    {t(`payPeriodConfigs.payDateWeekendRuleOptions.${config.payDateWeekendRule}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.payrollCalendar")}</dt>
                  <dd className="text-sm font-medium">
                    {config.payCalendarId ? (
                      <Link href={`/payroll-calendars/${config.payCalendarId}`} className="text-primary hover:underline">
                        {payrollCalendarQuery.data?.name ?? config.payCalendarId}
                      </Link>
                    ) : (
                      t("common.none")
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("payPeriodConfigs.producesHourlyLines")}</dt>
                  <dd className="text-sm font-medium">{config.producesHourlyLines ? t("common.yes") : t("common.no")}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.createdAt")}</dt>
                  <dd className="text-sm font-medium">{formatDateTime(config.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.updatedAt")}</dt>
                  <dd className="text-sm font-medium">{formatDateTime(config.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <PayPeriodConfigFormDialog open={editOpen} onOpenChange={setEditOpen} config={config} />
        </>
      )}
    </>
  );
}
