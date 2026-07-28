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
import { PayPeriodConfigFormDialog } from "@/components/pay-configs/pay-period-config-form-dialog";
import { payPeriodConfigsApi, type PayPeriodConfigListParams } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

export default function PayPeriodConfigsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "payPeriodConfig:write");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  // TODO: PLATFORM_ADMIN has no clientId of their own — this scopes the list to "no client"
  // (i.e. backend's own default) until a client picker exists for that role.
  const params: PayPeriodConfigListParams = { clientId: user?.clientId ?? undefined, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.payPeriodConfigs(params),
    queryFn: () => payPeriodConfigsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title={t("payPeriodConfigs.title")}
        description={t("payPeriodConfigs.description")}
        actions={
          canWrite ? (
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon className="size-4" />
              {t("payPeriodConfigs.newConfig")}
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
          title={t("payPeriodConfigs.noneFound")}
          description={canWrite ? t("payPeriodConfigs.noneFoundHint") : undefined}
          action={
            canWrite ? (
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon className="size-4" />
                {t("payPeriodConfigs.newConfig")}
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
                  <TableHead>{t("payPeriodConfigs.name")}</TableHead>
                  <TableHead>{t("payPeriodConfigs.cadence")}</TableHead>
                  <TableHead>{t("payPeriodConfigs.timezone")}</TableHead>
                  <TableHead>{t("common.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((config) => (
                  <TableRow
                    key={config._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/pay-period-configs/${config._id}`)}
                  >
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t(`payPeriodConfigs.cadenceOptions.${config.cadence}`)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{config.timezone}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(config.createdAt)}</TableCell>
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

      <PayPeriodConfigFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
