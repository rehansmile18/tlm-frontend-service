"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/data-state";
import { EmployeeSitesPanel } from "@/components/employees/employee-sites-panel";
import { employeeGroupsApi, employeesApi, payPeriodConfigsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useLocationSummary } from "@/lib/hooks";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";

export default function EmployeeDetailPage() {
  // The [employeeId] route param is actually the employee's Mongo _id (that's what
  // employeesApi.get/update/listSites/assignSite/unassignSite expect) — the folder name mirrors
  // the task brief's naming, not the Employee.employeeId business-key field.
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;

  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "employee:write");

  const query = useQuery({
    queryKey: queryKeys.employee(employeeId),
    queryFn: () => employeesApi.get(employeeId),
    enabled: Boolean(employeeId),
  });

  const employee = query.data;

  const employeeGroupQuery = useQuery({
    queryKey: queryKeys.employeeGroup(employee?.employeeGroupId ?? ""),
    queryFn: () => employeeGroupsApi.get(employee!.employeeGroupId!),
    enabled: Boolean(employee?.employeeGroupId),
  });

  const payPeriodConfigQuery = useQuery({
    queryKey: queryKeys.payPeriodConfig(employee?.payPeriodConfigId ?? ""),
    queryFn: () => payPeriodConfigsApi.get(employee!.payPeriodConfigId!),
    enabled: Boolean(employee?.payPeriodConfigId),
  });

  const { countryName, stateName, hasAnyLocationData } = useLocationSummary(employee?.location);
  const customFieldEntries = Object.entries(employee?.customFields ?? {});

  return (
    <>
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("employees.backToEmployees")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !employee ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={employee.employeeId}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge tone={employee.status === "active" ? "success" : "muted"}>
                  {employee.status === "active" ? t("employees.active") : t("employees.inactive")}
                </StatusBadge>
                {canWrite ? (
                  <Button variant="outline" nativeButton={false} render={<Link href={`/employees/${employeeId}/edit`} />}>
                    {t("common.edit")}
                  </Button>
                ) : null}
              </div>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("employees.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("employees.timezone")}</dt>
                  <dd className="text-sm font-medium">{employee.timezone}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("employees.employeeGroup")}</dt>
                  <dd className="text-sm font-medium">{employeeGroupQuery.data?.name ?? t("common.none")}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("employees.payPeriodConfig")}</dt>
                  <dd className="text-sm font-medium">{payPeriodConfigQuery.data?.name ?? t("common.none")}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.createdAt")}</dt>
                  <dd className="text-sm font-medium">{formatDateTime(employee.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.updatedAt")}</dt>
                  <dd className="text-sm font-medium">{formatDateTime(employee.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {hasAnyLocationData ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("location.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {employee.location?.addressLine1 ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("location.addressLine1")}</dt>
                      <dd className="text-sm font-medium">{employee.location.addressLine1}</dd>
                    </div>
                  ) : null}
                  {employee.location?.addressLine2 ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("location.addressLine2")}</dt>
                      <dd className="text-sm font-medium">{employee.location.addressLine2}</dd>
                    </div>
                  ) : null}
                  {employee.location?.city ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("location.city")}</dt>
                      <dd className="text-sm font-medium">{employee.location.city}</dd>
                    </div>
                  ) : null}
                  {stateName ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("location.state")}</dt>
                      <dd className="text-sm font-medium">{stateName}</dd>
                    </div>
                  ) : null}
                  {countryName ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("location.country")}</dt>
                      <dd className="text-sm font-medium">{countryName}</dd>
                    </div>
                  ) : null}
                  {employee.location?.postalCode ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">{t("location.postalCode")}</dt>
                      <dd className="text-sm font-medium">{employee.location.postalCode}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {customFieldEntries.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("customFields.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {customFieldEntries.map(([name, fieldValue]) => (
                    <div key={name}>
                      <dt className="text-sm text-muted-foreground">{name}</dt>
                      <dd className="text-sm font-medium">{fieldValue || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          <EmployeeSitesPanel employeeId={employee._id} clientId={employee.clientId} />
        </>
      )}
    </>
  );
}
