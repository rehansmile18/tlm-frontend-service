"use client";

import Link from "next/link";
import { ArrowUpRightIcon, CircleAlertIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n/i18n";

export interface InventoryRow {
  /** Already-translated label, e.g. "Sites". */
  label: string;
  count: number;
  /** A few names, so the row says WHICH ones rather than only how many. */
  examples: string[];
  /** Where the full list lives. */
  href?: string;
  /** Rows that must be non-empty before payroll can run are called out when they are. */
  required?: boolean;
}

/**
 * What a client already has, shown before any wizard step.
 *
 * A client is set up more than once — sites and employees arrive in batches, rules change as they
 * open in a new state — so the page has to answer "what is already here?" before it asks "what do
 * you want to add?". Previously it opened straight into six collapsed steps, which reads as
 * first-time setup every time and hides the fact that most of the work is already done.
 *
 * Counts are derived from the same queries the steps use, so the inventory cannot disagree with
 * what a step shows when opened.
 */
export function SetupInventory({
  rows,
  loading,
  blockerCount,
  stepsOpen,
  onNewSetup,
}: {
  rows: InventoryRow[];
  loading: boolean;
  /** Blocking findings across every step; when non-zero the steps are shown regardless. */
  blockerCount: number;
  stepsOpen: boolean;
  onNewSetup: () => void;
}) {
  const { t } = useTranslation();
  const configuredCount = rows.filter((r) => r.count > 0).length;
  const nothingYet = configuredCount === 0;

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{nothingYet ? t("setup.inventory.emptyTitle") : t("setup.inventory.title")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {nothingYet ? t("setup.inventory.emptyBody") : t("setup.inventory.body")}
            </p>
          </div>
          {!stepsOpen ? (
            <Button type="button" onClick={onNewSetup}>
              <PlusIcon className="size-4" />
              {t("setup.inventory.newSetup")}
            </Button>
          ) : null}
        </div>

        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : nothingYet ? null : (
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li key={row.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="w-32 shrink-0 font-medium">{row.label}</span>
                <span className="w-10 shrink-0 text-end tabular-nums font-semibold">{row.count}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {row.count === 0 ? (
                    // A required row at zero is the whole reason the steps below exist, so it is
                    // named here rather than only inside a collapsed step.
                    <span className={row.required ? "text-destructive" : undefined}>
                      {row.required ? t("setup.inventory.requiredMissing") : t("setup.inventory.noneYet")}
                    </span>
                  ) : (
                    row.examples.slice(0, 3).join(", ") +
                    (row.count > 3 ? t("setup.inventory.andMore", { count: String(row.count - 3) }) : "")
                  )}
                </span>
                {row.href ? (
                  <Link
                    href={row.href}
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("setup.inventory.openList")}
                    <ArrowUpRightIcon className="size-3" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {blockerCount > 0 ? (
          <p className="flex items-start gap-1.5 text-sm text-destructive">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
            {t("setup.inventory.blockers", { count: String(blockerCount) })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
