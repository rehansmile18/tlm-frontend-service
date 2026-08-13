"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { humanizeError } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { employeesApi, sitesApi, tasksApi, punchesApi, type CreatePunchBody, type Punch } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const punchFormSchema = z
  .object({
    employeeId: z.string().min(1),
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

type PunchFormValues = z.infer<typeof punchFormSchema>;

export function PunchForm({ onDone }: { onDone: (saved: Punch) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId();

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PunchFormValues>({
    resolver: zodResolver(punchFormSchema),
    defaultValues: {
      employeeId: "",
      siteId: "",
      task: "",
      clockIn: "",
      clockOut: "",
      timezone: "",
    },
  });

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 200 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ clientId, pageSize: 200 }),
    queryFn: () => tasksApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const employees = employeesQuery.data?.items ?? [];
  const sites = sitesQuery.data?.items ?? [];
  const tasks = tasksQuery.data?.items ?? [];

  const mutation = useMutation({
    mutationFn: (values: PunchFormValues) => {
      const body: CreatePunchBody = {
        clientId,
        employeeId: values.employeeId,
        siteId: values.siteId,
        task: values.task,
        clockIn: values.clockIn,
        clockOut: values.clockOut ? values.clockOut : null,
        timezone: values.timezone,
      };
      return punchesApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(t("punches.created"));
      // Loose prefix invalidation: matches every ["punches", ...params] list query, not just
      // whichever filters the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["punches"] });
      onDone(saved);
    },
    onError: (error) => {
      toast.error(t("punches.couldntCreate"), { description: humanizeError(error) });
    },
  });

  function onSubmit(values: PunchFormValues) {
    if (!clientId) {
      toast.error(t("punches.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employeeId">{t("punches.employee")}</Label>
          <Controller
            control={control}
            name="employeeId"
            render={({ field }) => (
              <Combobox
                id="employeeId"
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  // Nice-to-have default: seed the timezone from the selected employee so the
                  // common case (recording a punch in the employee's own tz) needs no typing.
                  // Only when the field hasn't been touched yet — never clobber a manual edit.
                  if (!getValues("timezone")) {
                    const employee = employees.find((e) => e.employeeId === value);
                    if (employee) setValue("timezone", employee.timezone);
                  }
                }}
                placeholder={t("common.select")}
                aria-invalid={Boolean(errors.employeeId)}
              >
                {employees.map((employee) => (
                  <ComboboxItem key={employee._id} value={employee.employeeId}>
                    {employee.employeeId}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
          {errors.employeeId ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>

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
            <TimezoneCombobox
              id="timezone"
              value={field.value}
              onValueChange={field.onChange}
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
          {t("common.create")}
        </Button>
      </div>
    </form>
  );
}
