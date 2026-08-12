"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { humanizeError } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import {
  permissionsApi,
  sitesApi,
  usersApi,
  type CreateUserBody,
  type UpdateUserBody,
  type UserRecord,
} from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation, type TranslationKey } from "@/lib/i18n/i18n";

const ROLE_VALUES = ["PLATFORM_ADMIN", "CLIENT_ADMIN", "SITE_MANAGER", "VIEWER"] as const;
type RoleValue = (typeof ROLE_VALUES)[number];

// `isEdit` only gates the superRefine rules below (password required on create, email/status
// aren't part of this schema at all — they're handled outside it, see the form below). The
// schema's static shape/type never changes across create vs edit, only which issues can fire.
function buildUserFormSchema(isEdit: boolean) {
  return z
    .object({
      email: z.string().min(1).email(),
      password: z.string().optional(),
      role: z.enum(ROLE_VALUES),
      siteIds: z.array(z.string()),
      status: z.enum(["active", "disabled"]),
      permissions: z.array(z.string()),
    })
    .superRefine((values, ctx) => {
      if (!isEdit && (values.password ?? "").length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must be at least 8 characters.",
        });
      }
      if (values.role === "SITE_MANAGER" && values.siteIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["siteIds"],
          message: "At least one site is required for the Site Manager role.",
        });
      }
    });
}

type UserFormValues = z.infer<ReturnType<typeof buildUserFormSchema>>;

