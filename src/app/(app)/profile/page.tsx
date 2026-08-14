"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { humanizeError } from "@/components/data-state";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { initialsFromEmail } from "@/components/app-shell/sidebar";
import { AvatarImageError, validateImageFile } from "@/lib/avatar";
import {
  authApi,
  sitesApi,
  CALENDAR_FORMATS,
  TIME_FORMATS,
  type CalendarFormat,
  type TimeFormat,
  type MeResult,
  type UpdateProfileBody,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useMyProfile } from "@/lib/hooks";
import { useAuth, useRole } from "@/lib/auth";
import { LOCALES, useTranslation, type Locale } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";

// A blank Combobox value represents "unset" (server-side null: no personal preference, or no
// name/username/mobile on file) — the same sentinel convention used elsewhere in the app.
const UNSET = "";

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function PhotoCard({ profile }: { profile: MeResult }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (avatarUrl: string | null) => authApi.updateAvatar(avatarUrl),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.myProfile, updated);
      toast.success(t("profile.toastPhotoUpdated"));
      setPendingFile(null);
    },
    onError: (error) => toast.error(t("profile.couldntUpdatePhoto"), { description: humanizeError(error) }),
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again later
    if (!file) return;
    try {
      validateImageFile(file);
      setPendingFile(file);
    } catch (error) {
      toast.error(t("profile.invalidImageFile"), { description: error instanceof AvatarImageError ? error.message : undefined });
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.photoTitle")}</CardTitle>
          <CardDescription>{t("profile.photoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <UserAvatar avatarUrl={profile.avatarUrl} initials={initialsFromEmail(profile.email)} className="size-16 text-lg" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={mutation.isPending} onClick={() => fileInputRef.current?.click()}>
                {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t("profile.uploadPhoto")}
              </Button>
              {profile.avatarUrl ? (
                <Button type="button" variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate(null)}>
                  {t("profile.removePhoto")}
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">{t("profile.photoHint")}</p>
          </div>
        </CardContent>
      </Card>
      <AvatarCropDialog
        file={pendingFile}
        isSaving={mutation.isPending}
        onCancel={() => setPendingFile(null)}
        onConfirm={(dataUrl) => mutation.mutate(dataUrl)}
      />
    </>
  );
}

function AccountSummaryCard({ profile }: { profile: MeResult }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatDate } = useDateFormat();
  const siteIds = user?.siteIds ?? [];
  const permissions = user?.permissions ?? [];
  const clientId = user?.clientId ?? "";

  // Resolves the user's managed siteIds (business-key strings) to display names — the same
  // siteId -> name lookup pattern PunchesPage/EmployeeSitesPanel use. Scoped to the user's own
  // client and capped at a generous page size (v1) rather than a per-site fetch; only runs when
  // there's actually something to resolve.
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId) && siteIds.length > 0,
  });

  const siteNameBySiteId = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sitesQuery.data?.items ?? []) map.set(site.siteId, site.name);
    return map;
  }, [sitesQuery.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.accountTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-4">
          <ProfileRow label={t("auth.email")}>{profile.email}</ProfileRow>
          <ProfileRow label={t("profile.role")}>{user ? t(`roles.${user.role}`) : "—"}</ProfileRow>
          {/* No client-name lookup is exposed to non-platform-admin roles in this app — clientsApi
              only exposes a `me` endpoint (the caller's own client), not a general id -> name
              directory. clientId is shown as-is rather than inventing a lookup that doesn't exist. */}
          {clientId ? <ProfileRow label={t("profile.client")}>{clientId}</ProfileRow> : null}
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
          <ProfileRow label={t("profile.memberSince")}>{formatDate(profile.createdAt)}</ProfileRow>
        </dl>
      </CardContent>
    </Card>
  );
}

function AccountDetailsCard({ profile }: { profile: MeResult }) {
  const { t, setLocale } = useTranslation();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [mobile, setMobile] = useState(profile.mobile ?? "");
  const [language, setLanguage] = useState<string>(profile.preferredLanguage ?? UNSET);
  const [dateFormat, setDateFormat] = useState<string>(profile.preferredDateFormat ?? UNSET);
  const [timeFormat, setTimeFormat] = useState<string>(profile.preferredTimeFormat ?? UNSET);

  const mutation = useMutation({
    mutationFn: () => {
      const body: UpdateProfileBody = {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        username: username.trim() || null,
        mobile: mobile.trim() || null,
        preferredLanguage: (language || null) as Locale | null,
        preferredDateFormat: (dateFormat || null) as CalendarFormat | null,
        preferredTimeFormat: (timeFormat || null) as TimeFormat | null,
      };
      return authApi.updateMe(body);
    },
    onSuccess: (updated) => {
      // Applies immediately for this session (language switches right away; every date/time on
      // screen re-renders in the new format) in addition to persisting for every future login.
      queryClient.setQueryData(queryKeys.myProfile, updated);
      if (updated.preferredLanguage) setLocale(updated.preferredLanguage);
      toast.success(t("profile.toastDetailsSaved"));
    },
    onError: (error) => toast.error(t("profile.couldntSaveDetails"), { description: humanizeError(error) }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.detailsTitle")}</CardTitle>
          <CardDescription>{t("profile.detailsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t("profile.firstName")}</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t("profile.lastName")}</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("profile.username")}</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("profile.usernameHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">{t("profile.mobile")}</Label>
            <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("profile.mobileHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferredLanguage">{t("profile.language")}</Label>
            <Combobox id="preferredLanguage" value={language} onValueChange={setLanguage}>
              <ComboboxItem value={UNSET}>{t("profile.languageNoPreference")}</ComboboxItem>
              {LOCALES.map((code) => (
                <ComboboxItem key={code} value={code}>
                  {t(`language.${code}`)}
                </ComboboxItem>
              ))}
            </Combobox>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferredDateFormat">{t("profile.dateFormat")}</Label>
            <Combobox id="preferredDateFormat" value={dateFormat} onValueChange={setDateFormat}>
              <ComboboxItem value={UNSET}>{t("profile.useClientDefault")}</ComboboxItem>
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
              <ComboboxItem value={UNSET}>{t("profile.useClientDefault")}</ComboboxItem>
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

function PasswordCard() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success(t("profile.toastPasswordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(t("profile.couldntChangePassword"), { description: humanizeError(error) }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentPassword) return toast.error(t("profile.currentPasswordRequired"));
    if (newPassword.length < 8) return toast.error(t("profile.newPasswordMinLength"));
    if (newPassword !== confirmPassword) return toast.error(t("profile.passwordMismatch"));
    mutation.mutate();
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.passwordTitle")}</CardTitle>
          <CardDescription>{t("profile.passwordDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmNewPassword">{t("profile.confirmNewPassword")}</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" variant="outline" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t("profile.changePassword")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default function ProfilePage() {
  const { isClientAdmin, isPlatformAdmin } = useRole();
  const { t } = useTranslation();
  const profileQuery = useMyProfile();

  return (
    <>
      <PageHeader title={t("profile.title")} />

      {profileQuery.isLoading || !profileQuery.data ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <PhotoCard profile={profileQuery.data} />
          <AccountSummaryCard profile={profileQuery.data} />
          <AccountDetailsCard key={profileQuery.dataUpdatedAt} profile={profileQuery.data} />
          <PasswordCard />
        </>
      )}

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
