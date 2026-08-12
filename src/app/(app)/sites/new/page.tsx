"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SiteForm } from "@/components/sites/site-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewSitePage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link href="/sites" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("sites.backToSites")}
      </Link>

      <PageHeader title={t("sites.newSite")} description={t("sites.newSiteDescription")} />

      <Card>
        <CardContent className="pt-6">
          <SiteForm onDone={(saved) => router.push(`/sites/${saved._id}`)} />
        </CardContent>
      </Card>
    </>
  );
}
