"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PayPeriodConfigForm } from "@/components/pay-configs/pay-period-config-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewPayPeriodConfigPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link
        href="/pay-period-configs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("payPeriodConfigs.backToConfigs")}
      </Link>

      <PageHeader title={t("payPeriodConfigs.newConfig")} description={t("payPeriodConfigs.newConfigDescription")} />

      <Card>
        <CardContent className="pt-6">
          <PayPeriodConfigForm onDone={(saved) => router.push(`/pay-period-configs/${saved._id}`)} />
        </CardContent>
      </Card>
    </>
  );
}
