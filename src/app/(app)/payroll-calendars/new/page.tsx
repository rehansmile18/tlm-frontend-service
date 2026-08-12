"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PayrollCalendarForm } from "@/components/pay-configs/payroll-calendar-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewPayrollCalendarPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link
        href="/payroll-calendars"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("payrollCalendars.backToCalendars")}
      </Link>

      <PageHeader title={t("payrollCalendars.newCalendar")} description={t("payrollCalendars.newCalendarDescription")} />

      <Card>
        <CardContent className="pt-6">
          <PayrollCalendarForm onDone={(saved) => router.push(`/payroll-calendars/${saved._id}`)} />
        </CardContent>
      </Card>
    </>
  );
}
