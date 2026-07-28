"use client";

import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
      <p className="text-sm text-muted-foreground">Welcome, {user?.email}.</p>
    </div>
  );
}
