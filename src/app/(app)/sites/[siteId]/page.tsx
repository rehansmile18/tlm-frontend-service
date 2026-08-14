"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { sitesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useLocationSummary } from "@/lib/hooks";
import { useTranslation } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";

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
  const { formatDate } = useDateFormat();
  const canWrite = hasPermission(user, "site:write");

  const siteQuery = useQuery({ queryKey: queryKeys.site(siteId), queryFn: () => sitesApi.get(siteId) });
  const { countryName, stateName, hasAnyLocationData } = useLocationSummary(siteQuery.data?.location);

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
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/sites/${siteId}/edit`} />}>
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

      {hasAnyLocationData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("location.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {site.location?.addressLine1 ? (
                <DetailRow label={t("location.addressLine1")}>{site.location.addressLine1}</DetailRow>
              ) : null}
              {site.location?.addressLine2 ? (
                <DetailRow label={t("location.addressLine2")}>{site.location.addressLine2}</DetailRow>
              ) : null}
              {site.location?.city ? <DetailRow label={t("location.city")}>{site.location.city}</DetailRow> : null}
              {stateName ? <DetailRow label={t("location.state")}>{stateName}</DetailRow> : null}
              {countryName ? <DetailRow label={t("location.country")}>{countryName}</DetailRow> : null}
              {site.location?.postalCode ? (
                <DetailRow label={t("location.postalCode")}>{site.location.postalCode}</DetailRow>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {Object.keys(site.customFields ?? {}).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("customFields.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {Object.entries(site.customFields ?? {}).map(([name, fieldValue]) => (
                <DetailRow key={name} label={name}>
                  {fieldValue || "—"}
                </DetailRow>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