function UserForm({ targetUser, onDone }: { targetUser?: UserRecord; onDone: () => void }) {
  const isEdit = Boolean(targetUser);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { clientId, picker: clientPicker } = useEditableClientId(targetUser?.clientId);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(buildUserFormSchema(isEdit)),
    defaultValues: {
      email: targetUser?.email ?? "",
      password: "",
      // `role`/`status` come back as plain `string` over the wire (resources.ts doesn't know
      // about this form's stricter unions) — TLM is the sole issuer of both fields and only ever
      // emits one of the known values, so this is a safe narrowing, not a real cast.
      role: (targetUser?.role as RoleValue) ?? "VIEWER",
      siteIds: targetUser?.siteIds ?? [],
      status: (targetUser?.status as "active" | "disabled") ?? "active",
      permissions: targetUser?.permissions ?? [],
    },
  });

  const role = watch("role");

  const sitesQuery = useQuery({
    queryKey: queryKeys.sites({ clientId, pageSize: 200 }),
    queryFn: () => sitesApi.list({ clientId, pageSize: 200 }),
    enabled: Boolean(clientId) && role === "SITE_MANAGER",
  });

  // Reference data (the set of permission keys and their per-role recommended defaults) — it
  // doesn't change within a session, so this is fetched once and never refetched.
  const catalogQuery = useQuery({
    queryKey: queryKeys.permissionsCatalog,
    queryFn: () => permissionsApi.catalog(),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      // Clearing siteIds when the role isn't Site Manager avoids leaving a stale site grant
      // behind on a user who's since been moved to a different role.
      const siteIds = values.role === "SITE_MANAGER" ? values.siteIds : [];
      if (isEdit && targetUser) {
        // No email/password here: UpdateUserBody doesn't carry either field (TLM's PATCH
        // /users/:id doesn't support changing them), and clientId isn't editable from this
        // dialog yet (see the TODO above), so only the fields that can actually change go out.
        const body: UpdateUserBody = {
          role: values.role,
          siteIds,
          permissions: values.permissions,
          status: values.status,
        };
        return usersApi.update(targetUser._id, body);
      }
      // No status here: CreateUserBody has no status field — a new user is always created active.
      const body: CreateUserBody = {
        email: values.email,
        password: values.password ?? "",
        role: values.role,
        clientId: clientId || undefined,
        siteIds,
        permissions: values.permissions,
      };
      return usersApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t("team.updated") : t("team.created"));
      // Loose prefix invalidation: matches every ["users", ...params] list query, not just
      // whichever params the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.user(saved._id) });
      onDone();
    },
    onError: (error) => {
      toast.error(isEdit ? t("team.couldntUpdate") : t("team.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  function onSubmit(values: UserFormValues) {
    if (!clientId) {
      toast.error(t("team.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  function applyRecommended() {
    const defaults = catalogQuery.data?.recommendedDefaults[role] ?? [];
    setValue("permissions", defaults, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="space-y-1.5">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              id="email"
              type="email"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isEdit}
              aria-invalid={Boolean(errors.email)}
            />
          )}
        />
        {isEdit ? <p className="text-xs text-muted-foreground">Can’t be changed after the account is created.</p> : null}
        {errors.email ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      {!isEdit ? (
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.password)}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
          {errors.password ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role">{t("team.role")}</Label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Combobox id="role" value={field.value} onValueChange={field.onChange}>
                {ROLE_VALUES.map((value) => (
                  <ComboboxItem key={value} value={value}>
                    {t(`roles.${value}` as TranslationKey)}
                  </ComboboxItem>
                ))}
              </Combobox>
            )}
          />
        </div>

        {isEdit ? (
          <div className="space-y-1.5">
            <Label htmlFor="status">{t("team.status")}</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Combobox id="status" value={field.value} onValueChange={field.onChange}>
                  <ComboboxItem value="active">{t("team.statusOptions.active")}</ComboboxItem>
                  <ComboboxItem value="disabled">{t("team.statusOptions.disabled")}</ComboboxItem>
                </Combobox>
              )}
            />
          </div>
        ) : null}
      </div>

      {role === "SITE_MANAGER" ? (
        <div className="space-y-1.5">
          <Label>{t("team.managedSites")}</Label>
          <p className="text-xs text-muted-foreground">{t("team.managedSitesHint")}</p>
          <Controller
            control={control}
            name="siteIds"
            render={({ field }) => (
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-2">
                {sitesQuery.isLoading ? (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">{t("common.loading")}</p>
                ) : (sitesQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">{t("common.nothingToShow")}</p>
                ) : (
                  (sitesQuery.data?.items ?? []).map((site) => {
                    const checked = field.value.includes(site.siteId);
                    return (
                      <label
                        key={site._id}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-input accent-primary"
                          checked={checked}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, site.siteId]
                                : field.value.filter((id) => id !== site.siteId)
                            )
                          }
                        />
                        <span>{site.name}</span>
                        <span className="text-xs text-muted-foreground">({site.siteId})</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          />
          {errors.siteIds ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("team.permissions")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={applyRecommended} disabled={!catalogQuery.data}>
            {t("team.applyRecommended")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("team.permissionsHint")}</p>
        <Controller
          control={control}
          name="permissions"
          render={({ field }) => (
            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border p-2">
              {catalogQuery.isLoading ? (
                <p className="px-1.5 py-1 text-xs text-muted-foreground">{t("common.loading")}</p>
              ) : (catalogQuery.data?.keys.length ?? 0) === 0 ? (
                <p className="px-1.5 py-1 text-xs text-muted-foreground">{t("common.nothingToShow")}</p>
              ) : (
                (catalogQuery.data?.keys ?? []).map(({ key, description }) => {
                  const checked = field.value.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-input accent-primary"
                        checked={checked}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked ? [...field.value, key] : field.value.filter((k) => k !== key)
                          )
                        }
                      />
                      <span className="flex flex-col">
                        <code className="text-xs font-medium">{key}</code>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {isEdit ? t("common.saveChanges") : t("common.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserRecord;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? t("team.editUser") : t("team.newUser")}</DialogTitle>
          <DialogDescription>{user ? t("team.editUserDescription") : t("team.newUserDescription")}</DialogDescription>
        </DialogHeader>
        {open ? <UserForm key={user?._id ?? "new"} targetUser={user} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
