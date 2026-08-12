"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UserForm } from "@/components/team/user-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewTeamUserPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        {t("team.backToTeam")}
      </Link>

      <PageHeader title={t("team.newUser")} description={t("team.newUserDescription")} />

      <Card>
        <CardContent className="pt-6">
          <UserForm onDone={() => router.push("/team")} />
        </CardContent>
      </Card>
    </>
  );
}
