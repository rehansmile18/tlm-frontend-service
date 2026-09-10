"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { humanizeError } from "@/components/data-state";
import { useTranslation } from "@/lib/i18n/i18n";

/** Matches the import path's concurrency: quick enough to feel instant, gentle on the API. */
const CONCURRENCY = 4;

export interface BulkArchiveTarget {
  id: string;
  name: string;
}

interface Outcome {
  name: string;
  error?: string;
}

/**
 * Deletes several records at once.
 *
 * Bulk import can create hundreds of rows in one action while delete was one row at a time, so a
 * mistaken import left the same number of clicks to undo it. This closes that loop.
 *
 * Deliberately NOT a bulk endpoint: each record goes through the same per-record archive call,
 * which means every in-use guard still applies individually. A referenced record is refused on
 * its own without stopping the others, so the normal outcome of a bulk delete over a mixed
 * selection is partial — and the refusals are listed by name rather than collapsed into a count.
 */
export function BulkArchiveBar({
  targets,
  onArchive,
  invalidateKeys,
  onClear,
}: {
  targets: BulkArchiveTarget[];
  onArchive: (id: string) => Promise<unknown>;
  invalidateKeys: string[];
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<Outcome[]>([]);

  async function run() {
    setBusy(true);
    setRefused([]);
    const failures: Outcome[] = [];
    let cursor = 0;

    async function worker() {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        try {
          await onArchive(target.id);
        } catch (error) {
          failures.push({ name: target.name, error: humanizeError(error) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

    for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: [key] });
    queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
    setBusy(false);
    setConfirming(false);

    const done = targets.length - failures.length;
    if (failures.length === 0) {
      toast.success(t("common.bulkDeleted", { count: String(done) }));
      onClear();
    } else {
      // Kept on screen rather than toasted: the refusals name what is still referencing each
      // record, which is the part the user has to act on.
      setRefused(failures);
      if (done > 0) toast.warning(t("common.bulkPartial", { done: String(done), failed: String(failures.length) }));
      else toast.error(t("common.bulkNoneDeleted", { count: String(failures.length) }));
    }
  }

  if (targets.length === 0) return null;

  return (
    <div className="sticky bottom-4 z-10 space-y-2 rounded-lg border bg-popover p-3 shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t("common.selectedCount", { count: String(targets.length) })}</span>
        {confirming ? (
          <>
            <span className="text-sm text-muted-foreground">{t("common.bulkConfirm", { count: String(targets.length) })}</span>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={run}>
              {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              {t("common.confirmDelete")}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
            <Trash2Icon className="size-3.5" />
            {t("common.deleteSelected")}
          </Button>
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label={t("common.clearSelection")}
          className="ms-auto text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {refused.length > 0 ? (
        <ul className="max-h-32 space-y-1 overflow-y-auto border-t pt-2 text-xs">
          {refused.map((r) => (
            <li key={r.name}>
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground"> — {r.error}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
