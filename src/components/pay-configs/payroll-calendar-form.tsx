"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeError } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import {
  payrollCalendarsApi,
  type CreatePayrollCalendarBody,
  type PayrollCalendar,
  type UpdatePayrollCalendarBody,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const payrollCalendarFormSchema = z.object({
  name: z.string().min(1),
  rows: z
    .array(
      z.object({
        periodEnd: z.string().min(1),
        payDate: z.string().min(1),
      })
    )
    .default([]),
});

type PayrollCalendarFormValues = z.infer<typeof payrollCalendarFormSchema>;

export function PayrollCalendarForm({
  calendar,
  onDone,
}: {
  calendar?: PayrollCalendar;
  onDone: (saved: PayrollCalendar) => void;
}) {
  const isEdit = Boolean(calendar);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId(calendar?.clientId);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PayrollCalendarFormValues>({
    resolver: zodResolver(payrollCalendarFormSchema),
    defaultValues: {
      name: calendar?.name ?? "",
      rows: calendar?.rows?.length ? calendar.rows : [{ periodEnd: "", payDate: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const mutation = useMutation({
    mutationFn: (values: PayrollCalendarFormValues) => {
      if (isEdit && calendar) {
        const body: UpdatePayrollCalendarBody = { name: values.name, rows: values.rows };
        return payrollCalendarsApi.update(calendar._id, body);
      }
      const body: CreatePayrollCalendarBody = { clientId, name: values.name, rows: values.rows };
      return payrollCalendarsApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t("payrollCalendars.updated") : t("payrollCalendars.created"));
      // Loose prefix invalidation: matches every ["payroll-calendars", ...params] list query, not
      // just whichever params the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["payroll-calendars"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.payrollCalendar(saved._id) });
      onDone(saved);
    },
    onError: (error) => {
      toast.error(isEdit ? t("payrollCalendars.couldntUpdate") : t("payrollCalendars.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  function onSubmit(values: PayrollCalendarFormValues) {
    if (!clientId) {
      toast.error(t("payrollCalendars.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("payrollCalendars.name")}</Label>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("payrollCalendars.rows")}</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ periodEnd: "", payDate: "" })}>
              <PlusIcon className="size-4" />
              {t("payrollCalendars.addRow")}
            </Button>
          </div>

          <div className="space-y-2">
            {fields.map((rowField, index) => (
              <div key={rowField.id} className="flex items-end gap-2 rounded-lg border p-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`rows.${index}.periodEnd`}>{t("payrollCalendars.periodEnd")}</Label>
                  <Controller
                    control={control}
                    name={`rows.${index}.periodEnd`}
                    render={({ field }) => (
                      <Input
                        id={`rows.${index}.periodEnd`}
                        type="date"
                        value={field.value}
                        onChange={field.onChange}
                        aria-invalid={Boolean(errors.rows?.[index]?.periodEnd)}
                      />
                    )}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`rows.${index}.payDate`}>{t("payrollCalendars.payDate")}</Label>
                  <Controller
                    control={control}
                    name={`rows.${index}.payDate`}
                    render={({ field }) => (
                      <Input
                        id={`rows.${index}.payDate`}
                        type="date"
                        value={field.value}
                        onChange={field.onChange}
                        aria-invalid={Boolean(errors.rows?.[index]?.payDate)}
                      />
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("payrollCalendars.removeRow")}
                  onClick={() => remove(index)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
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
