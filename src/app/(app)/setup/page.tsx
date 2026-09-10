"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import { SetupFindings, SetupStepCard, type StepState } from "@/components/setup/setup-step-card";
import { SetupInventory, type InventoryRow } from "@/components/setup/setup-inventory";
import { StepOrganization } from "@/components/setup/step-organization";
import { StepPayCycle } from "@/components/setup/step-pay-cycle";
import { StepSites } from "@/components/setup/step-sites";
import { StepEmployees } from "@/components/setup/step-employees";
import { StepRules } from "@/components/setup/step-rules";
import { StepReview } from "@/components/setup/step-review";
import { useMyClient } from "@/lib/hooks";
import {
  assignmentsApi,
  employeesApi,
  payPeriodConfigsApi,
  ruleGroupsApi,
  setupApi,
  sitesApi,
  tasksApi,
  type ReadinessStatus,
  type ReadinessStep,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const COUNTED_STEPS = 5;

/** The readiness report's three states map onto the step card's four; "todo" is a frontend notion. */
function stateFor(step: ReadinessStep | undefined): StepState {
  if (!step) return "todo";
  if (step.status === "blocked") return "blocked";
  if (step.status === "attention") return "attention";
  return "done";
}

function overallState(status: ReadinessStatus, rulesReady: boolean): StepState {
  if (status === "blocked" || !rulesReady) return "blocked";
  if (status === "attention") return "attention";
  return "done";
}

export default function SetupPage() {
  const { t } = useTranslation();
  const { clientId, picker } = useEditableClientId();
  const clientQuery = useMyClient();

  const readinessQuery = useQuery({
    queryKey: queryKeys.setupReadiness(clientId),
    queryFn: () => setupApi.readiness(clientId || undefined),
    enabled: Boolean(clientId),
  });

  // The rules half lives in TLM, which tlm-backend does not model — so this step's status is
  // composed here from TLM's own endpoints rather than folded into the readiness report. Reading
  // another service's private collections to avoid one extra call would be the worse trade.
  const ruleGroupsQuery = useQuery({
    queryKey: queryKeys.ruleGroups({ clientId }),
    queryFn: () => ruleGroupsApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments({ clientId }),
    queryFn: () => assignmentsApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });

  // Read here as well as inside the steps: React Query dedupes by key, so the inventory costs
  // nothing extra and is guaranteed to show the same numbers a step shows when opened.
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const configsQuery = useQuery({
    queryKey: queryKeys.payPeriodConfigs({ clientId }),
    queryFn: () => payPeriodConfigsApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 20 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 20 }),
    enabled: Boolean(clientId),
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks({ clientId }),
    queryFn: () => tasksApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });

  const client = clientQuery.data?.client ?? null;
  const report = readinessQuery.data;
  const activeGroups = (ruleGroupsQuery.data?.items ?? []).filter((g) => g.status === "active");
  const assignments = assignmentsQuery.data?.items ?? [];
  // Rules only actually apply when a published group is pointed at something.
  const rulesReady = activeGroups.length > 0 && assignments.length > 0;

  const stepByKey = (key: string) => report?.steps.find((s) => s.key === key);

  const inventory: InventoryRow[] = [
    {
      label: t("setup.sites.title"),
      count: sitesQuery.data?.total ?? 0,
      examples: (sitesQuery.data?.items ?? []).map((r) => r.siteId),
      href: "/sites",
      required: true,
    },
    {
      label: t("setup.inventory.payCycles"),
      count: configsQuery.data?.total ?? 0,
      examples: (configsQuery.data?.items ?? []).map((r) => r.name),
      href: "/pay-period-configs",
      required: true,
    },
    {
      label: t("setup.employees.title"),
      count: employeesQuery.data?.total ?? 0,
      examples: (employeesQuery.data?.items ?? []).map((r) => r.employeeId),
      href: "/employees",
      required: true,
    },
    {
      label: t("setup.inventory.tasks"),
      count: tasksQuery.data?.total ?? 0,
      examples: (tasksQuery.data?.items ?? []).map((r) => r.name),
      href: "/tasks",
    },
    {
      label: t("setup.inventory.ruleSets"),
      count: activeGroups.length,
      examples: activeGroups.map((g) => g.name),
      required: true,
    },
    {
      label: t("setup.inventory.assignments"),
      count: assignments.length,
      examples: assignments.map((a) => `${a.targetType}: ${a.targetIds.join(", ")}`),
      required: true,
    },
  ];

  const blockerCount =
    (report?.steps ?? []).reduce((n, step) => n + step.findings.filter((f) => f.severity === "blocked").length, 0) +
    (rulesReady ? 0 : 1);

  const liveCounts = {
    payCycles: configsQuery.data?.total ?? 0,
    locations: sitesQuery.data?.total ?? 0,
    employees: employeesQuery.data?.total ?? 0,
    rules: activeGroups.length + assignments.length,
  };
  type RunKey = keyof typeof liveCounts;

  /**
   * A setup RUN, not the client's overall state.
   *
   * Deriving step states from readiness was wrong: a client who already has sites and employees
   * saw every step marked done the moment they started a new setup, which is useless as a guide.
   * A new setup is a new scenario — opening in another state, onboarding another depot — so the
   * steps have to describe what THIS run has added.
   *
   * Measured by snapshotting the counts when the run starts and comparing: a step is done once
   * its count has grown, so it needs no cooperation from the step components and cannot drift out
   * of step with what was actually created.
   */
  const [run, setRun] = useState<{ baseline: Record<RunKey, number>; reused: RunKey[] } | null>(null);
  const showSteps = run !== null || blockerCount > 0;

  const addedIn = (key: RunKey) => (run ? Math.max(0, liveCounts[key] - run.baseline[key]) : 0);
  const runState = (key: RunKey): StepState => {
    if (!run) return stateFor(stepByKey(key === "rules" ? "employees" : key));
    if (addedIn(key) > 0) return "done";
    if (run.reused.includes(key)) return "done";
    return "todo";
  };
  const markReused = (key: RunKey) =>
    setRun((prev) => (prev ? { ...prev, reused: [...prev.reused, key] } : prev));

  const runResolved = (["payCycles", "locations", "employees", "rules"] as RunKey[]).filter(
    (k) => runState(k) === "done"
  ).length;

  // Which step is expanded. Lifted out of the cards so finishing one can open the next: the flow
  // previously ended each step with the user scrolling and guessing what came after.
  const [openStep, setOpenStep] = useState<number | null>(null);
  const stepProps = (index: number, autoOpen: boolean) => ({
    open: openStep === null ? autoOpen : openStep === index,
    onOpenChange: (next: boolean) => setOpenStep(next ? index : -1),
  });

  // Organization, pay cycle, sites, employees, rules. Review is excluded deliberately: it reports
  // on the others rather than being a task of its own, so counting it would let progress read
  // 5/6 forever.
  //
  // Counts steps that are not BLOCKING rather than only spotless ones, so this number means the
  // same thing as the go-live gate. Counting only "pass" made a non-blocking nit stall progress
  // for good: repairing an employee's pay cycle left it merely unassigned to a site — attention,
  // not blocked — and the bar sat at 3/5 while the review step correctly said payroll could run.
  // The per-step badge still shows "Review" so the nit stays visible.
  const readyCount =
    1 + // organization defaults never block payroll; they are preferences
    ["payCycles", "locations", "employees"].filter((k) => {
      const status = stepByKey(k)?.status;
      return status !== undefined && status !== "blocked";
    }).length +
    (rulesReady ? 1 : 0);


  /**
   * Footer actions for a step during a run.
   *
   * "Use what's already set up" matters because not every scenario needs new everything: a new
   * depot in an existing state reuses the pay cycle and the rule set. Without it the only way to
   * complete such a step would be to create a duplicate.
   */
  function stepFooter(key: RunKey, nextIndex: number, nextTitle: string) {
    const added = addedIn(key);
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => setOpenStep(nextIndex)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("setup.continueTo", { step: nextTitle })}
          <ArrowRightIcon className="size-4" />
        </button>
        {run && added > 0 ? (
          <span className="text-xs text-muted-foreground">{t("setup.addedInThisSetup", { count: String(added) })}</span>
        ) : null}
        {run && added === 0 && !run.reused.includes(key) && liveCounts[key] > 0 ? (
          <button
            type="button"
            onClick={() => markReused(key)}
            className="ms-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("setup.useExisting")}
          </button>
        ) : null}
        {run && run.reused.includes(key) ? (
          <span className="ms-auto text-xs text-muted-foreground">{t("setup.usingExisting")}</span>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t("setup.title")} description={t("setup.description")} />

      {picker ? (
        <Card>
          <CardContent className="pt-6">{picker}</CardContent>
        </Card>
      ) : null}

      {!clientId ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{t("setup.selectClientFirst")}</CardContent>
        </Card>
      ) : readinessQuery.isError ? (
        <ErrorState error={readinessQuery.error} onRetry={() => readinessQuery.refetch()} />
      ) : readinessQuery.isLoading || clientQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <SetupInventory
            rows={inventory}
            loading={sitesQuery.isLoading || employeesQuery.isLoading}
            blockerCount={blockerCount}
            stepsOpen={showSteps}
            onNewSetup={() => {
              // Snapshot now, so every step starts from "not started" for this run regardless of
              // what the client already has.
              setRun({ baseline: { ...liveCounts }, reused: [] });
              setOpenStep(2);
            }}
          />

          {report && showSteps ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t(run ? "setup.runProgress" : "setup.progress")}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {run ? runResolved : readyCount}
                    <span className="text-base font-normal text-muted-foreground">
                      {" / "}
                      {run ? 4 : COUNTED_STEPS}
                    </span>
                  </p>
                </div>
                <div className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${((run ? runResolved / 4 : readyCount / COUNTED_STEPS)) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {client && showSteps ? (
            <SetupStepCard
              index={1}
              title={t("setup.organization.title")}
              description={t("setup.organization.description")}
              state={client.defaultTimezone ? "done" : "attention"}
              {...stepProps(1, false)}
              footer={
                <button
                  type="button"
                  onClick={() => setOpenStep(2)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {t("setup.continueTo", { step: t("setup.payCycle.title") })}
                  <ArrowRightIcon className="size-4" />
                </button>
              }
              summary={t("setup.organization.summary", {
                date: client.calendarFormat,
                currency: client.currency ?? "USD",
                zone: client.defaultTimezone ?? t("setup.organization.noTimezone"),
              })}
            >
              <StepOrganization client={client} />
            </SetupStepCard>
          ) : null}

          {showSteps ? (
          <SetupStepCard
            index={2}
            title={t("setup.payCycle.title")}
            description={t("setup.payCycle.description")}
            state={runState("payCycles")}
            {...stepProps(2, runState("payCycles") === "todo")}
            footer={stepFooter("payCycles", 3, t("setup.sites.title"))}
          >
            <SetupFindings findings={stepByKey("payCycles")?.findings ?? []} />
            <StepPayCycle clientId={clientId} defaultTimezone={client?.defaultTimezone ?? null} />
          </SetupStepCard>
          ) : null}

          {showSteps ? (
          <SetupStepCard
            index={3}
            title={t("setup.sites.title")}
            description={t("setup.sites.description")}
            state={runState("locations")}
            {...stepProps(3, runState("locations") === "todo")}
            footer={stepFooter("locations", 4, t("setup.employees.title"))}
          >
            <SetupFindings findings={stepByKey("locations")?.findings ?? []} />
            <StepSites clientId={clientId} defaultTimezone={client?.defaultTimezone ?? null} />
          </SetupStepCard>
          ) : null}

          {showSteps ? (
          <SetupStepCard
            index={4}
            title={t("setup.employees.title")}
            description={t("setup.employees.description")}
            state={runState("employees")}
            {...stepProps(4, runState("employees") === "todo")}
            footer={stepFooter("employees", 5, t("setup.rules.title"))}
          >
            <SetupFindings findings={stepByKey("employees")?.findings ?? []} />
            <StepEmployees clientId={clientId} defaultTimezone={client?.defaultTimezone ?? null} />
          </SetupStepCard>
          ) : null}

          {showSteps ? (
          <SetupStepCard
            index={5}
            title={t("setup.rules.title")}
            description={t("setup.rules.description")}
            state={runState("rules")}
            {...stepProps(5, runState("rules") === "todo")}
            footer={stepFooter("rules", 6, t("setup.review.title"))}
            summary={
              rulesReady
                ? t("setup.rules.summary", { groups: String(activeGroups.length), assignments: String(assignments.length) })
                : undefined
            }
          >
            <StepRules clientId={clientId} />
          </SetupStepCard>
          ) : null}

          {report && showSteps ? (
            <SetupStepCard
              index={6}
              title={t("setup.review.title")}
              description={t("setup.review.description")}
              state={overallState(report.status, rulesReady)}
              defaultOpen
            >
              <StepReview report={report} rulesReady={rulesReady} />
            </SetupStepCard>
          ) : null}
        </div>
      )}
    </>
  );
}
