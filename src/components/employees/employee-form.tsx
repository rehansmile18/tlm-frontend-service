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
import {
  employeeGroupsApi,
  employeesApi,
  payPeriodConfigsApi,
  type CreateEmployeeBody,
  type Employee,
  type UpdateEmployeeBody,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const employeeFormSchema = z.object({
  employeeId: z.string().min(1),
  employeeGroupId: z.string().nullable().optional(),
  timezone: z.string().min(1),
  payPeriodConfigId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export function EmployeeForm({ employee, onDone }: { employee?: Employee; onDone: (saved: Employee) => void }) {
  const isEdit = Boolean(employee);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId(employee?.clientId);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeId: employee?.employeeId ?? "",
      employeeGroupId: employee?.employeeGroupId ?? "",
      timezone: employee?.timezone ?? "",
      payPeriodConfigId: employee?.payPeriodConfigId ?? "",
      status: employee?.status ?? "active",
    },
  });

  const employeeGroupsQuery = useQuery({
    queryKey: queryKeys.employeeGroups({ clientId, pageSize: 200 }),
    queryFn: () => employeeGroupsApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const payPeriodConfigsQuery = useQuery({
    queryKey: queryKeys.payPeriodConfigs({ clientId, pageSize: 200 }),
    queryFn: () => payPeriodConfigsApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      const employeeGroupId = values.employeeGroupId ? values.employeeGroupId : null;
      const payPeriodConfigId = values.payPeriodConfigId ? values.payPeriodConfigId : null;
      if (isEdit && employee) {
        const body: UpdateEmployeeBody = {
          employeeId: values.employeeId,
          employeeGroupId,
          timezone: values.timezone,
          payPeriodConfigId,
          status: values.status,
        };
        return employeesApi.update(employee._id, body);
      }
      const body: CreateEmployeeBody = {
        clientId,
        employeeId: values.employeeId,
        employeeGroupId,
        timezone: values.timezone,
        payPeriodConfigId,
      };
      return employeesApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t("employees.updated") : t("employees.created"));
      // Loose prefix invalidation: matches every ["employees", ...params] list query, not just
      // whichever params the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.employee(saved._id) });
      onDone(saved);
    },
    onError: (error) => {
      toast.error(isEdit ? t("employees.couldntUpdate") : t("employees.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  function onSubmit(values: EmployeeFormValues) {
    if (!clientId) {
      toast.error(t("employees.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="space-y-1.5">
        <Label htmlFor="employeeId">{t("employees.employeeId")}</Label>
        <Controller
          control={control}
          name="employeeId"
          render={({ field }) => (
            <Input
              id="employeeId"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.employeeId)}
            />
          )}
        />
        {errors.employeeId ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">{t("employees.timezone")}</Label>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employeeGroupId">{t("employees.employeeGroup")}</Label>
          <Controller
            control={control}
            name="employeeGroupId"
            render={({ field }) => (
              <Combobox id="employeeGroupId" value={field.value ?? ""} onValueChange={field.onChange}>
                <ComboboxItem value="">{t("common.none")}</ComboboxItem>
                {(employeeGroupsQuery.data?.items ?? []).map((group) => (
                  <ComboboxItem key={group._id} value={group._id}>
                    {group.name}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payPeriodConfigId">{t("employees.payPeriodConfig")}</Label>
          <Controller
            control={control}
            name="payPeriodConfigId"
            render={({ field }) => (
              <Combobox id="payPeriodConfigId" value={field.value ?? ""} onValueChange={field.onChange}>
                <ComboboxItem value="">{t("common.none")}</ComboboxItem>
                {(payPeriodConfigsQuery.data?.items ?? []).map((config) => (
                  <ComboboxItem key={config._id} value={config._id}>
                    {config.name}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
        </div>
      </div>

      {isEdit ? (
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("common.status")}</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Combobox id="status" value={field.value ?? "active"} onValueChange={field.onChange}>
                <ComboboxItem value="active">{t("employees.active")}</ComboboxItem>
                <ComboboxItem value="inactive">{t("employees.inactive")}</ComboboxItem>
              </Combobox>
            )}
          />
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {isEdit ? t("common.saveChanges") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
