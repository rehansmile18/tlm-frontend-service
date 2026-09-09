"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, PauseIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { humanizeError } from "@/components/data-state";
import type { ResourceStatus } from "@/lib/resources";
import { useTranslation } from "@/lib/i18n/i18n";

export interface ExistingItem {
  id: string;
  primary: string;
  secondary?: string;
  status?: ResourceStatus;
}

/**
 * What already exists for this step, with a delete action per row.
 *
 * Setup is rarely started from nothing — an admin returning to finish a half-done configuration
 * needs to see what is already there before being asked to add more, or they will duplicate it.
 *
 * "Delete" archives rather than removes: payroll has to be able to explain a past period using
 * the configuration in force at the time. The server refuses while anything still references the
 * record, and that refusal names what is holding it — so it is surfaced inline next to the row
 * rather than as a toast that disappears before it can be read.
 */
export function ExistingList({
  loading,
  items,
  emptyText,
  onArchive,
  invalidateKeys,
}: {
  loading: boolean;
  items: ExistingItem[];
  emptyText: string;
  /** Omit to render a read-only list. */
  onArchive?: (id: string) => Promise<unknown>;
  invalidateKeys?: string[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<{ id: string; reason: string } | null>(null);

  const archive = useMutation({
    mutationFn: (id: string) => onArchive!(id),
    onSuccess: () => {
      for (const key of invalidateKeys ?? []) queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
      setConfirming(null);
      setBlockedBy(null);
      toast.success(t("setup.list.deleted"));
    },
    onError: (error, id) => {
      // A refusal is the expected answer for anything in use, not a fault — it stays pinned to
      // the row so the user can read which references are blocking them.
      setBlockedBy({ id, reason: humanizeError(error) });
      setConfirming(null);
    },
  });

  if (loading) return <Skeleton className="h-16 w-full" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => {
        const inactive = item.status === "inactive";
        return (
          <li key={item.id} className="px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              {inactive ? (
                <PauseIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className={`min-w-0 flex-1 truncate font-medium ${inactive ? "text-muted-foreground" : ""}`}>
                {item.primary}
                {inactive ? <span className="ms-2 text-xs font-normal">{t("setup.list.inactive")}</span> : null}
              </span>
              {item.secondary ? <span className="shrink-0 text-xs text-muted-foreground">{item.secondary}</span> : null}

              {onArchive ? (
                confirming === item.id ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("setup.list.confirmDelete")}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={archive.isPending}
                      onClick={() => archive.mutate(item.id)}
                    >
                      {archive.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                      {t("setup.list.confirmYes")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      {t("common.cancel")}
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={t("setup.list.deleteAria", { name: item.primary })}
                    onClick={() => {
                      setConfirming(item.id);
                      setBlockedBy(null);
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                )
              ) : null}
            </div>

            {blockedBy?.id === item.id ? (
              <p className="mt-1.5 rounded-md border-l-2 border-l-destructive bg-muted/50 px-2 py-1.5 text-xs text-foreground">
                {blockedBy.reason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
