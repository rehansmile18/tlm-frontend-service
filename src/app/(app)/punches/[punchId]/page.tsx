"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/data-state";
import { punchesApi, sitesApi, type Punch } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";
import { useDateFormat } from "@/lib/date-format";
import { formatDuration, type BadgeTone } from "@/lib/format";

const STATUS_TONE: Record<Punch["status"], BadgeTone> = {
  open: "info",
  closed: "success",
  corrected: "muted",
  rejected: "danger",
};

export default function PunchDetailPage() {
  const params = useParams<{ punchId: string }>();
  const punchId = params.punchId;

  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatDateTime } = useDateFormat();
  const canWrite = hasPermission(user, "punch:write");

  const query = useQuery({
    queryKey: queryKeys.punch(punchId),
    queryFn: () => punchesApi.get(punchId),
    enabled: Boolean(punchId),
  });

  const punch = query.data;

  // Punches are stored against Site.siteId (a business key, not the Mongo _id) — resolve it to a
  // friendlier display name the same way the list page does.
  const siteQuery = useQuery({
    queryKey: queryKeys.sites({ clientId: punch?.clientId ?? "", pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId: punch!.clientId, pageSize: 200 }),
    enabled: Boolean(punch?.clientId),
  });
  const site = siteQuery.data?.items.find((s) => s.siteId === punch?.siteId);

  const canCorrect = canWrite && Boolean(punch) && (punch!.status === "open" || punch!.status === "closed");

  // A corrected punch is a dead-end historical record — the actual updated values live on a new
  // punch (correctionOfPunchId points back at this one from the other side).
  // TODO: link to the correcting punch once there's a lookup-by-correctionOfPunchId endpoint/query.
  const isHistorical = punch?.status === "corrected";

  return (
    <>
      <Link
        href="/punches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("punches.backToPunches")}
      </Link>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading || !punch ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={punch.employeeId}
            description={site ? `${site.name} (${site.siteId})` : punch.siteId}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge tone={STATUS_TONE[punch.status]}>{t(`punches.status.${punch.status}`)}</StatusBadge>
                {canCorrect ? (
                  <Button variant="outline" nativeButton={false} render={<Link href={`/punches/${punchId}/correct`} />}>
                    {t("punches.correctPunch")}
                  </Button>
                ) : null}
              </div>
            }
          />

          <Card className={cn(isHistorical && "opacity-70")}>
            <CardHeader>
              <CardTitle>{t("punches.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("punches.employee")}</dt>
                  <dd className="text-sm font-medium">{punch.employeeId}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("punches.site")}</dt>
                  <dd className="text-sm font-medium">{site ? `${site.name} (${site.siteId})` : punch.siteId}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("punches.task")}</dt>
                  <dd className="text-sm font-medium">{punch.task}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.status")}</dt>
                  <dd className="text-sm font-medium">
                    <StatusBadge tone={STATUS_TONE[punch.status]}>{t(`punches.status.${punch.status}`)}</StatusBadge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("punches.clockIn")}</dt>
                  <dd className="text-sm font-medium">{formatDateTime(punch.clockIn)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("punches.clockOut")}</dt>
                  <dd className="text-sm font-medium">{punch.clockOut ? formatDateTime(punch.clockOut) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Duration</dt>
                  <dd className="text-sm font-medium">
                    {punch.clockOut
                      ? formatDuration((new Date(punch.clockOut).getTime() - new Date(punch.clockIn).getTime()) / 60000)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("punches.timezone")}</dt>
                  <dd className="text-sm font-medium">{punch.timezone}</dd>
                </div>
              </dl>

              {punch.status === "rejected" && punch.rejectionReason ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("punches.rejectionReason")}</AlertTitle>
                  <AlertDescription>{punch.rejectionReason}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
