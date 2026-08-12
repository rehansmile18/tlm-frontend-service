"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { humanizeError } from "@/components/data-state";
import { useEditableClientId } from "@/components/client-picker-field";
import { sitesApi, type CreateSiteBody, type Site, type UpdateSiteBody } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const siteFormSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

function SiteForm({ site, onDone }: { site?: Site; onDone: () => void }) {
  const isEdit = Boolean(site);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { clientId, picker: clientPicker } = useEditableClientId(site?.clientId);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      siteId: site?.siteId ?? "",
      name: site?.name ?? "",
      timezone: site?.timezone ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: SiteFormValues) => {
      if (isEdit && site) {
        const body: UpdateSiteBody = { siteId: values.siteId, name: values.name, timezone: values.timezone };
        return sitesApi.update(site._id, body);
      }
      const body: CreateSiteBody = { clientId, siteId: values.siteId, name: values.name, timezone: values.timezone };
      return sitesApi.create(body);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t("sites.updated") : t("sites.created"));
      // Loose prefix invalidation: matches every ["sites", ...params] list query, not just
      // whichever params the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.site(saved._id) });
      onDone();
    },
    onError: (error) => {
      toast.error(isEdit ? t("sites.couldntUpdate") : t("sites.couldntCreate"), {
        description: humanizeError(error),
      });
    },
  });

  function onSubmit(values: SiteFormValues) {
    if (!clientId) {
      toast.error(t("sites.couldntCreate"));
      return;
    }
    mutation.mutate(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {clientPicker}

      <div className="space-y-1.5">
        <Label htmlFor="siteId">{t("sites.siteId")}</Label>
        <Controller
          control={control}
          name="siteId"
          render={({ field }) => (
            <Input
              id="siteId"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.siteId)}
            />
          )}
        />
        {errors.siteId ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">{t("sites.name")}</Label>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              id="name"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.name)}
            />
          )}
        />
        {errors.name ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">{t("sites.timezone")}</Label>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Input
              id="timezone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="America/Los_Angeles"
              aria-invalid={Boolean(errors.timezone)}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">{t("sites.timezoneHint")}</p>
        {errors.timezone ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
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

export function SiteFormDialog({
  open,
  onOpenChange,
  site,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Site;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{site ? t("sites.editSite") : t("sites.newSite")}</DialogTitle>
          <DialogDescription>{site ? t("sites.editSiteDescription") : t("sites.newSiteDescription")}</DialogDescription>
        </DialogHeader>
        {open ? <SiteForm key={site?._id ?? "new"} site={site} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
