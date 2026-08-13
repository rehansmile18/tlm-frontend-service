"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, humanizeError } from "@/components/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  employeesApi,
  sitesApi,
  tasksApi,
  type AssignEmployeeSiteBody,
  type EmployeeSiteAssignment,
  type UpdateEmployeeSiteAssignmentBody,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

const assignSiteSchema = z.object({
  siteId: z.string().min(1),
  task: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

type AssignSiteFormValues = z.infer<typeof assignSiteSchema>;

function AssignSiteDialog({
  open,
  onOpenChange,
  employeeId,
  clientId,
  assignedSiteIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  clientId: string;
  assignedSiteIds: Set<string>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: open && Boolean(clientId),
  });

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ clientId, pageSize: 200 }),
    queryFn: () => tasksApi.list({ clientId, pageSize: 200 }),
    enabled: open && Boolean(clientId),
  });

  const availableSites = useMemo(
    () => (sitesQuery.data?.items ?? []).filter((site) => !assignedSiteIds.has(site.siteId)),
    [sitesQuery.data, assignedSiteIds]
  );
  const tasks = tasksQuery.data?.items ?? [];

  const { control, handleSubmit, reset } = useForm<AssignSiteFormValues>({
    resolver: zodResolver(assignSiteSchema),
    defaultValues: { siteId: "", task: "", isPrimary: false },
  });

  const mutation = useMutation({
    mutationFn: (values: AssignSiteFormValues) => {
      const body: AssignEmployeeSiteBody = { siteId: values.siteId, task: values.task, isPrimary: values.isPrimary };
      return employeesApi.assignSite(employeeId, body);
    },
    onSuccess: () => {
      toast.success(t("employees.sites.assigned"));
      queryClient.invalidateQueries({ queryKey: queryKeys.employeeSites(employeeId) });
      reset({ siteId: "", task: "", isPrimary: false });
      onOpenChange(false);
    },
    onError: (error) => toast.error(t("employees.sites.couldntAssign"), { description: humanizeError(error) }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("employees.sites.assignSite")}</DialogTitle>
          <DialogDescription>{t("employees.sites.assignSiteDescription")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="siteId">{t("employees.sites.site")}</Label>
              <Controller
                control={control}
                name="siteId"
                render={({ field }) => (
                  <Combobox
                    id="siteId"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={availableSites.length ? t("common.select") : t("employees.sites.allSitesAssigned")}
                  >
                    {availableSites.map((site) => (
                      <ComboboxItem key={site._id} value={site.siteId}>
                        {site.name} ({site.siteId})
                      </ComboboxItem>
                    ))}
                  </Combobox>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="siteTask">{t("employees.sites.task")}</Label>
              <Controller
                control={control}
                name="task"
                render={({ field }) => (
                  <Combobox id="siteTask" value={field.value} onValueChange={field.onChange} placeholder={t("common.select")}>
                    {tasks.map((task) => (
                      <ComboboxItem key={task._id} value={task.name}>
                        {task.name}
                      </ComboboxItem>
                    ))}
                  </Combobox>
                )}
              />
            </div>

            <Controller
              control={control}
              name="isPrimary"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                  {t("employees.sites.setPrimary")}
                </label>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending || availableSites.length === 0}>
                {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t("employees.sites.assignSite")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const editAssignmentSchema = z.object({
  task: z.string().min(1),
});

type EditAssignmentFormValues = z.infer<typeof editAssignmentSchema>;

function EditAssignmentDialog({
  open,
  onOpenChange,
  employeeId,
  clientId,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  clientId: string;
  assignment: EmployeeSiteAssignment;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ clientId, pageSize: 200 }),
    queryFn: () => tasksApi.list({ clientId, pageSize: 200 }),
    enabled: open && Boolean(clientId),
  });
  const tasks = tasksQuery.data?.items ?? [];

  const { control, handleSubmit } = useForm<EditAssignmentFormValues>({
    resolver: zodResolver(editAssignmentSchema),
    defaultValues: { task: assignment.task ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: EditAssignmentFormValues) => {
      const body: UpdateEmployeeSiteAssignmentBody = { task: values.task };
      return employeesApi.updateSiteAssignment(employeeId, assignment.siteId, body);
    },
    onSuccess: () => {
      toast.success(t("employees.sites.updated"));
      queryClient.invalidateQueries({ queryKey: queryKeys.employeeSites(employeeId) });
      onOpenChange(false);
    },
    onError: (error) => toast.error(t("employees.sites.couldntUpdate"), { description: humanizeError(error) }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("employees.sites.editAssignment")}</DialogTitle>
          <DialogDescription>{t("employees.sites.editAssignmentDescription")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editTask">{t("employees.sites.task")}</Label>
              <Controller
                control={control}
                name="task"
                render={({ field }) => (
                  <Combobox id="editTask" value={field.value} onValueChange={field.onChange} placeholder={t("common.select")}>
                    {tasks.map((task) => (
                      <ComboboxItem key={task._id} value={task.name}>
                        {task.name}
                      </ComboboxItem>
                    ))}
                  </Combobox>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t("common.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeSitesPanel({ employeeId, clientId }: { employeeId: string; clientId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasPermission(user, "employeeSiteAssignment:write");
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EmployeeSiteAssignment | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.employeeSites(employeeId),
    queryFn: () => employeesApi.listSites(employeeId),
    enabled: Boolean(employeeId),
  });

  const siteDirectoryQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  const siteNameBySiteId = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of siteDirectoryQuery.data?.items ?? []) map.set(site.siteId, site.name);
    return map;
  }, [siteDirectoryQuery.data]);

  const assignments = assignmentsQuery.data?.items ?? [];
  const assignedSiteIds = useMemo(
    () => new Set((assignmentsQuery.data?.items ?? []).map((a) => a.siteId)),
    [assignmentsQuery.data]
  );

  const unassignMutation = useMutation({
    mutationFn: (siteId: string) => employeesApi.unassignSite(employeeId, siteId),
    onSuccess: () => {
      toast.success(t("employees.sites.unassigned"));
      queryClient.invalidateQueries({ queryKey: queryKeys.employeeSites(employeeId) });
    },
    onError: (error) => toast.error(t("employees.sites.couldntUnassign"), { description: humanizeError(error) }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("employees.sites.title")}</CardTitle>
        {canWrite ? (
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <PlusIcon className="size-4" />
            {t("employees.sites.assignSite")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {assignmentsQuery.isError ? (
          <ErrorState error={assignmentsQuery.error} onRetry={() => assignmentsQuery.refetch()} />
        ) : assignmentsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState title={t("employees.sites.noSitesAssigned")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employees.sites.site")}</TableHead>
                <TableHead>{t("employees.sites.task")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                {canWrite ? <TableHead className="text-end">{t("common.actions")}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment._id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {siteNameBySiteId.get(assignment.siteId) ?? assignment.siteId}
                      {assignment.isPrimary ? (
                        <StatusBadge tone="info">{t("employees.sites.primary")}</StatusBadge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{assignment.task ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge tone={assignment.status === "active" ? "success" : "muted"}>
                      {assignment.status === "active" ? t("employees.active") : t("employees.inactive")}
                    </StatusBadge>
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingAssignment(assignment)}>
                          <PencilIcon className="size-3.5" />
                          {t("employees.sites.edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unassignMutation.isPending}
                          onClick={() => unassignMutation.mutate(assignment.siteId)}
                        >
                          {t("employees.sites.unassign")}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {canWrite ? (
        <AssignSiteDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          employeeId={employeeId}
          clientId={clientId}
          assignedSiteIds={assignedSiteIds}
        />
      ) : null}

      {canWrite && editingAssignment ? (
        <EditAssignmentDialog
          open={Boolean(editingAssignment)}
          onOpenChange={(open) => !open && setEditingAssignment(null)}
          employeeId={employeeId}
          clientId={clientId}
          assignment={editingAssignment}
        />
      ) : null}
    </Card>
  );
}
