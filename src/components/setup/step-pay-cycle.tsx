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
import { payPeriodConfigsApi, type PayPeriodConfig } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";
import { ExistingList } from "./existing-list";
import { BulkImportSection } from "./bulk-import-section";
import type { ColumnSpec } from "@/lib/bulk-import";

const CADENCES = ["weekly", "biweekly", "semi_monthly", "monthly", "daily", "salaried"] as const;
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const PAY_CYCLE_COLUMNS: ColumnSpec[] = [
  { key: "name", header: "Name", required: true, example: "Weekly warehouse" },
  { key: "cadence", header: "Cadence", required: true, example: "weekly", hint: "weekly, biweekly, semi_monthly, monthly, daily or salaried" },
  { key: "timezone", header: "Time Zone", required: true, example: "America/Los_Angeles", aliases: ["tz"] },
  { key: "weekStartDay", header: "Week Start Day", example: "1", hint: "0=Sunday..6=Saturday; required for weekly and biweekly" },
  { key: "anchorDate", header: "Anchor Date", example: "2026-01-05", hint: "YYYY-MM-DD; required for biweekly" },
  { key: "payDateOffsetDays", header: "Pay Days After Period End", example: "5" },
  { key: "cutoffDaysAfterPeriodEnd", header: "Cutoff Days After Period End", example: "5", hint: "Set together with Cutoff Time, or leave both blank" },
  { key: "cutoffTime", header: "Cutoff Time", example: "14:00", hint: "24-hour HH:mm, local to the Time Zone" },
];

/**
 * A pay period config defines when each period starts and ends. Nothing downstream works without
 * one: processing fails outright for an employee that resolves to none.
 */
