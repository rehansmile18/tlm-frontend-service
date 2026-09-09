"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { humanizeError } from "@/components/data-state";
import type { BadgeTone } from "@/lib/format";
import type { ResourceStatus } from "@/lib/resources";
import { useTranslation } from "@/lib/i18n/i18n";

const STATUS_TONE: Record<ResourceStatus, BadgeTone> = {
  active: "success",
  inactive: "warning",
  archived: "muted",
};

/**
 * A record's status. Rendered for every master-data list so a paused record is distinguishable at
 * a glance from a live one — previously nothing on screen said which was which.
 *
 * `undefined` is treated as active: records created before the status field exists have no such
 * property, and showing them as blank or unknown would be misleading about a record that is
 * perfectly usable.
 */
export function ResourceStatusBadge({ status }: { status: ResourceStatus | undefined }) {
  const { t } = useTranslation();
  const effective: ResourceStatus = status ?? "active";
  return <StatusBadge tone={STATUS_TONE[effective]}>{t(`status.${effective}`)}</StatusBadge>;
}

/**
 * Delete, which archives rather than removes.
 *
 * Payroll has to be able to explain a past period using the configuration in force at the time,
 * so nothing is destroyed — the record leaves the list but stays resolvable for anything that
 * already references it.
 *
 * The server refuses while anything still points at the record, and names what. That refusal is
 * the normal answer for a record in use rather than an error, so it is shown inline and stays
 * put, instead of as a toast that vanishes before it can be read.
 *
 * `stopPropagation` throughout: these rows are themselves click targets that navigate to a detail
 * page, and a delete that also navigated away would hide its own result.
 */
export function ArchiveAction({
  name,
  onArchive,
  invalidateKeys,
  disabled,
}: {
  /** Named in the confirmation and the accessible label, so it is clear what is going. */
  name: string;
  onArchive: () => Promise<unknown>;
  invalidateKeys: string[];
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const archive = useMutation({
    mutationFn: onArchive,
    onSuccess: () => {
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
      setConfirming(false);
      setRefusal(null);
      toast.success(t("common.deleted", { name }));
    },
    onError: (error) => {
      setRefusal(humanizeError(error));
      setConfirming(false);
    },
  });

  if (refusal) {
    return (
      <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="max-w-xs text-xs text-destructive">{refusal}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRefusal(null)}>
          {t("common.dismiss")}
        </Button>
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button type="button" size="sm" variant="destructive" disabled={archive.isPending} onClick={() => archive.mutate()}>
          {archive.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          {t("common.confirmDelete")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          {t("common.cancel")}
        </Button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={t("common.deleteAria", { name })}
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
    >
      <Trash2Icon className="size-4" />
    </button>
  );
}
