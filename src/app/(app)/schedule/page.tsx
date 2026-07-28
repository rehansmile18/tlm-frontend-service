"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterGrid } from "@/components/schedule/roster-grid";
import { AdherenceView } from "@/components/schedule/adherence-view";
import { ShiftFormDialog } from "@/components/schedule/shift-form-dialog";
import { BulkCreateDialog } from "@/components/schedule/bulk-create-dialog";
import { employeesApi, sitesApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth, useRole } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

type ViewMode = "week" | "day" | "adherence";

export default function SchedulePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSiteManager, siteIds } = useRole();
  const canWrite = hasPermission(user, "schedule:write");

  // CLIENT_ADMIN/SITE_MANAGER sessions always carry their own clientId. A PLATFORM_ADMIN's
  // session has none (they operate across clients), which this simple resolution doesn't cover.
  // TODO: PLATFORM_ADMIN needs an explicit client picker to view a chosen client's schedule.
  const clientId = user?.clientId ?? "";

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });
  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ clientId, pageSize: 200 }),
    queryFn: () => employeesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId),
  });

  // A SITE_MANAGER only ever builds/views shifts at their own managed sites — restrict the
  // filter's options accordingly instead of letting them pick an out-of-scope site.
  const allSites = sitesQuery.data?.items ?? [];
  const siteOptions = isSiteManager ? allSites.filter((site) => siteIds.includes(site._id)) : allSites;
  const employeeOptions = employeesQuery.data?.items ?? [];

  // Defaults to the site manager's first managed site, or the first site returned for the
  // client, without needing an effect + setState round-trip: once the user explicitly picks a
  // site the raw selection takes over.
  const defaultSiteId = useMemo(() => {
    if (isSiteManager) return siteIds[0] ?? "";
    return siteOptions[0]?._id ?? "";
  }, [isSiteManager, siteIds, siteOptions]);
  const siteId = selectedSiteId || defaultSiteId;

  function shiftAnchor(direction: 1 | -1) {
    setAnchor((prev) => addDays(prev, viewMode === "day" ? direction : direction * 7));
  }

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  // What RosterGrid actually renders: the single day being viewed in "day" mode, or the Monday
  // of the current week in "week" mode. Adherence always reports over the full week, regardless
  // of whether Week or Day was last selected, since it's a period report rather than a builder.
  const rosterRangeStart = viewMode === "day" ? startOfDay(anchor) : weekStart;

  const rangeLabel =
    viewMode === "day"
      ? format(startOfDay(anchor), "EEEE, MMM d, yyyy")
      : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <>
      <PageHeader
        title={t("schedule.title")}
        description={t("schedule.description")}
        actions={
          canWrite ? (
            <>
              <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
                <UsersIcon className="size-4" />
                {t("schedule.bulkCreate")}
              </Button>
              <Button onClick={() => setShiftDialogOpen(true)}>
                <PlusIcon className="size-4" />
                {t("schedule.newShift")}
              </Button>
            </>
          ) : null
        }
      />

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48 space-y-1.5">
            <Label htmlFor="filter-site">{t("schedule.site")}</Label>
            <Combobox
              id="filter-site"
              value={siteId}
              onValueChange={setSelectedSiteId}
              placeholder={t("common.select")}
            >
              {siteOptions.map((site) => (
                <ComboboxItem key={site._id} value={site._id}>
                  {site.name}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>

          <div className="w-48 space-y-1.5">
            <Label htmlFor="filter-employee">{t("schedule.employee")}</Label>
            <Combobox id="filter-employee" value={employeeId} onValueChange={setEmployeeId}>
              <ComboboxItem value="">{t("common.all")}</ComboboxItem>
              {employeeOptions.map((employee) => (
                <ComboboxItem key={employee._id} value={employee._id}>
                  {employee.employeeId}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => shiftAnchor(-1)} aria-label={t("common.previous")}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-medium">{rangeLabel}</span>
            <Button variant="outline" size="icon" onClick={() => shiftAnchor(1)} aria-label={t("common.next")}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="ms-auto">
            <TabsList>
              <TabsTrigger value="week">{t("schedule.week")}</TabsTrigger>
              <TabsTrigger value="day">{t("schedule.day")}</TabsTrigger>
              <TabsTrigger value="adherence">{t("schedule.adherenceView")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {!siteId ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("common.nothingToShow")}</Card>
      ) : viewMode === "adherence" ? (
        <AdherenceView clientId={clientId} siteId={siteId} employeeId={employeeId || undefined} from={weekStart} to={weekEnd} />
      ) : (
        <RosterGrid
          clientId={clientId}
          siteId={siteId}
          employeeId={employeeId || undefined}
          weekStart={rosterRangeStart}
          mode={viewMode}
        />
      )}

      <ShiftFormDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
        prefill={{ siteId: siteId || undefined, date: rosterRangeStart }}
      />
      <BulkCreateDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} siteId={siteId || undefined} />
    </>
  );
}
