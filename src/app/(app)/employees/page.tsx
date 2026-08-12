"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { employeeGroupsApi, employeesApi, type EmployeeListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

export default function EmployeesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "employee:write");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params: EmployeeListParams = { page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.employees(params),
    queryFn: () => employeesApi.list(params),
    placeholderData: keepPreviousData,
  });

  // Resolves employeeGroupId -> a display name for the table. Kept as a simple flat lookup
  // (v1) rather than a per-row fetch; 200 is a generous ceiling for a client's group list.
  const employeeGroupsQuery = useQuery({
    queryKey: queryKeys.employeeGroups({ pageSize: 200 }),
    queryFn: () => employeeGroupsApi.list({ pageSize: 200 }),
  });
  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of employeeGroupsQuery.data?.items ?? []) map.set(group._id, group.name);
    return map;
  }, [employeeGroupsQuery.data]);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Simple client-side filter over the current page by the employeeId business key. Good enough
  // for v1 — a server-side search param can replace this later without changing the page shape.
  const filteredItems = useMemo(() => {
    const items = query.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((employee) => employee.employeeId.toLowerCase().includes(term));
  }, [query.data, search]);

  return (
    <>
      <PageHeader
        title={t("employees.title")}
        description={t("employees.description")}
        actions={
          canWrite ? (
            <Button nativeButton={false} render={<Link href="/employees/new" />}>
              <PlusIcon className="size-4" />
              {t("employees.newEmployee")}
            </Button>
          ) : null
        }
      />

      <Card className="p-4">
        <Input
          aria-label={t("employees.searchPlaceholder")}
          placeholder={t("employees.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </Card>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={search ? t("employees.noneMatch") : t("employees.noneFound")}
          description={!search && canWrite ? t("employees.noneFoundHint") : undefined}
          action={
            !search && canWrite ? (
              <Button nativeButton={false} render={<Link href="/employees/new" />}>
                <PlusIcon className="size-4" />
                {t("employees.newEmployee")}
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
                  <TableHead>{t("employees.employeeId")}</TableHead>
                  <TableHead>{t("employees.employeeGroup")}</TableHead>
                  <TableHead>{t("employees.timezone")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((employee) => (
                  <TableRow
                    key={employee._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/employees/${employee._id}`)}
                  >
                    <TableCell className="font-medium">{employee.employeeId}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.employeeGroupId ? (groupNameById.get(employee.employeeGroupId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{employee.timezone}</TableCell>
                    <TableCell>
                      <StatusBadge tone={employee.status === "active" ? "success" : "muted"}>
                        {employee.status === "active" ? t("employees.active") : t("employees.inactive")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(employee.createdAt)}</TableCell>
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
