"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { humanizeError } from "@/components/data-state";
import {
  CALENDAR_FORMATS,
  TIME_FORMATS,
  clientsApi,
  type ClientRecord,
  type CalendarFormat,
  type TimeFormat,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const NUMBER_FORMATS = ["1,234.56", "1.234,56", "1 234,56", "1,23,456.78"] as const;

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Regional defaults every user under this client inherits. These used to be settable only at
 * client creation, so this step is the first place an admin can correct them.
 */
export function StepOrganization({ client }: { client: ClientRecord }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [calendarFormat, setCalendarFormat] = useState<string>(client.calendarFormat);
  const [timeFormat, setTimeFormat] = useState<string>(client.timeFormat);
  const [timezone, setTimezone] = useState<string>(client.defaultTimezone ?? "");
  const [currency, setCurrency] = useState<string>(client.currency ?? "USD");
  const [numberFormat, setNumberFormat] = useState<string>(client.numberFormat ?? "1,234.56");
  const [weekStart, setWeekStart] = useState<string>(String(client.displayWeekStartDay ?? 0));

  const mutation = useMutation({
    mutationFn: () =>
      clientsApi.updateMe({
        calendarFormat: calendarFormat as CalendarFormat,
        timeFormat: timeFormat as TimeFormat,
        // Empty means "no company default" — each site and employee then supplies its own.
        defaultTimezone: timezone || null,
        currency,
        numberFormat,
        displayWeekStartDay: Number(weekStart),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.myClient, { client: updated });
      toast.success(t("setup.organization.saved"));
    },
    onError: (error) => toast.error(t("setup.organization.couldntSave"), { description: humanizeError(error) }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="setup-tz">{t("setup.organization.timezone")}</Label>
          <TimezoneCombobox id="setup-tz" value={timezone} onValueChange={setTimezone} />
          <p className="text-xs text-muted-foreground">{t("setup.organization.timezoneHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-currency">{t("setup.organization.currency")}</Label>
          <Combobox id="setup-currency" value={currency} onValueChange={setCurrency}>
            {Intl.supportedValuesOf("currency").map((code) => (
              <ComboboxItem key={code} value={code}>
                {code}
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-date-format">{t("setup.organization.dateFormat")}</Label>
          <Combobox id="setup-date-format" value={calendarFormat} onValueChange={setCalendarFormat}>
            {CALENDAR_FORMATS.map((f) => (
              <ComboboxItem key={f} value={f}>
                {f}
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-time-format">{t("setup.organization.timeFormat")}</Label>
          <Combobox id="setup-time-format" value={timeFormat} onValueChange={setTimeFormat}>
            {TIME_FORMATS.map((f) => (
              <ComboboxItem key={f} value={f}>
                {t(`profile.timeFormatOptions.${f}`)}
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-number-format">{t("setup.organization.numberFormat")}</Label>
          <Combobox id="setup-number-format" value={numberFormat} onValueChange={setNumberFormat}>
            {NUMBER_FORMATS.map((f) => (
              <ComboboxItem key={f} value={f}>
                {f}
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-week-start">{t("setup.organization.weekStart")}</Label>
          <Combobox id="setup-week-start" value={weekStart} onValueChange={setWeekStart}>
            {WEEK_DAYS.map((d) => (
              <ComboboxItem key={d} value={String(d)}>
                {t(`setup.weekday.${d}`)}
              </ComboboxItem>
            ))}
          </Combobox>
          <p className="text-xs text-muted-foreground">{t("setup.organization.weekStartHint")}</p>
        </div>
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {t("setup.organization.save")}
      </Button>
    </form>
  );
}
