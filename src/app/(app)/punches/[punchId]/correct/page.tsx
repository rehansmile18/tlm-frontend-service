"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { PunchCorrectionForm } from "@/components/punches/punch-correction-form";
import { punchesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function CorrectPunchPage() {
  const params = useParams<{ punchId: string }>();
  const punchId = params.punchId;
  const router = useRouter();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: queryKeys.punch(punchId),
    queryFn: () => punchesApi.get(punchId),
    enabled: Boolean(punchId),
  });

  return (
    <>
      <Link
        href={`/punches/${punchId}`}
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
          <PageHeader title={t("punches.correctPunch")} />

          <Card>
            <CardContent className="pt-6">
              <PunchCorrectionForm
                punch={query.data}
                onDone={(correctedId) => {
                  // A correction never mutates punch._id in place — it returns a brand-new punch
                  // (correctionOfPunchId links back to this one), so jump straight to it rather
                  // than leaving the user staring at the now-"corrected", read-only original.
                  router.push(`/punches/${correctedId}`);
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
