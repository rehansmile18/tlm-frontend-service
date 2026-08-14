"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { humanizeError } from "@/components/data-state";
import { authApi, sitesApi, CALENDAR_FORMATS, TIME_FORMATS, type CalendarFormat, type TimeFormat, type MeResult } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useMyProfile } from "@/lib/hooks";
import { useAuth, useRole } from "@/lib/auth";
import { LOCALES, useTranslation } from "@/lib/i18n/i18n";

// A blank Combobox value represents "use the client default" (server-side null) — same sentinel
// convention used elsewhere in the app for an unset/inherited preference.
const CLIENT_DEFAULT = "";

function DateTimeFormatCard({ profile }: { profile: MeResult }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dateFormat, setDateFormat] = useState<string>(profile.preferredDateFormat ?? CLIENT_DEFAULT);
  const [timeFormat, setTimeFormat] = useState<string>(profile.preferredTimeFormat ?? CLIENT_DEFAULT);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        preferredDateFormat: (dateFormat || null) as CalendarFormat | null,
        preferredTimeFormat: (timeFormat || null) as TimeFormat | null,
      }),
    onSuccess: (updated) => {
      // Applies immediately for this session (every date/time on screen re-renders in the new
      // format right away) in addition to persisting it for every future login.
      queryClient.setQueryData(queryKeys.myProfile, updated);
      toast.success(t("profile.preferencesSaved"));
    },
    onError: (error) => toast.error(t("profile.couldntSavePreferences"), { description: humanizeError(error) }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.dateTimeFormatTitle")}</CardTitle>
          <CardDescription>{t("profile.dateTimeFormatDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="preferredDateFormat">{t("profile.dateFormat")}</Label>
            <Combobox id="preferredDateFormat" value={dateFormat} onValueChange={setDateFormat}>
              <ComboboxItem value={CLIENT_DEFAULT}>{t("profile.useClientDefault")}</ComboboxItem>
              {CALENDAR_FORMATS.map((f) => (
                <ComboboxItem key={f} value={f}>
                  {f}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferredTimeFormat">{t("profile.timeFormat")}</Label>
            <Combobox id="preferredTimeFormat" value={timeFormat} onValueChange={setTimeFormat}>
              <ComboboxItem value={CLIENT_DEFAULT}>{t("profile.useClientDefault")}</ComboboxItem>
              {TIME_FORMATS.map((f) => (
                <ComboboxItem key={f} value={f}>
                  {t(`profile.timeFormatOptions.${f}`)}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { isClientAdmin, isPlatformAdmin } = useRole();
  const { t, locale, setLocale } = useTranslation();

  const siteIds = user?.siteIds ?? [];
  const permissions = user?.permissions ?? [];

  // Resolves the user's managed siteIds (business-key strings) to display names — the same
  // siteId -> name lookup pattern PunchesPage/EmployeeSitesPanel use. Scoped to the user's own
  // client and capped at a generous page size (v1) rather than a per-site fetch; only runs when
  // there's actually something to resolve.
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId: user?.clientId ?? "", pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId: user?.clientId ?? "", pageSize: 200 }),
    enabled: Boolean(user?.clientId) && siteIds.length > 0,
  });

  const siteNameBySiteId = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sitesQuery.data?.items ?? []) map.set(site.siteId, site.name);
    return map;
  }, [sitesQuery.data]);

  const profileQuery = useMyProfile();

  return (
    <>
      <PageHeader title={t("profile.title")} />

      <Card>
        <CardContent className="space-y-4">
          <dl className="space-y-4">
            <ProfileRow label={t("auth.email")}>{user?.email ?? "—"}</ProfileRow>

            <ProfileRow label={t("profile.role")}>{user ? t(`roles.${user.role}`) : "—"}</ProfileRow>

            {/* No client-name lookup is exposed to non-platform-admin roles in this app —
                clientsApi only exposes a `me` endpoint (the caller's own client), not a general
                id -> name directory a Site Manager/Client Admin could resolve another client's id
                from. clientId is shown as-is rather than inventing a lookup that doesn't exist. */}
            {user?.clientId ? <ProfileRow label={t("profile.client")}>{user.clientId}</ProfileRow> : null}

            <ProfileRow label={t("profile.managedSites")}>
              {siteIds.length === 0 ? (
                t("profile.noSitesAssigned")
              ) : sitesQuery.isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {siteIds.map((siteId) => (
                    <Badge key={siteId} variant="secondary">
                      {siteNameBySiteId.get(siteId) ?? siteId}
                    </Badge>
                  ))}
                </div>
              )}
            </ProfileRow>

            <ProfileRow label={t("profile.permissions")}>
              {permissions.length === 0 ? (
                t("profile.noPermissions")
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {permissions.map((key) => (
                    <Badge key={key} variant="outline">
                      {key}
                    </Badge>
                  ))}
                </div>
              )}
            </ProfileRow>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.language")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LOCALES.map((code) => (
            <Button
              key={code}
              type="button"
              variant={locale === code ? "default" : "outline"}
              size="sm"
              onClick={() => setLocale(code)}
            >
              {t(`language.${code}`)}
            </Button>
          ))}
        </CardContent>
      </Card>

      {profileQuery.isLoading || !profileQuery.data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <DateTimeFormatCard profile={profileQuery.data} />
      )}

      {/* Read-only by design below the preference cards above: TLM's usersApi (see resources.ts)
          is for admins managing OTHER users' accounts — there is no endpoint for a user to edit
          their own email/role/sites/permissions, so no edit form or button is offered for those. */}

      {/* Module-name customization is a client-wide (tenant) setting, not personal — only the
          roles that can actually edit it (see /profile/module-names) get the entry point here. */}
      {isClientAdmin || isPlatformAdmin ? (
        <Link href="/profile/module-names">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t("moduleNames.profileLinkTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("moduleNames.profileLinkDescription")}</p>
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </>
  );
}
