"use client";

import { CheckIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What already exists for this step, shown above its create form.
 *
 * Setup is rarely started from nothing — an admin returning to finish a half-done configuration
 * needs to see what is already there before being asked to add more, or they will duplicate it.
 */
export function ExistingList({
  loading,
  items,
  emptyText,
}: {
  loading: boolean;
  items: { id: string; primary: string; secondary?: string }[];
  emptyText: string;
}) {
  if (loading) return <Skeleton className="h-16 w-full" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 truncate font-medium">{item.primary}</span>
          {item.secondary ? (
            <span className="shrink-0 text-xs text-muted-foreground">{item.secondary}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
