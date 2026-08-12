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
import {
  payPeriodConfigsApi,
  payrollCalendarsApi,
  type CreatePayPeriodConfigBody,
  type PayPeriodConfig,
  type UpdatePayPeriodConfigBody,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

// Mirrors tlm-backend's CADENCES / PAY_DATE_WEEKEND_RULES (src/types/domain.ts) — kept as local
// literal tuples here since resources.ts only exposes them baked into the PayPeriodConfig field
// types, not as standalone exported arrays.
const CADENCE_VALUES = ["daily", "weekly", "biweekly", "semi_monthly", "monthly", "salaried"] as const;
const WEEKEND_RULE_VALUES = ["none", "prior_business_day", "next_business_day"] as const;

// No i18n key exists for weekday names (only the cadence/weekend-rule enum labels were
// translated) — hardcoded English labels here, same convention as the "America/New_York"
// placeholder hint used for timezone inputs elsewhere in this app.
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const payPeriodConfigFormSchema = z
  .object({
    name: z.string().min(1),
    cadence: z.enum(CADENCE_VALUES),
    timezone: z.string().min(1),
    weekStartDay: z.number().int().min(0).max(6).nullable(),
    anchorDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "anchorDate must be YYYY-MM-DD")
      .nullable(),
    semiMonthlySplitDay: z.number().int().min(1).max(27),
    payDateOffsetDays: z.number().int(),
    payDateWeekendRule: z.enum(WEEKEND_RULE_VALUES),
    payCalendarId: z.string().nullable(),
    producesHourlyLines: z.boolean(),
  })
  // Mirrors payPeriodConfig.validators.ts's applyCadenceRefinements EXACTLY: weekStartDay is
  // required for weekly/biweekly, anchorDate is required only for biweekly. Note the backend
  // does NOT conditionally require semiMonthlySplitDay for semi_monthly (it just defaults to 15
  // regardless of cadence) — so it isn't enforced here either, only conditionally displayed.
  .superRefine((data, ctx) => {
    if ((data.cadence === "weekly" || data.cadence === "biweekly") && data.weekStartDay == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `weekStartDay is required for cadence "${data.cadence}"`,
        path: ["weekStartDay"],
      });
    }
    if (data.cadence === "biweekly" && !data.anchorDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'anchorDate is required for cadence "biweekly"',
        path: ["anchorDate"],
      });
    }
  });

type PayPeriodConfigFormValues = z.infer<typeof payPeriodConfigFormSchema>;

