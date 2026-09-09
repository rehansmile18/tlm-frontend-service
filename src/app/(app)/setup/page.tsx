"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import { SetupFindings, SetupStepCard, type StepState } from "@/components/setup/setup-step-card";
import { StepOrganization } from "@/components/setup/step-organization";
import { StepPayCycle } from "@/components/setup/step-pay-cycle";
import { StepSites } from "@/components/setup/step-sites";
import { StepEmployees } from "@/components/setup/step-employees";
import { StepRules } from "@/components/setup/step-rules";
import { StepReview } from "@/components/setup/step-review";
import { useMyClient } from "@/lib/hooks";
import { assignmentsApi, ruleGroupsApi, setupApi, type ReadinessStatus, type ReadinessStep } from "@/lib/resources";
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

  const client = clientQuery.data?.client ?? null;
  const report = readinessQuery.data;
  const activeGroups = (ruleGroupsQuery.data?.items ?? []).filter((g) => g.status === "active");
  const assignments = assignmentsQuery.data?.items ?? [];
  // Rules only actually apply when a published group is pointed at something.
  const rulesReady = activeGroups.length > 0 && assignments.length > 0;

  const stepByKey = (key: string) => report?.steps.find((s) => s.key === key);

  // Organization, pay cycle, sites, employees, rules. Review is excluded deliberately: it reports
  // on the others rather than being a task of its own, so counting it would let progress read
  // 5/6 forever.
  const doneCount =
    (client?.defaultTimezone ? 1 : 0) +
    ["payCycles", "locations", "employees"].filter((k) => stepByKey(k)?.status === "pass").length +
    (rulesReady ? 1 : 0);

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
          {report ? (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("setup.progress")}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {doneCount}
                    <span className="text-base font-normal text-muted-foreground"> / {COUNTED_STEPS}</span>
                  </p>
                </div>
                <div className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${(doneCount / COUNTED_STEPS) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {client ? (
            <SetupStepCard
              index={1}
              title={t("setup.organization.title")}
              description={t("setup.organization.description")}
              state={client.defaultTimezone ? "done" : "attention"}
              summary={t("setup.organization.summary", {
                date: client.calendarFormat,
                currency: client.currency ?? "USD",
                zone: client.defaultTimezone ?? t("setup.organization.noTimezone"),
              })}
            >
              <StepOrganization client={client} />
            </SetupStepCard>
          ) : null}

          <SetupStepCard
            index={2}
            title={t("setup.payCycle.title")}
            description={t("setup.payCycle.description")}
            state={stateFor(stepByKey("payCycles"))}
            defaultOpen={stateFor(stepByKey("payCycles")) === "blocked"}
          >
            <SetupFindings findings={stepByKey("payCycles")?.findings ?? []} />
            <StepPayCycle clientId={clientId} defaultTimezone={client?.defaultTimezone ?? null} />
          </SetupStepCard>

          <SetupStepCard
            index={3}
            title={t("setup.sites.title")}
            description={t("setup.sites.description")}
            state={stateFor(stepByKey("locations"))}
            defaultOpen={stateFor(stepByKey("locations")) === "blocked"}
          >
            <SetupFindings findings={stepByKey("locations")?.findings ?? []} />
            <StepSites clientId={clientId} defaultTimezone={client?.defaultTimezone ?? null} />
          </SetupStepCard>

          <SetupStepCard
            index={4}
            title={t("setup.employees.title")}
            description={t("setup.employees.description")}
            state={stateFor(stepByKey("employees"))}
            defaultOpen={stateFor(stepByKey("employees")) === "blocked"}
          >
            <SetupFindings findings={stepByKey("employees")?.findings ?? []} />
            <StepEmployees clientId={clientId} defaultTimezone={client?.defaultTimezone ?? null} />
          </SetupStepCard>

          <SetupStepCard
            index={5}
            title={t("setup.rules.title")}
            description={t("setup.rules.description")}
            state={rulesReady ? "done" : "blocked"}
            defaultOpen={!rulesReady}
            summary={
              rulesReady
                ? t("setup.rules.summary", { groups: String(activeGroups.length), assignments: String(assignments.length) })
                : undefined
            }
          >
            <StepRules clientId={clientId} />
          </SetupStepCard>

          {report ? (
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
