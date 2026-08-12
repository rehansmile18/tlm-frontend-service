"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { PayPeriodConfigForm } from "@/components/pay-configs/pay-period-config-form";
import { payPeriodConfigsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function EditPayPeriodConfigPage() {
  const params = useParams<{ configId: string }>();
  const configId = params.configId;
  const router = useRouter();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: queryKeys.payPeriodConfig(configId),
    queryFn: () => payPeriodConfigsApi.get(configId),
    enabled: Boolean(configId),
  });

  return (
    <>
      <Link
        href={`/pay-period-configs/${configId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("common.back")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !query.data ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={t("payPeriodConfigs.editConfig")}
            description={t("payPeriodConfigs.editConfigDescription")}
          />

          <Card>
            <CardContent className="pt-6">
              <PayPeriodConfigForm
                config={query.data}
                onDone={(saved) => router.push(`/pay-period-configs/${saved._id}`)}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
