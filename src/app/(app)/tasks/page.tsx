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
import { EmptyState, ErrorState } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tasksApi, type TaskListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "task:write");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params: TaskListParams = { page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.tasks(params),
    queryFn: () => tasksApi.list(params),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Simple client-side filter over the current page by name/code. Good enough for v1 — a
  // server-side search param can replace this later without changing the page shape.
  const filteredItems = useMemo(() => {
    const items = query.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (task) => task.name.toLowerCase().includes(term) || (task.code ?? "").toLowerCase().includes(term)
    );
  }, [query.data, search]);

  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        description={t("tasks.description")}
        actions={
          canWrite ? (
            <Button nativeButton={false} render={<Link href="/tasks/new" />}>
              <PlusIcon className="size-4" />
              {t("tasks.newTask")}
            </Button>
          ) : null
        }
      />

      <Card className="p-4">
        <Input
          aria-label={t("tasks.searchPlaceholder")}
          placeholder={t("tasks.searchPlaceholder")}
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
          title={search ? t("tasks.noneMatch") : t("tasks.noneFound")}
          description={!search && canWrite ? t("tasks.noneFoundHint") : undefined}
          action={
            !search && canWrite ? (
              <Button nativeButton={false} render={<Link href="/tasks/new" />}>
                <PlusIcon className="size-4" />
                {t("tasks.newTask")}
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
                  <TableHead>{t("tasks.name")}</TableHead>
                  <TableHead>{t("tasks.code")}</TableHead>
                  <TableHead>{t("common.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((task) => (
                  <TableRow key={task._id} className="cursor-pointer" onClick={() => router.push(`/tasks/${task._id}`)}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell className="text-muted-foreground">{task.code ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(task.createdAt)}</TableCell>
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
