"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { humanizeError } from "@/components/data-state";
import { sitesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";
import { ExistingList } from "./existing-list";

/**
 * A site's state is what selects its state-specific pay rules in TLM, so the address is collected
 * here rather than left to a later edit — a site with no state is a site whose jurisdiction nobody
 * has consciously chosen, which the readiness report flags.
 */
export function StepSites({ clientId, defaultTimezone }: { clientId: string; defaultTimezone: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone ?? "");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("US");
  const [costCentre, setCostCentre] = useState("");

  const listQuery = useQuery({
    queryKey: queryKeys.sites({ clientId }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const sites = listQuery.data?.items ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      sitesApi.create({
        clientId,
        siteId: siteId.trim(),
        name: name.trim(),
        timezone,
        location: {
          addressLine1: null,
          addressLine2: null,
          city: city.trim() || null,
          state: state.trim().toUpperCase() || null,
          country: country.trim().toUpperCase() || null,
          postalCode: null,
        },
        costCentre: costCentre.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
      setAdding(false);
      setSiteId("");
      setName("");
      setCity("");
      setCostCentre("");
      toast.success(t("setup.sites.created"));
    },
    onError: (error) => toast.error(t("setup.sites.couldntCreate"), { description: humanizeError(error) }),
  });

  const canSubmit = Boolean(siteId.trim() && name.trim() && timezone);

  return (
    <div className="space-y-4">
      <ExistingList
        loading={listQuery.isLoading}
        items={sites.map((s) => ({
          id: s._id,
          primary: `${s.siteId} · ${s.name}`,
          secondary: s.location?.state ? `${s.location.state} · ${s.timezone}` : s.timezone,
        }))}
        emptyText={t("setup.sites.none")}
      />

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
              <Label htmlFor="site-code">{t("setup.sites.code")}</Label>
              <Input id="site-code" value={siteId} onChange={(e) => setSiteId(e.target.value)} placeholder={t("setup.sites.codePlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("setup.sites.codeHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-name">{t("setup.sites.name")}</Label>
              <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("setup.sites.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-tz">{t("setup.sites.timezone")}</Label>
              <TimezoneCombobox id="site-tz" value={timezone} onValueChange={setTimezone} />
              <p className="text-xs text-muted-foreground">{t("setup.sites.timezoneHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-cc">{t("setup.sites.costCentre")}</Label>
              <Input id="site-cc" value={costCentre} onChange={(e) => setCostCentre(e.target.value)} placeholder={t("setup.sites.costCentrePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-city">{t("setup.sites.city")}</Label>
              <Input id="site-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="site-state">{t("setup.sites.state")}</Label>
                <Input id="site-state" value={state} onChange={(e) => setState(e.target.value)} maxLength={3} placeholder="CA" />
                <p className="text-xs text-muted-foreground">{t("setup.sites.stateHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-country">{t("setup.sites.country")}</Label>
                <Input id="site-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t("setup.sites.create")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" />
          {t("setup.sites.add")}
        </Button>
      )}
    </div>
  );
}