export function PayPeriodConfigForm({
  config,
  onDone,
}: {
  config?: PayPeriodConfig;
  onDone: (saved: PayPeriodConfig) => void;
}) {
  const isEdit = Boolean(config);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId(config?.clientId);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PayPeriodConfigFormValues>({
    resolver: zodResolver(payPeriodConfigFormSchema),
    defaultValues: {
      name: config?.name ?? "",
      cadence: config?.cadence ?? "monthly",
      timezone: config?.timezone ?? "",
      weekStartDay: config?.weekStartDay ?? null,
      anchorDate: config?.anchorDate ?? null,
      semiMonthlySplitDay: config?.semiMonthlySplitDay ?? 15,
      payDateOffsetDays: config?.payDateOffsetDays ?? 0,
      payDateWeekendRule: config?.payDateWeekendRule ?? "none",
      payCalendarId: config?.payCalendarId ?? "",
      // Mirrors the service layer's own default: false only for "salaried", true otherwise
      // (see payPeriodConfig.service.ts's createPayPeriodConfig) — applied here just for the
      // form's initial state; the backend re-derives it independently if omitted on create.
      producesHourlyLines: config?.producesHourlyLines ?? config?.cadence !== "salaried",
    },
  });

  const cadence = watch("cadence");

  const payrollCalendarsQuery = useQuery({
    queryKey: queryKeys.payrollCalendars({ clientId, pageSize: 200 }),
    queryFn: () => payrollCalendarsApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const mutation = useMutation({
    mutationFn: (values: PayPeriodConfigFormValues) => {
      const payCalendarId = values.payCalendarId ? values.payCalendarId : null;
      if (isEdit && config) {
        // clientId and cadence are deliberately omitted here — tlm-backend's
        // updatePayPeriodConfigSchema excludes both (changing cadence out from under an
        // already-configured employee/group is a bigger operation than a PATCH; see
        // payPeriodConfig.validators.ts).
        const body: UpdatePayPeriodConfigBody = {
          name: values.name,
          timezone: values.timezone,
          weekStartDay: values.weekStartDay,
          anchorDate: values.anchorDate,
          semiMonthlySplitDay: values.semiMonthlySplitDay,
          payDateOffsetDays: values.payDateOffsetDays,
          payDateWeekendRule: values.payDateWeekendRule,
          payCalendarId,
          producesHourlyLines: values.producesHourlyLines,
        };
        return payPeriodConfigsApi.update(config._id, body);
      }
      const body: CreatePayPeriodConfigBody = {
        clientId,
        name: values.name,
        cadence: values.cadence,
        timezone: values.timezone,
        weekStartDay: values.weekStartDay,
        anchorDate: values.anchorDate,
        semiMonthlySplitDay: values.semiMonthlySplitDay,
        payDateOffsetDays: values.payDateOffsetDays,
        payDateWeekendRule: values.payDateWeekendRule,
        payCalendarId,
        producesHourlyLines: values.producesHourlyLines,
      };
      return payPeriodConfigsApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t("payPeriodConfigs.updated") : t("payPeriodConfigs.created"));
      // Loose prefix invalidation: matches every ["pay-period-configs", ...params] list query,
      // not just whichever params the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["pay-period-configs"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.payPeriodConfig(saved._id) });
      onDone(saved);
    },
    onError: (error) => {
      toast.error(isEdit ? t("payPeriodConfigs.couldntUpdate") : t("payPeriodConfigs.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  function onSubmit(values: PayPeriodConfigFormValues) {
    if (!clientId) {
      toast.error(t("payPeriodConfigs.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("payPeriodConfigs.name")}</Label>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cadence">{t("payPeriodConfigs.cadence")}</Label>
            {isEdit ? (
              // Cadence can't be changed once created (see the mutationFn comment above) — shown
              // read-only rather than omitted, so the value is still visible in the edit dialog.
              <Input id="cadence" value={t(`payPeriodConfigs.cadenceOptions.${cadence}`)} disabled />
            ) : (
              <Controller
                control={control}
                name="cadence"
                render={({ field }) => (
                  <Combobox id="cadence" value={field.value} onValueChange={field.onChange}>
                    {CADENCE_VALUES.map((value) => (
                      <ComboboxItem key={value} value={value}>
                        {t(`payPeriodConfigs.cadenceOptions.${value}`)}
                      </ComboboxItem>
                    ))}
                  </Combobox>
                )}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone">{t("payPeriodConfigs.timezone")}</Label>
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
        </div>

        {cadence === "weekly" || cadence === "biweekly" ? (
          <div className="space-y-1.5">
            <Label htmlFor="weekStartDay">{t("payPeriodConfigs.weekStartDay")}</Label>
            <Controller
              control={control}
              name="weekStartDay"
              render={({ field }) => (
                <Combobox
                  id="weekStartDay"
                  value={field.value != null ? String(field.value) : ""}
                  onValueChange={(value) => field.onChange(value === "" ? null : Number(value))}
                  placeholder={t("common.select")}
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <ComboboxItem key={index} value={String(index)}>
                      {label}
                    </ComboboxItem>
                  ))}
                </Combobox>
              )}
            />
            {errors.weekStartDay ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
          </div>
        ) : null}

        {cadence === "biweekly" ? (
          <div className="space-y-1.5">
            <Label htmlFor="anchorDate">{t("payPeriodConfigs.anchorDate")}</Label>
            <Controller
              control={control}
              name="anchorDate"
              render={({ field }) => (
                <Input
                  id="anchorDate"
                  type="date"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  aria-invalid={Boolean(errors.anchorDate)}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">{t("payPeriodConfigs.anchorDateHint")}</p>
            {errors.anchorDate ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
          </div>
        ) : null}

        {cadence === "semi_monthly" ? (
          <div className="space-y-1.5">
            <Label htmlFor="semiMonthlySplitDay">{t("payPeriodConfigs.semiMonthlySplitDay")}</Label>
            <Controller
              control={control}
              name="semiMonthlySplitDay"
              render={({ field }) => (
                <Input
                  id="semiMonthlySplitDay"
                  type="number"
                  min={1}
                  max={27}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value === "" ? 15 : Number(e.target.value))}
                />
              )}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="payDateOffsetDays">{t("payPeriodConfigs.payDateOffsetDays")}</Label>
            <Controller
              control={control}
              name="payDateOffsetDays"
              render={({ field }) => (
                <Input
                  id="payDateOffsetDays"
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payDateWeekendRule">{t("payPeriodConfigs.payDateWeekendRule")}</Label>
            <Controller
              control={control}
              name="payDateWeekendRule"
              render={({ field }) => (
                <Combobox id="payDateWeekendRule" value={field.value} onValueChange={field.onChange}>
                  {WEEKEND_RULE_VALUES.map((value) => (
                    <ComboboxItem key={value} value={value}>
                      {t(`payPeriodConfigs.payDateWeekendRuleOptions.${value}`)}
                    </ComboboxItem>
                  ))}
                </Combobox>
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payCalendarId">{t("payPeriodConfigs.payrollCalendar")}</Label>
          <Controller
            control={control}
            name="payCalendarId"
            render={({ field }) => (
              <Combobox id="payCalendarId" value={field.value ?? ""} onValueChange={field.onChange}>
                <ComboboxItem value="">{t("common.none")}</ComboboxItem>
                {(payrollCalendarsQuery.data?.items ?? []).map((calendar) => (
                  <ComboboxItem key={calendar._id} value={calendar._id}>
                    {calendar.name}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
        </div>

        <Controller
          control={control}
          name="producesHourlyLines"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
              {t("payPeriodConfigs.producesHourlyLines")}
            </label>
          )}
        />
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
