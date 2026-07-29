"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ReceiptTextIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { employeesApi, punchesApi, schedulesApi, sitesApi, timesheetsApi } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { hasPermission, useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

// A capped page size used to derive a client-side count when the underlying list endpoint has
// no server-side status filter to request an exact one from (employees/punches below). Mirrors
// the same "good enough for v1" directory-cap pattern used elsewhere in the app (EmployeesPage's
// group lookup, RosterGrid's employee directory, PunchesPage's site lookup, etc.) rather than
// paging through every record just to count a subset.
const COUNT_CAP = 200;

function StatTile({ label, value, loading, icon }: { label: string; value: number | undefined; loading: boolean; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-14" />
        ) : (
          <span className="text-3xl font-semibold tabular-nums">{value ?? "—"}</span>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      {label}
      <ArrowRightIcon className="size-4 text-muted-foreground" />
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const canReadEmployees = hasPermission(user, "employee:read");
  const canReadSites = hasPermission(user, "site:read");
  const canReadSchedule = hasPermission(user, "schedule:read");
  const canReadPunches = hasPermission(user, "punch:read");
  const canReadTimesheets = hasPermission(user, "timesheet:read");

  // No clientId is passed on any of the queries below — every one of these endpoints scopes its
  // results to the caller's own client (and, for punches/schedules, mirrors exactly what their
  // own pages already request) via the bearer token server-side, the same way EmployeesPage's
  // own top-level list call does. A PLATFORM_ADMIN session (no clientId of its own) therefore
  // sees an across-all-clients count here, consistent with how the Employees page behaves for
  // that role today.

  // Employees + Active employees share one query: `.total` gives the exact employee count for
  // the "Employees" tile at no extra cost, while the fetched items are scanned client-side for
  // status === "active" to approximate "Active employees" — the employees list endpoint has no
  // status filter to request an exact server-side count from instead.
  const employeesQuery = useQuery({
    queryKey: queryKeys.employees({ pageSize: COUNT_CAP }),
    queryFn: () => employeesApi.list({ pageSize: COUNT_CAP }),
    enabled: canReadEmployees,
  });
  const activeEmployeeCount = employeesQuery.data?.items.filter((employee) => employee.status === "active").length;

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ pageSize: 1 }),
    queryFn: () => sitesApi.list({ pageSize: 1 }),
    enabled: canReadSites,
  });

  // "Today" is the caller's local calendar day; schedules carry their own IANA timezone per
  // shift, so this is a reasonable v1 boundary rather than a per-shift-timezone-exact one — the
  // same from/to ISO range shape RosterGrid already queries with, for consistency.
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();
  const todaysShiftsParams = { from: todayStart, to: todayEnd, status: "scheduled", pageSize: 1 };
  const todaysShiftsQuery = useQuery({
    queryKey: queryKeys.schedules(todaysShiftsParams),
    queryFn: () => schedulesApi.list(todaysShiftsParams),
    enabled: canReadSchedule,
  });

  // Open punches: the punches list endpoint has no status filter either, so "open" is
  // approximated by scanning the most recent COUNT_CAP punches (the API sorts newest-first by
  // clockIn) rather than paging through the full history just to count — good enough for a
  // dashboard tile; see PunchesPage for the same endpoint used with its full filter set.
  const punchesQuery = useQuery({
    queryKey: queryKeys.punches({ pageSize: COUNT_CAP }),
    queryFn: () => punchesApi.list({ pageSize: COUNT_CAP }),
    enabled: canReadPunches,
  });
  const openPunchCount = punchesQuery.data?.items.filter((punch) => punch.status === "open").length;

  // "Pending" timesheets are treated as those still in `draft` — the first stage before a
  // processing run's output is finalized to `completed` (see Timesheet["status"] in resources.ts).
  const pendingTimesheetsParams = { status: "draft", pageSize: 1 };
  const pendingTimesheetsQuery = useQuery({
    queryKey: queryKeys.timesheets(pendingTimesheetsParams),
    queryFn: () => timesheetsApi.list(pendingTimesheetsParams),
    enabled: canReadTimesheets,
  });

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("dashboard.welcome")}
          {user?.email ? `, ${user.email}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.overview")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {canReadEmployees ? (
          <StatTile
            label={t("dashboard.employees")}
            value={employeesQuery.data?.total}
            loading={employeesQuery.isLoading}
            icon={<UsersIcon className="size-4" />}
          />
        ) : null}
        {canReadEmployees ? (
          <StatTile
            label={t("dashboard.activeEmployees")}
            value={activeEmployeeCount}
            loading={employeesQuery.isLoading}
            icon={<UserCheckIcon className="size-4" />}
          />
        ) : null}
        {canReadSites ? (
          <StatTile
            label={t("dashboard.sites")}
            value={sitesQuery.data?.total}
            loading={sitesQuery.isLoading}
            icon={<MapPinIcon className="size-4" />}
          />
        ) : null}
        {canReadSchedule ? (
          <StatTile
            label={t("dashboard.todaysShifts")}
            value={todaysShiftsQuery.data?.total}
            loading={todaysShiftsQuery.isLoading}
            icon={<CalendarIcon className="size-4" />}
          />
        ) : null}
        {canReadPunches ? (
          <StatTile
            label={t("dashboard.openPunches")}
            value={openPunchCount}
            loading={punchesQuery.isLoading}
            icon={<ClockIcon className="size-4" />}
          />
        ) : null}
        {canReadTimesheets ? (
          <StatTile
            label={t("dashboard.pendingTimesheets")}
            value={pendingTimesheetsQuery.data?.total}
            loading={pendingTimesheetsQuery.isLoading}
            icon={<ReceiptTextIcon className="size-4" />}
          />
        ) : null}
      </div>

      {canReadSchedule || canReadPunches || canReadTimesheets ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {canReadSchedule ? <QuickAction href="/schedule" label={t("dashboard.viewSchedule")} /> : null}
            {canReadPunches ? <QuickAction href="/punches" label={t("dashboard.viewPunches")} /> : null}
            {canReadTimesheets ? <QuickAction href="/timesheets" label={t("dashboard.viewTimesheets")} /> : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
