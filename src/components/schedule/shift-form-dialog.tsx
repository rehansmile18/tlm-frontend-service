"use client";

import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { humanizeError } from "@/components/data-state";
import { employeesApi, sitesApi, schedulesApi, type ScheduledShift } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useAuth, useRole } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

const shiftFormSchema = z
  .object({
    employeeId: z.string().min(1),
    siteId: z.string().min(1),
    task: z.string().nullable().optional(),
    shiftStart: z.string().min(1), // datetime-local input value
    shiftEnd: z.string().min(1),
    timezone: z.string().min(1),
    notes: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.shiftEnd).getTime() <= new Date(data.shiftStart).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End must be after start", path: ["shiftEnd"] });
    }
  });

type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export interface ShiftFormPrefill {
  employeeId?: string;
  siteId?: string;
  date?: Date;
}

/** ISO instant -> `datetime-local` input value, in the browser's local timezone. */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** `datetime-local` input value (interpreted in the browser's local timezone) -> ISO instant. */
function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

function defaultStartFor(date: Date | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'") + "09:00";
}

function defaultEndFor(date: Date | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'") + "17:00";
}

function ShiftForm({
  shift,
  prefill,
  onDone,
}: {
  shift?: ScheduledShift;
  prefill?: ShiftFormPrefill;
  onDone: () => void;
}) {
  const isEdit = Boolean(shift);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSiteManager, siteIds } = useRole();
  const queryClient = useQueryClient();

  // CLIENT_ADMIN/SITE_MANAGER sessions always carry their own clientId. A PLATFORM_ADMIN's
  // session has none (they operate across clients), which this simple resolution doesn't cover.
  // TODO: PLATFORM_ADMIN needs an explicit client picker to create/edit shifts for a chosen client.
  const clientId = shift?.clientId ?? user?.clientId ?? "";

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      employeeId: shift?.employeeId ?? prefill?.employeeId ?? "",
      siteId: shift?.siteId ?? prefill?.siteId ?? "",
      task: shift?.task ?? "",
      shiftStart: shift ? isoToDatetimeLocal(shift.shiftStart) : defaultStartFor(prefill?.date),
      shiftEnd: shift ? isoToDatetimeLocal(shift.shiftEnd) : defaultEndFor(prefill?.date),
      timezone: shift?.timezone ?? "",
      notes: shift?.notes ?? "",
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

  // A SITE_MANAGER can only build shifts at their own managed sites — enforced server-side too,
  // but restricting the picker here makes that obvious up front instead of letting them pick an
  // out-of-scope site and hit a 403.
  const siteOptions = useMemo(() => {
    const items = sitesQuery.data?.items ?? [];
    return isSiteManager ? items.filter((site) => siteIds.includes(site._id)) : items;
  }, [sitesQuery.data, isSiteManager, siteIds]);

  const employeeOptions = employeesQuery.data?.items ?? [];

  const mutation = useMutation({
    mutationFn: (values: ShiftFormValues) => {
      const task = values.task ? values.task : null;
      const notes = values.notes ? values.notes : null;
      const shiftStart = datetimeLocalToIso(values.shiftStart);
      const shiftEnd = datetimeLocalToIso(values.shiftEnd);
      if (isEdit && shift) {
        return schedulesApi.update(shift._id, { task, shiftStart, shiftEnd, timezone: values.timezone, notes });
      }
      return schedulesApi.create({
        clientId,
        employeeId: values.employeeId,
        siteId: values.siteId,
        task,
        shiftStart,
        shiftEnd,
        timezone: values.timezone,
        notes,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? t("schedule.updated") : t("schedule.created"));
      // Loose prefix invalidation: matches every ["schedules", ...params] list query, not just
      // whichever params the roster grid happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      onDone();
    },
    onError: (error) => {
      // The server's 400 ("no active EmployeeSiteAssignment") and 409 (overlapping shift) errors
      // surface here naturally via their message text — no special-casing needed.
      toast.error(isEdit ? t("schedule.couldntUpdate") : t("schedule.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!shift) throw new Error("No shift to cancel");
      return schedulesApi.cancel(shift._id);
    },
    onSuccess: () => {
      toast.success(t("schedule.cancelled"));
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      onDone();
    },
    onError: (error) => {
      toast.error(t("schedule.couldntCancel"), { description: humanizeError(error) });
    },
  });

  function onSubmit(values: ShiftFormValues) {
    if (!clientId) {
      toast.error(t("schedule.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  function handleCancelShift() {
    if (window.confirm(t("schedule.cancelShiftConfirm"))) {
      cancelMutation.mutate();
    }
  }

  // Auto-default the timezone to the selected employee's own timezone the first time one is
  // picked — a reasonable default, still fully editable, and never overrides an explicit edit.
  function handleEmployeeChange(employeeId: string, onChange: (value: string) => void) {
    onChange(employeeId);
    const employee = employeeOptions.find((e) => e._id === employeeId);
    if (employee && !isEdit) {
      setValue("timezone", employee.timezone, { shouldValidate: true });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employeeId">{t("schedule.employee")}</Label>
          <Controller
            control={control}
            name="employeeId"
            render={({ field }) => (
              <Combobox
                id="employeeId"
                value={field.value}
                onValueChange={(value) => handleEmployeeChange(value, field.onChange)}
                disabled={isEdit}
                placeholder={t("common.select")}
              >
                {employeeOptions.map((employee) => (
                  <ComboboxItem key={employee._id} value={employee._id}>
                    {employee.employeeId}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
          {errors.employeeId ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="siteId">{t("schedule.site")}</Label>
          <Controller
            control={control}
            name="siteId"
            render={({ field }) => (
              <Combobox
                id="siteId"
                value={field.value}
                onValueChange={field.onChange}
                disabled={isEdit}
                placeholder={t("common.select")}
              >
                {siteOptions.map((site) => (
                  <ComboboxItem key={site._id} value={site._id}>
                    {site.name}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
          {errors.siteId ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>
      </div>
      {isEdit ? (
        <p className="text-xs text-muted-foreground">
          {t("schedule.employee")} / {t("schedule.site")} can&apos;t be changed after a shift is created — cancel and
          recreate it instead.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="task">{t("schedule.task")}</Label>
        <Controller
          control={control}
          name="task"
          render={({ field }) => (
            <Input id="task" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="shiftStart">{t("schedule.shiftStart")}</Label>
          <Controller
            control={control}
            name="shiftStart"
            render={({ field }) => (
              <Input
                id="shiftStart"
                type="datetime-local"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.shiftStart)}
              />
            )}
          />
          {errors.shiftStart ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shiftEnd">{t("schedule.shiftEnd")}</Label>
          <Controller
            control={control}
            name="shiftEnd"
            render={({ field }) => (
              <Input
                id="shiftEnd"
                type="datetime-local"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.shiftEnd)}
              />
            )}
          />
          {errors.shiftEnd ? <p className="text-xs text-destructive">{errors.shiftEnd.message}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">{t("schedule.timezone")}</Label>
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

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("schedule.notes")}</Label>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea id="notes" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        />
      </div>

      <DialogFooter>
        {isEdit ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancelShift}
            disabled={cancelMutation.isPending || mutation.isPending}
          >
            {cancelMutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t("schedule.cancelShift")}
          </Button>
        ) : null}
        <Button type="submit" disabled={mutation.isPending || cancelMutation.isPending}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: ScheduledShift;
  prefill?: ShiftFormPrefill;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? t("schedule.editShift") : t("schedule.newShift")}</DialogTitle>
          <DialogDescription>{t("schedule.description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <ShiftForm key={shift?._id ?? "new"} shift={shift} prefill={prefill} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
