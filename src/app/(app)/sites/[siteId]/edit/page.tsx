"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { SiteForm } from "@/components/sites/site-form";
import { sitesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function EditSitePage() {
  const { siteId } = useParams<{ siteId: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const siteQuery = useQuery({ queryKey: queryKeys.site(siteId), queryFn: () => sitesApi.get(siteId) });

  return (
    <>
      <Link
        href={`/sites/${siteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("common.back")}
      </Link>

      {siteQuery.isError ? (
        <ErrorState error={siteQuery.error} onRetry={() => siteQuery.refetch()} />
      ) : siteQuery.isLoading || !siteQuery.data ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader title={t("sites.editSite")} description={t("sites.editSiteDescription")} />

          <Card>
            <CardContent className="pt-6">
              <SiteForm site={siteQuery.data} onDone={(saved) => router.push(`/sites/${saved._id}`)} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
