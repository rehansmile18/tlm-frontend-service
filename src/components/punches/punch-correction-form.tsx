"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { humanizeError } from "@/components/data-state";
import { sitesApi, tasksApi, punchesApi, type CorrectPunchBody, type Punch } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const correctionFormSchema = z
  .object({
    siteId: z.string().min(1),
    task: z.string().min(1),
    clockIn: z.string().min(1), // datetime-local
    clockOut: z.string().nullable().optional(),
    timezone: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.clockOut && new Date(data.clockOut).getTime() <= new Date(data.clockIn).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Clock out must be after clock in", path: ["clockOut"] });
    }
  });

type CorrectionFormValues = z.infer<typeof correctionFormSchema>;

// Native <input type="datetime-local"> wants "yyyy-MM-ddTHH:mm" in the *browser's local* time,
// with no timezone suffix — the same implicit-local convention the create form's inputs use.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = parseISO(iso);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd'T'HH:mm");
}

export function PunchCorrectionForm({ punch, onDone }: { punch: Punch; onDone: (correctedId: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CorrectionFormValues>({
    resolver: zodResolver(correctionFormSchema),
    defaultValues: {
      siteId: punch.siteId,
      task: punch.task,
      clockIn: toDatetimeLocal(punch.clockIn),
      clockOut: toDatetimeLocal(punch.clockOut),
      timezone: punch.timezone,
    },
  });

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId: punch.clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId: punch.clientId, pageSize: 200 }),
  });

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ clientId: punch.clientId, pageSize: 200 }),
    queryFn: () => tasksApi.list({ clientId: punch.clientId, pageSize: 200 }),
  });

  const sites = sitesQuery.data?.items ?? [];
  const tasks = tasksQuery.data?.items ?? [];

  const mutation = useMutation({
    mutationFn: (values: CorrectionFormValues) => {
      // Send every field pre-filled rather than diffing against the original — simplest, and the
      // backend treats a correction's body as a full replacement of these fields either way.
      const body: CorrectPunchBody = {
        siteId: values.siteId,
        task: values.task,
        clockIn: values.clockIn,
        clockOut: values.clockOut ? values.clockOut : null,
        timezone: values.timezone,
      };
      return punchesApi.correct(punch._id, body);
    },
    onSuccess: (corrected) => {
      toast.success(t("punches.corrected"));
      queryClient.invalidateQueries({ queryKey: ["punches"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.punch(punch._id) });
      onDone(corrected._id);
    },
    onError: (error) => {
      toast.error(t("punches.couldntCorrect"), { description: humanizeError(error) });
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="siteId">{t("punches.site")}</Label>
        <Controller
          control={control}
          name="siteId"
          render={({ field }) => (
            <Combobox
              id="siteId"
              value={field.value}
              onValueChange={field.onChange}
              placeholder={t("common.select")}
              aria-invalid={Boolean(errors.siteId)}
            >
              {sites.map((site) => (
                <ComboboxItem key={site._id} value={site.siteId}>
                  {site.name} ({site.siteId})
                </ComboboxItem>
              ))}
            </Combobox>
          )}
        />
        {errors.siteId ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task">{t("punches.task")}</Label>
        <Controller
          control={control}
          name="task"
          render={({ field }) => (
            <Combobox
              id="task"
              value={field.value}
              onValueChange={field.onChange}
              placeholder={t("common.select")}
              aria-invalid={Boolean(errors.task)}
            >
              {tasks.map((task) => (
                <ComboboxItem key={task._id} value={task.name}>
                  {task.code ? `${task.name} (${task.code})` : task.name}
                </ComboboxItem>
              ))}
            </Combobox>
          )}
        />
        {errors.task ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="clockIn">{t("punches.clockIn")}</Label>
          <Controller
            control={control}
            name="clockIn"
            render={({ field }) => (
              <Input
                id="clockIn"
                type="datetime-local"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.clockIn)}
              />
            )}
          />
          {errors.clockIn ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clockOut">
            {t("punches.clockOut")} <span className="text-muted-foreground">({t("common.optional")})</span>
          </Label>
          <Controller
            control={control}
            name="clockOut"
            render={({ field }) => (
              <Input
                id="clockOut"
                type="datetime-local"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.clockOut)}
              />
            )}
          />
          {errors.clockOut ? <p className="text-xs text-destructive">{errors.clockOut.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">{t("punches.timezone")}</Label>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Input
              id="timezone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="America/New_York"
              aria-invalid={Boolean(errors.timezone)}
            />
          )}
        />
        {errors.timezone ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {t("punches.correctPunch")}
        </Button>
      </div>
    </form>
  );
}
