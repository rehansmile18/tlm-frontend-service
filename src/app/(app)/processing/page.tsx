"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, humanizeError } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  employeesApi,
  processingApi,
  type ProcessingRunResult,
  type TriggerProcessingBody,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

const processingFormSchema = z.object({
  employeeIds: z.array(z.string()),
  asOfDate: z.string().min(1).refine((value) => isValid(parseISO(value)), { message: "Invalid date" }),
});

type ProcessingFormValues = z.infer<typeof processingFormSchema>;

// This page is intentionally not in the sidebar nav — it's reached only via the "Run processing"
// action on the Timesheets list page, gated on the processing:trigger permission there.
export default function ProcessingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // CLIENT_ADMIN/SITE_MANAGER sessions always carry their own clientId. A PLATFORM_ADMIN's
  // session has none (they operate across clients), which this simple resolution doesn't cover.
  // TODO: PLATFORM_ADMIN needs an explicit client picker to trigger processing for a chosen client.
  const clientId = user?.clientId ?? "";

  const [result, setResult] = useState<ProcessingRunResult | null>(null);

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 200 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });
  const employees = employeesQuery.data?.items ?? [];

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcessingFormValues>({
    resolver: zodResolver(processingFormSchema),
    defaultValues: {
      employeeIds: [],
      asOfDate: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProcessingFormValues) => {
      const body: TriggerProcessingBody = {
        clientId,
        employeeIds: values.employeeIds,
        asOfDate: values.asOfDate,
      };
      return processingApi.trigger(body);
    },
    onSuccess: (data) => {
      toast.success(t("processing.triggered"));
      setResult(data);
      // A run may create or supersede timesheets — invalidate every timesheets list so the
      // Timesheets page reflects the new results whenever the user navigates back to it.
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
    onError: (error) => {
      toast.error(t("processing.couldntTrigger"), { description: humanizeError(error) });
    },
  });

  function onSubmit(values: ProcessingFormValues) {
    if (!clientId) {
      toast.error(t("processing.couldntTrigger"));
      return;
    }
    setResult(null);
    mutation.mutate(values);
  }

  return (
    <>
      <Link
        href="/timesheets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("timesheets.backToTimesheets")}
      </Link>

      <PageHeader title={t("processing.title")} description={t("processing.description")} />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="asOfDate">{t("processing.asOfDate")}</Label>
              <Controller
                control={control}
                name="asOfDate"
                render={({ field }) => (
                  <Input
                    id="asOfDate"
                    type="date"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className="max-w-xs"
                    aria-invalid={Boolean(errors.asOfDate)}
                  />
                )}
              />
              {errors.asOfDate ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label>{t("processing.employees")}</Label>
              <p className="text-xs text-muted-foreground">{t("processing.employeesHint")}</p>
              {employeesQuery.isError ? (
                <ErrorState error={employeesQuery.error} onRetry={() => employeesQuery.refetch()} />
              ) : employeesQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees found for this client.</p>
              ) : (
                <Controller
                  control={control}
                  name="employeeIds"
                  render={({ field }) => (
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-input p-3">
                      {employees.map((employee) => {
                        const checked = field.value.includes(employee.employeeId);
                        return (
                          <label key={employee._id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-input accent-primary"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, employee.employeeId]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== employee.employeeId));
                                }
                              }}
                            />
                            {employee.employeeId}
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
              )}
            </div>

            <Button type="submit" disabled={mutation.isPending || !clientId}>
              {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t("processing.run")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("processing.results")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border border-input p-3">
                <p className="text-2xl font-semibold">{result.summary.completed}</p>
                <p className="text-xs text-muted-foreground">{t("processing.completed")}</p>
              </div>
              <div className="rounded-lg border border-input p-3">
                <p className="text-2xl font-semibold">{result.summary.skippedLocked}</p>
                <p className="text-xs text-muted-foreground">{t("processing.skippedLocked")}</p>
              </div>
              <div className="rounded-lg border border-input p-3">
                <p className="text-2xl font-semibold">{result.summary.failed}</p>
                <p className="text-xs text-muted-foreground">{t("processing.failed")}</p>
              </div>
            </div>

            {result.items.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("processing.employeeId")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("processing.payPeriodId")}</TableHead>
                      <TableHead>{t("processing.timesheetId")}</TableHead>
                      <TableHead>{t("processing.error")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((item, i) => (
                      <TableRow key={`${item.employeeId}-${i}`}>
                        <TableCell className="font-medium">{item.employeeId}</TableCell>
                        <TableCell className="text-muted-foreground">{item.status}</TableCell>
                        <TableCell className="text-muted-foreground">{item.payPeriodId ?? "—"}</TableCell>
                        <TableCell>
                          {item.timesheetId ? (
                            <Link
                              href={`/timesheets/${item.timesheetId}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {item.timesheetId}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-destructive">{item.error ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
