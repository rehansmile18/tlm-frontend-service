"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeError } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import { tasksApi, type CreateTaskBody, type Task, type UpdateTaskBody } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

// `code` is kept as a plain (always-string) RHF field for a simple controlled <Input/> — an
// empty string means "no code" and is normalized to `null` at submit time to match the API's
// `code?: string | null`.
const taskFormSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export function TaskForm({ task, onDone }: { task?: Task; onDone: (saved: Task) => void }) {
  const isEdit = Boolean(task);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId(task?.clientId);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: task?.name ?? "",
      code: task?.code ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      const code = values.code && values.code.trim() !== "" ? values.code.trim() : null;
      if (isEdit && task) {
        const body: UpdateTaskBody = { name: values.name, code };
        return tasksApi.update(task._id, body);
      }
      const body: CreateTaskBody = { clientId, name: values.name, code };
      return tasksApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t("tasks.updated") : t("tasks.created"));
      // Loose prefix invalidation: matches every ["tasks", ...params] list query, not just
      // whichever params the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.task(saved._id) });
      onDone(saved);
    },
    onError: (error) => {
      toast.error(isEdit ? t("tasks.couldntUpdate") : t("tasks.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  function onSubmit(values: TaskFormValues) {
    if (!clientId) {
      toast.error(t("tasks.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="space-y-1.5">
        <Label htmlFor="name">{t("tasks.name")}</Label>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              id="name"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.name)}
            />
          )}
        />
        {errors.name ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code">{t("tasks.code")}</Label>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <Input
              id="code"
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.code)}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">{t("tasks.codeHint")}</p>
        {errors.code ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {isEdit ? t("common.saveChanges") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
