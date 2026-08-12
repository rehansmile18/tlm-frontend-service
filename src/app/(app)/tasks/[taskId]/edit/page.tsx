"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { TaskForm } from "@/components/tasks/task-form";
import { tasksApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

export default function EditTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const taskQuery = useQuery({ queryKey: queryKeys.task(taskId), queryFn: () => tasksApi.get(taskId) });

  return (
    <>
      <Link
        href={`/tasks/${taskId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("common.back")}
      </Link>

      {taskQuery.isError ? (
        <ErrorState error={taskQuery.error} onRetry={() => taskQuery.refetch()} />
      ) : taskQuery.isLoading || !taskQuery.data ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader title={t("tasks.editTask")} description={t("tasks.editTaskDescription")} />

          <Card>
            <CardContent className="pt-6">
              <TaskForm task={taskQuery.data} onDone={(saved) => router.push(`/tasks/${saved._id}`)} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
