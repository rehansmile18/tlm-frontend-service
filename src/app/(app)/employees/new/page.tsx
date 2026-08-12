"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeForm } from "@/components/employees/employee-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewEmployeePage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("employees.backToEmployees")}
      </Link>

      <PageHeader title={t("employees.newEmployee")} description={t("employees.newEmployeeDescription")} />

      <Card>
        <CardContent className="pt-6">
          <EmployeeForm onDone={(saved) => router.push(`/employees/${saved._id}`)} />
        </CardContent>
      </Card>
    </>
  );
}