export function StepPayCycle({ clientId, defaultTimezone }: { clientId: string; defaultTimezone: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<string>("weekly");
  const [timezone, setTimezone] = useState<string>(defaultTimezone ?? "");
  const [weekStartDay, setWeekStartDay] = useState<string>("1");
  const [anchorDate, setAnchorDate] = useState("");
  const [payDateOffsetDays, setPayDateOffsetDays] = useState("5");
  const [cutoffDays, setCutoffDays] = useState("");
  const [cutoffTime, setCutoffTime] = useState("");

  const listQuery = useQuery({
    queryKey: queryKeys.payPeriodConfigs({ clientId }),
    queryFn: () => payPeriodConfigsApi.list({ clientId, pageSize: 50 }),
    enabled: Boolean(clientId),
  });
  const configs = listQuery.data?.items ?? [];

  // Only these two cadences need a week start, and only biweekly needs an anchor — the server
  // enforces both, so the form hides what would be rejected rather than showing dead inputs.
  const needsWeekStart = cadence === "weekly" || cadence === "biweekly";
  const needsAnchor = cadence === "biweekly";

  const mutation = useMutation({
    mutationFn: () =>
      payPeriodConfigsApi.create({
        clientId,
        name: name.trim(),
        cadence: cadence as PayPeriodConfig["cadence"],
        timezone,
        weekStartDay: needsWeekStart ? Number(weekStartDay) : null,
        anchorDate: needsAnchor ? anchorDate : null,
        payDateOffsetDays: Number(payDateOffsetDays) || 0,
        // The pair is all-or-nothing server-side: a day offset with no time describes no moment.
        cutoffDaysAfterPeriodEnd: cutoffDays && cutoffTime ? Number(cutoffDays) : null,
        cutoffTime: cutoffDays && cutoffTime ? cutoffTime : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-period-configs"] });
      queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
      setAdding(false);
      setName("");
      toast.success(t("setup.payCycle.created"));
    },
    onError: (error) => toast.error(t("setup.payCycle.couldntCreate"), { description: humanizeError(error) }),
  });

  const canSubmit = Boolean(name.trim() && timezone && (!needsAnchor || anchorDate));

  return (
    <div className="space-y-4">
      <ExistingList
        loading={listQuery.isLoading}
        items={configs.map((c) => ({
          id: c._id,
          primary: c.name,
          secondary: `${t(`setup.cadence.${c.cadence}`)} · ${c.timezone}`,
        }))}
        emptyText={t("setup.payCycle.none")}
      />

      <BulkImportSection
        entityKey="payCycle"
        entityLabel={t("setup.payCycle.title")}
        columns={PAY_CYCLE_COLUMNS}
        templateName="pay-cycles-template"
        labelOf={(row) => row.name}
        invalidateKeys={["pay-period-configs"]}
        toBody={(row) => {
          if (!row.name || !row.cadence || !row.timezone) {
            throw new Error("Name, Cadence and Time Zone are all required");
          }
          const cadence = row.cadence.toLowerCase().replace(/[\s-]+/g, "_");
          if (!(CADENCES as readonly string[]).includes(cadence)) {
            throw new Error(`Unknown cadence "${row.cadence}" — use one of ${CADENCES.join(", ")}`);
          }
          const needsWeek = cadence === "weekly" || cadence === "biweekly";
          if (needsWeek && !row.weekStartDay) throw new Error(`Week Start Day is required for cadence "${cadence}"`);
          if (cadence === "biweekly" && !row.anchorDate) throw new Error("Anchor Date is required for cadence \"biweekly\"");
          const hasCutoff = Boolean(row.cutoffDaysAfterPeriodEnd && row.cutoffTime);
          if (Boolean(row.cutoffDaysAfterPeriodEnd) !== Boolean(row.cutoffTime)) {
            throw new Error("Set Cutoff Days and Cutoff Time together, or leave both blank");
          }
          return {
            clientId,
            name: row.name,
            cadence: cadence as PayPeriodConfig["cadence"],
            timezone: row.timezone,
            weekStartDay: needsWeek ? Number(row.weekStartDay) : null,
            anchorDate: cadence === "biweekly" ? row.anchorDate : null,
            payDateOffsetDays: row.payDateOffsetDays ? Number(row.payDateOffsetDays) : 0,
            cutoffDaysAfterPeriodEnd: hasCutoff ? Number(row.cutoffDaysAfterPeriodEnd) : null,
            cutoffTime: hasCutoff ? row.cutoffTime : null,
          };
        }}
        create={(body) => payPeriodConfigsApi.create(body)}
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
              <Label htmlFor="ppc-name">{t("setup.payCycle.name")}</Label>
              <Input id="ppc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("setup.payCycle.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ppc-cadence">{t("setup.payCycle.cadence")}</Label>
              <Combobox id="ppc-cadence" value={cadence} onValueChange={setCadence}>
                {CADENCES.map((c) => (
                  <ComboboxItem key={c} value={c}>
                    {t(`setup.cadence.${c}`)}
                  </ComboboxItem>
                ))}
              </Combobox>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ppc-tz">{t("setup.payCycle.timezone")}</Label>
              <TimezoneCombobox id="ppc-tz" value={timezone} onValueChange={setTimezone} />
              <p className="text-xs text-muted-foreground">{t("setup.payCycle.timezoneHint")}</p>
            </div>
            {needsWeekStart ? (
              <div className="space-y-1.5">
                <Label htmlFor="ppc-week-start">{t("setup.payCycle.weekStart")}</Label>
                <Combobox id="ppc-week-start" value={weekStartDay} onValueChange={setWeekStartDay}>
                  {WEEK_DAYS.map((d) => (
                    <ComboboxItem key={d} value={String(d)}>
                      {t(`setup.weekday.${d}`)}
                    </ComboboxItem>
                  ))}
                </Combobox>
              </div>
            ) : null}
            {needsAnchor ? (
              <div className="space-y-1.5">
                <Label htmlFor="ppc-anchor">{t("setup.payCycle.anchorDate")}</Label>
                <Input id="ppc-anchor" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("setup.payCycle.anchorDateHint")}</p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="ppc-offset">{t("setup.payCycle.payDateOffset")}</Label>
              <Input id="ppc-offset" type="number" min={0} value={payDateOffsetDays} onChange={(e) => setPayDateOffsetDays(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ppc-cutoff-days">{t("setup.payCycle.cutoff")}</Label>
              <div className="flex gap-2">
                <Input
                  id="ppc-cutoff-days"
                  type="number"
                  min={0}
                  className="w-24"
                  placeholder={t("setup.payCycle.cutoffDays")}
                  value={cutoffDays}
                  onChange={(e) => setCutoffDays(e.target.value)}
                />
                <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">{t("setup.payCycle.cutoffHint")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {t("setup.payCycle.create")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" />
          {t("setup.payCycle.add")}
        </Button>
      )}
    </div>
  );
}
