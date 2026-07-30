"use client";

import { useMemo, useState } from "react";
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
import { UserFormDialog } from "@/components/team/user-form-dialog";
import { usersApi, type UserListParams, type UserRecord } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth";
import { useTranslation, type TranslationKey } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

export default function TeamPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // CLIENT_ADMIN sessions always carry their own clientId. A PLATFORM_ADMIN's session has none
  // (they operate across clients), which this simple resolution doesn't cover — for now they'd
  // see every client's users unfiltered.
  // TODO: client picker for PLATFORM_ADMIN.
  const params: UserListParams = { clientId: user?.clientId ?? undefined, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Simple client-side filter over the current page by email. Good enough for v1 — a
  // server-side search param can replace this later without changing the page shape.
  const filteredItems = useMemo(() => {
    const items = query.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.email.toLowerCase().includes(term));
  }, [query.data, search]);

  function openCreate() {
    setEditingUser(undefined);
    setDialogOpen(true);
  }

  function openEdit(target: UserRecord) {
    setEditingUser(target);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title={t("team.title")}
        description={t("team.description")}
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            {t("team.newUser")}
          </Button>
        }
      />

      <Card className="p-4">
        <Input
          aria-label={t("team.searchPlaceholder")}
          placeholder={t("team.searchPlaceholder")}
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
          title={search ? t("team.noneMatch") : t("team.noneFound")}
          description={!search ? t("team.noneFoundHint") : undefined}
          action={
            !search ? (
              <Button onClick={openCreate}>
                <PlusIcon className="size-4" />
                {t("team.newUser")}
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
                  <TableHead>{t("auth.email")}</TableHead>
                  <TableHead>{t("team.role")}</TableHead>
                  <TableHead>{t("team.managedSites")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item._id} className="cursor-pointer" onClick={() => openEdit(item)}>
                    <TableCell className="font-medium">{item.email}</TableCell>
                    <TableCell className="text-muted-foreground">{t(`roles.${item.role}` as TranslationKey)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.siteIds?.length ? item.siteIds.length : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={item.status === "active" ? "success" : "muted"}>
                        {item.status === "active" ? t("team.statusOptions.active") : t("team.statusOptions.disabled")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
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

      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editingUser} />
    </>
  );
}
