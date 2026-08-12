"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TaskForm } from "@/components/tasks/task-form";
import { useTranslation } from "@/lib/i18n/i18n";

export default function NewTaskPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("tasks.backToTasks")}
      </Link>

      <PageHeader title={t("tasks.newTask")} description={t("tasks.newTaskDescription")} />

      <Card>
        <CardContent className="pt-6">
          <TaskForm onDone={(saved) => router.push(`/tasks/${saved._id}`)} />
        </CardContent>
      </Card>
    </>
  );
}
