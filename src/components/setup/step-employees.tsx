"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { humanizeError } from "@/components/data-state";
import { employeesApi, payPeriodConfigsApi, sitesApi, tasksApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";
import { ExistingList } from "./existing-list";

const NONE = "";

/**
 * Creates the employee and, in the same submit, assigns them to a site.
 *
 * Doing both here is the point: separately these are two pages, and an employee created without a
 * pay period config is the single most common way a payroll run fails. The site assignment is
 * optional because it genuinely is — processing works from whichever site the punches carry, and
 * the readiness report treats a missing assignment as attention rather than a blocker.
 */
export function StepEmployees({ clientId, defaultTimezone }: { clientId: string; defaultTimezone: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone ?? "");
  const [payPeriodConfigId, setPayPeriodConfigId] = useState(NONE);
  const [siteId, setSiteId] = useState(NONE);
  const [task, setTask] = useState(NONE);
  const [newTaskName, setNewTaskName] = useState("");

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 20 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 20 }),
    enabled: Boolean(clientId),
  });
  const configsQuery = useQuery({
    queryKey: queryKeys.payPeriodConfigs({ clientId }),
    queryFn: () => payPeriodConfigsApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ clientId }),
    queryFn: () => tasksApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });

  const employees = employeesQuery.data?.items ?? [];
  const configs = configsQuery.data?.items ?? [];
  const sites = sitesQuery.data?.items ?? [];
  const tasks = tasksQuery.data?.items ?? [];
  const total = employeesQuery.data?.total ?? 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const employee = await employeesApi.create({
        clientId,
        employeeId: employeeId.trim(),
        timezone,
        payPeriodConfigId: payPeriodConfigId || null,
        status: "active",
      });
      // Two calls, so partial success is possible. The employee is the thing that must exist; if
      // the assignment fails the caller is told exactly that rather than "created" or "failed".
      if (siteId && task) {
        await employeesApi.assignSite(employee._id, { siteId, task, isPrimary: true });
      }
      return employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
      setAdding(false);
      setEmployeeId("");
      toast.success(t("setup.employees.created"));
    },
    onError: (error) => toast.error(t("setup.employees.couldntCreate"), { description: humanizeError(error) }),
  });

  const createTask = useMutation({
    mutationFn: () => tasksApi.create({ clientId, name: newTaskName.trim() }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskName("");
      setTask(created.name);
      toast.success(t("setup.employees.taskCreated"));
    },
    onError: (error) => toast.error(t("setup.employees.couldntCreateTask"), { description: humanizeError(error) }),
  });

  const canSubmit = Boolean(employeeId.trim() && timezone);
  const noConfigs = configs.length === 0;

  return (
    <div className="space-y-4">
      <ExistingList
        loading={employeesQuery.isLoading}
        items={employees.map((e) => ({
          id: e._id,
          primary: e.employeeId,
          secondary: e.status === "active" ? e.timezone : t("setup.employees.inactive"),
        }))}
        emptyText={t("setup.employees.none")}
      />
      {total > employees.length ? (
        <p className="text-xs text-muted-foreground">{t("setup.employees.andMore", { count: String(total - employees.length) })}</p>
      ) : null}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4 rounded-lg border p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp-id">{t("setup.employees.employeeId")}</Label>
              <Input id="emp-id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder={t("setup.employees.employeeIdPlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("setup.employees.employeeIdHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-tz">{t("setup.employees.timezone")}</Label>
              <TimezoneCombobox id="emp-tz" value={timezone} onValueChange={setTimezone} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="emp-ppc">{t("setup.employees.payCycle")}</Label>
              <Combobox id="emp-ppc" value={payPeriodConfigId} onValueChange={setPayPeriodConfigId} disabled={noConfigs}>
                <ComboboxItem value={NONE}>{t("setup.employees.payCycleNone")}</ComboboxItem>
                {configs.map((c) => (
                  <ComboboxItem key={c._id} value={c._id}>
                    {c.name}
                  </ComboboxItem>
                ))}
              </Combobox>
              <p className="text-xs text-muted-foreground">
                {noConfigs ? t("setup.employees.payCycleMissing") : t("setup.employees.payCycleHint")}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">{t("setup.employees.siteSectionTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("setup.employees.siteSectionHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-site">{t("setup.employees.site")}</Label>
                <Combobox id="emp-site" value={siteId} onValueChange={setSiteId} disabled={sites.length === 0}>
                  <ComboboxItem value={NONE}>{t("setup.employees.siteNone")}</ComboboxItem>
                  {sites.map((s) => (
                    <ComboboxItem key={s._id} value={s.siteId}>
                      {s.siteId} · {s.name}
                    </ComboboxItem>
                  ))}
                </Combobox>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-task">{t("setup.employees.task")}</Label>
                <Combobox id="emp-task" value={task} onValueChange={setTask} disabled={tasks.length === 0}>
                  <ComboboxItem value={NONE}>{t("setup.employees.taskNone")}</ComboboxItem>
                  {tasks.map((tk) => (
                    <ComboboxItem key={tk._id} value={tk.name}>
                      {tk.name}
                    </ComboboxItem>
                  ))}
                </Combobox>
                {tasks.length === 0 ? (
                  <div className="flex gap-2">
                    <Input
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      placeholder={t("setup.employees.taskPlaceholder")}
                      aria-label={t("setup.employees.newTask")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!newTaskName.trim() || createTask.isPending}
                      onClick={() => createTask.mutate()}
                    >
                      {createTask.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                      {t("setup.employees.addTask")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t("setup.employees.create")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" />
          {t("setup.employees.add")}
        </Button>
      )}
    </div>
  );
}
