"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PunchForm } from "@/components/punches/punch-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewPunchPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link
        href="/punches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("punches.backToPunches")}
      </Link>

      <PageHeader title={t("punches.newPunch")} />

      <Card>
        <CardContent className="pt-6">
          <PunchForm onDone={(saved) => router.push(`/punches/${saved._id}`)} />
        </CardContent>
      </Card>
    </>
  );
}
