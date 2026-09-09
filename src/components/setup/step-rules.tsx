"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, humanizeError } from "@/components/data-state";
import {
  assignmentsApi,
  policiesApi,
  ruleGroupsApi,
  sitesApi,
  type Policy,
  type PolicyRef,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";
import { ExistingList } from "./existing-list";

const RULES_APP_URL = process.env.NEXT_PUBLIC_RULE_REPO_APP_URL;

/**
 * Assembles a working rule set out of platform-curated policy templates.
 *
 * Deliberately does NOT author policies. TLM's policies are maker-checker — it refuses to let the
 * submitter approve their own — so creating one cannot be completed by a single person and would
 * strand anyone who tried it from here. Selecting published GLOBAL policies, bundling them into a
 * rule group, publishing it and assigning it is entirely single-actor, so that is what this does;
 * authoring links out to the rules app instead.
 */
export function StepRules({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<string[]>([]);
  const [targetSiteIds, setTargetSiteIds] = useState<string[]>([]);

  const policiesQuery = useQuery({
    queryKey: queryKeys.policies({ scope: "global", status: "active" }),
    queryFn: () => policiesApi.list({ scope: "global", status: "active", pageSize: 100 }),
  });
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
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });

  const policies = policiesQuery.data?.items ?? [];
  const ruleGroups = ruleGroupsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const sites = sitesQuery.data?.items ?? [];

  // A rule set that resolves but computes no money is a real and confusing outcome: only the
  // OVERTIME processor fills the hour buckets, and only RATE turns them into amounts.
  const chosen = policies.filter((p) => selected.includes(p.policyId));
  const missingRate = chosen.length > 0 && !chosen.some((p) => p.policyType === "RATE");

  const mutation = useMutation({
    mutationFn: async () => {
      const policyRefs: PolicyRef[] = chosen.map((p) => ({
        policyId: p.policyId,
        policyType: p.policyType,
        versionPin: "latest",
      }));

      const group = await ruleGroupsApi.create({
        clientId,
        name: name.trim(),
        effectiveFrom,
        policyRefs,
      });
      // A draft rule group resolves to nothing, so publishing is part of the same action rather
      // than a second thing to remember.
      await ruleGroupsApi.publish(group.ruleGroupId);

      if (targetSiteIds.length > 0) {
        await assignmentsApi.create({
          clientId,
          ruleGroupId: group.ruleGroupId,
          targetType: "LOCATION",
          targetIds: targetSiteIds,
          effectiveFrom,
        });
      }
      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rule-groups"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setAdding(false);
      setName("");
      setSelected([]);
      toast.success(t("setup.rules.created"));
    },
    onError: (error) => toast.error(t("setup.rules.couldntCreate"), { description: humanizeError(error) }),
  });

  function toggle(policyId: string) {
    setSelected((prev) => (prev.includes(policyId) ? prev.filter((p) => p !== policyId) : [...prev, policyId]));
  }

  function toggleSite(siteId: string) {
    setTargetSiteIds((prev) => (prev.includes(siteId) ? prev.filter((s) => s !== siteId) : [...prev, siteId]));
  }

  const canSubmit = Boolean(name.trim() && selected.length > 0 && effectiveFrom);

  return (
    <div className="space-y-4">
      <ExistingList
        loading={ruleGroupsQuery.isLoading}
        items={ruleGroups.map((g) => ({
          id: g._id,
          primary: g.name,
          secondary: `${t(`setup.rules.status.${g.status}`)} · ${g.policyRefs.length} ${t("setup.rules.policiesSuffix")}`,
        }))}
        emptyText={t("setup.rules.noGroups")}
      />
      {assignments.length === 0 && ruleGroups.length > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t("setup.rules.noAssignments")}</p>
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
              <Label htmlFor="rg-name">{t("setup.rules.name")}</Label>
              <Input id="rg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("setup.rules.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-eff">{t("setup.rules.effectiveFrom")}</Label>
              <Input id="rg-eff" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("setup.rules.pickPolicies")}</Label>
            <p className="text-xs text-muted-foreground">{t("setup.rules.pickPoliciesHint")}</p>
            {policiesQuery.isError ? (
              <ErrorState error={policiesQuery.error} onRetry={() => policiesQuery.refetch()} />
            ) : policiesQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : policies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("setup.rules.noTemplates")}</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {policies.map((p: Policy) => (
                  <label key={p.policyId} className="flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-input accent-primary"
                      checked={selected.includes(p.policyId)}
                      onChange={() => toggle(p.policyId)}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {p.policyType}
                      </span>
                      {p.jurisdiction?.state ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">{p.jurisdiction.state}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {missingRate ? <p className="text-xs text-amber-700 dark:text-amber-400">{t("setup.rules.noRateWarning")}</p> : null}
          </div>

          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">{t("setup.rules.applyTo")}</p>
            <p className="text-xs text-muted-foreground">{t("setup.rules.applyToHint")}</p>
            {sites.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("setup.rules.noSitesYet")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sites.map((s) => (
                  <label
                    key={s._id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      targetSiteIds.includes(s.siteId) ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-input accent-primary"
                      checked={targetSiteIds.includes(s.siteId)}
                      onChange={() => toggleSite(s.siteId)}
                    />
                    {s.siteId}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t("setup.rules.create")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
            {RULES_APP_URL ? (
              <a
                href={`${RULES_APP_URL}/policies/new`}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {t("setup.rules.authorCustom")}
                <ExternalLinkIcon className="size-3.5" />
              </a>
            ) : null}
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" />
          {t("setup.rules.add")}
        </Button>
      )}
    </div>
  );
}
