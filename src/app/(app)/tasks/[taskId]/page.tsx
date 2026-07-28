"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-state";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { tasksApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";
import { formatDate } from "@/lib/format";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const canWrite = hasPermission(user, "task:write");
  const [editOpen, setEditOpen] = useState(false);

  const taskQuery = useQuery({ queryKey: queryKeys.task(taskId), queryFn: () => tasksApi.get(taskId) });

  if (taskQuery.isError) return <ErrorState error={taskQuery.error} onRetry={() => taskQuery.refetch()} />;
  if (taskQuery.isLoading || !taskQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const task = taskQuery.data;

  return (
    <>
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4 rtl:rotate-180" />
        {t("tasks.backToTasks")}
      </Link>

      <PageHeader
        title={task.name}
        description={task.code ?? undefined}
        actions={
          canWrite ? (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-3.5" />
              {t("common.edit")}
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("tasks.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <DetailRow label={t("tasks.name")}>{task.name}</DetailRow>
            <DetailRow label={t("tasks.code")}>{task.code ?? "—"}</DetailRow>
            <DetailRow label={t("common.createdAt")}>{formatDate(task.createdAt)}</DetailRow>
            <DetailRow label={t("common.updatedAt")}>{formatDate(task.updatedAt)}</DetailRow>
          </dl>
        </CardContent>
      </Card>

      <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
    </>
  );
}
