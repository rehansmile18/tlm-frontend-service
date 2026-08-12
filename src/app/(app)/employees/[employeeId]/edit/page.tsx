"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { EmployeeForm } from "@/components/employees/employee-form";
import { employeesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function EditEmployeePage() {
  // Same _id-not-employeeId note as the detail page: the [employeeId] folder name mirrors the
  // task brief's naming, but the route param is actually the employee's Mongo _id.
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;
  const router = useRouter();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: queryKeys.employee(employeeId),
    queryFn: () => employeesApi.get(employeeId),
    enabled: Boolean(employeeId),
  });

  const employee = query.data;

  return (
    <>
      <Link
        href={`/employees/${employeeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("common.back")}
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
          <PageHeader title={t("employees.editEmployee")} description={t("employees.editEmployeeDescription")} />

          <Card>
            <CardContent className="pt-6">
              <EmployeeForm employee={employee} onDone={(saved) => router.push(`/employees/${saved._id}`)} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
