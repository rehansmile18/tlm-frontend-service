"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { SiteFormDialog } from "@/components/sites/site-form-dialog";
import { sitesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "site:write");
  const [editOpen, setEditOpen] = useState(false);

  const siteQuery = useQuery({ queryKey: queryKeys.site(siteId), queryFn: () => sitesApi.get(siteId) });

  if (siteQuery.isError) return <ErrorState error={siteQuery.error} onRetry={() => siteQuery.refetch()} />;
  if (siteQuery.isLoading || !siteQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const site = siteQuery.data;

  return (
    <>
      <Link href="/sites" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("sites.backToSites")}
      </Link>

      <PageHeader
        title={site.name}
        description={site.siteId}
        actions={
          canWrite ? (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-3.5" />
              {t("common.edit")}
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sites.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <DetailRow label={t("sites.siteId")}>{site.siteId}</DetailRow>
            <DetailRow label={t("sites.name")}>{site.name}</DetailRow>
            <DetailRow label={t("sites.timezone")}>{site.timezone}</DetailRow>
            <DetailRow label={t("common.createdAt")}>{formatDate(site.createdAt)}</DetailRow>
            <DetailRow label={t("common.updatedAt")}>{formatDate(site.updatedAt)}</DetailRow>
          </dl>
        </CardContent>
      </Card>

      <SiteFormDialog open={editOpen} onOpenChange={setEditOpen} site={site} />
    </>
  );
}
