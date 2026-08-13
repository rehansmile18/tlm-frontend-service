"use client";

import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
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
import { useEditableClientId } from "@/components/client-picker-field";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { employeesApi, sitesApi, schedulesApi, type CreateScheduleBody } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useRole } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

const shiftRowSchema = z
  .object({
    shiftStart: z.string().min(1),
    shiftEnd: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.shiftEnd).getTime() <= new Date(data.shiftStart).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End must be after start", path: ["shiftEnd"] });
    }
  });

const bulkFormSchema = z.object({
  employeeId: z.string().min(1),
  siteId: z.string().min(1),
  task: z.string().nullable().optional(),
  timezone: z.string().min(1),
  notes: z.string().nullable().optional(),
  shifts: z.array(shiftRowSchema).min(1),
});

type BulkFormValues = z.infer<typeof bulkFormSchema>;

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

function emptyRow() {
  return { shiftStart: "", shiftEnd: "" };
}

export function BulkCreateDialog({
  open,
  onOpenChange,
  siteId: prefillSiteId,
  employeeId: prefillEmployeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId?: string;
  employeeId?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("schedule.bulkCreate")}</DialogTitle>
          <DialogDescription>{t("schedule.description")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <BulkCreateForm
            prefillSiteId={prefillSiteId}
            prefillEmployeeId={prefillEmployeeId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BulkCreateForm({
  prefillSiteId,
  prefillEmployeeId,
  onClose,
}: {
  prefillSiteId?: string;
  prefillEmployeeId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { isSiteManager, siteIds } = useRole();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId();

  // Rows that were rejected by the last submission, keyed by their position in the CURRENT field
  // array (accepted rows get pruned after a partial success, so positions stay aligned — see
  // onSuccess below).
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      employeeId: prefillEmployeeId ?? "",
      siteId: prefillSiteId ?? "",
      task: "",
      timezone: "",
      notes: "",
      shifts: [emptyRow()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "shifts" });

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

  const employeeOptions = employeesQuery.data?.items ?? [];
  // A SITE_MANAGER can only build shifts at their own managed sites — enforced server-side too,
  // but restricting the picker here makes that obvious up front instead of letting them pick an
  // out-of-scope site and hit a 403.
  const allSites = sitesQuery.data?.items ?? [];
  const siteOptions = isSiteManager ? allSites.filter((site) => siteIds.includes(site._id)) : allSites;

  const mutation = useMutation({
    mutationFn: (values: BulkFormValues) => {
      const task = values.task ? values.task : null;
      const notes = values.notes ? values.notes : null;
      const shifts: CreateScheduleBody[] = values.shifts.map((row) => ({
        clientId,
        employeeId: values.employeeId,
        siteId: values.siteId,
        task,
        shiftStart: datetimeLocalToIso(row.shiftStart),
        shiftEnd: datetimeLocalToIso(row.shiftEnd),
        timezone: values.timezone,
        notes,
      }));
      return schedulesApi.bulkCreate(shifts);
    },
    onSuccess: (result, values) => {
      const total = values.shifts.length;
      const acceptedCount = result.accepted.length;

      if (acceptedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
      }

      if (result.rejected.length === 0) {
        toast.success(`${acceptedCount} of ${total} shifts created`);
        onClose();
        return;
      }

      toast.warning(`${acceptedCount} of ${total} shifts created`, {
        description: `${result.rejected.length} shift${result.rejected.length === 1 ? "" : "s"} couldn't be created — see details below.`,
      });

      // Prune the accepted rows out of the form and keep only the rejected ones (in their
      // original relative order) so the user can fix and resubmit just what actually failed,
      // instead of re-submitting the whole batch (which would try to recreate the already-
      // accepted shifts too).
      const rejectedIndexes = new Set(result.rejected.map((r) => r.index));
      const acceptedIndexes = values.shifts.map((_, i) => i).filter((i) => !rejectedIndexes.has(i));
      if (acceptedIndexes.length > 0) {
        remove(acceptedIndexes);
      }

      const sortedRejections = [...result.rejected].sort((a, b) => a.index - b.index);
      const nextRowErrors: Record<number, string> = {};
      sortedRejections.forEach((rejection, position) => {
        nextRowErrors[position] = rejection.error;
      });
      setRowErrors(nextRowErrors);
    },
    onError: (error) => {
      toast.error(t("schedule.couldntCreate"), { description: humanizeError(error) });
    },
  });

  function onSubmit(values: BulkFormValues) {
    if (!clientId) {
      toast.error(t("schedule.couldntCreate"));
      return;
    }
    setRowErrors({});
    mutation.mutate(values);
  }

  function handleEmployeeChange(employeeId: string, onChange: (value: string) => void) {
    onChange(employeeId);
    const employee = employeeOptions.find((e) => e._id === employeeId);
    if (employee) {
      setValue("timezone", employee.timezone, { shouldValidate: true });
    }
  }

  const watchedShifts = watch("shifts");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-employeeId">{t("schedule.employee")}</Label>
          <Controller
            control={control}
            name="employeeId"
            render={({ field }) => (
              <Combobox
                id="bulk-employeeId"
                value={field.value}
                onValueChange={(value) => handleEmployeeChange(value, field.onChange)}
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
          <Label htmlFor="bulk-siteId">{t("schedule.site")}</Label>
          <Controller
            control={control}
            name="siteId"
            render={({ field }) => (
              <Combobox id="bulk-siteId" value={field.value} onValueChange={field.onChange} placeholder={t("common.select")}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-task">{t("schedule.task")}</Label>
          <Controller
            control={control}
            name="task"
            render={({ field }) => (
              <Input id="bulk-task" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bulk-timezone">{t("schedule.timezone")}</Label>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <TimezoneCombobox
                id="bulk-timezone"
                value={field.value}
                onValueChange={field.onChange}
                placeholder="America/New_York"
                aria-invalid={Boolean(errors.timezone)}
              />
            )}
          />
          {errors.timezone ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bulk-notes">{t("schedule.notes")}</Label>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Textarea id="bulk-notes" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("schedule.shiftStart")}</Label>
        <div className="space-y-2">
          {fields.map((field, index) => {
            const rowError = rowErrors[index];
            const rowErrorsFromValidation = errors.shifts?.[index];
            return (
              <div key={field.id} className="space-y-1 rounded-lg border border-input p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`shifts.${index}.shiftStart`} className="text-xs text-muted-foreground">
                      {t("schedule.shiftStart")}
                    </Label>
                    <Controller
                      control={control}
                      name={`shifts.${index}.shiftStart`}
                      render={({ field: rowField }) => (
                        <Input
                          id={`shifts.${index}.shiftStart`}
                          type="datetime-local"
                          value={rowField.value}
                          onChange={rowField.onChange}
                          onBlur={rowField.onBlur}
                          aria-invalid={Boolean(rowErrorsFromValidation?.shiftStart)}
                        />
                      )}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`shifts.${index}.shiftEnd`} className="text-xs text-muted-foreground">
                      {t("schedule.shiftEnd")}
                    </Label>
                    <Controller
                      control={control}
                      name={`shifts.${index}.shiftEnd`}
                      render={({ field: rowField }) => (
                        <Input
                          id={`shifts.${index}.shiftEnd`}
                          type="datetime-local"
                          value={rowField.value}
                          onChange={rowField.onChange}
                          onBlur={rowField.onBlur}
                          aria-invalid={Boolean(rowErrorsFromValidation?.shiftEnd)}
                        />
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length <= 1}
                    onClick={() => {
                      remove(index);
                      setRowErrors({});
                    }}
                    aria-label={t("common.remove")}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
                {rowErrorsFromValidation?.shiftEnd ? (
                  <p className="text-xs text-destructive">{rowErrorsFromValidation.shiftEnd.message}</p>
                ) : null}
                {rowError ? <p className="text-xs text-destructive">{rowError}</p> : null}
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            append(emptyRow());
            setRowErrors({});
          }}
        >
          <PlusIcon className="size-4" />
          {t("schedule.addShift")}
        </Button>
        {errors.shifts?.root ? <p className="text-xs text-destructive">{errors.shifts.root.message}</p> : null}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending || watchedShifts.length === 0}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {t("schedule.bulkCreate")}
        </Button>
      </DialogFooter>
    </form>
  );
}
