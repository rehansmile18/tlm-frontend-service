"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { UserForm } from "@/components/team/user-form";
import { usersApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function EditTeamUserPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const router = useRouter();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => usersApi.get(userId),
    enabled: Boolean(userId),
  });

  return (
    <>
      <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        {t("team.backToTeam")}
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
          <PageHeader title={t("team.editUser")} description={t("team.editUserDescription")} />

          <Card>
            <CardContent className="pt-6">
              <UserForm targetUser={query.data} onDone={() => router.push("/team")} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
