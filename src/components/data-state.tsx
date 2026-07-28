"use client";

import type { ReactNode } from "react";
import { AlertCircleIcon, InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useTranslation } from "@/lib/i18n/i18n";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <div className="text-muted-foreground">{icon ?? <InboxIcon className="size-8" />}</div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : t("common.somethingWentWrong");
  const status = error instanceof ApiError ? error.status : undefined;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertCircleIcon className="size-8 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium text-destructive">{t("common.couldntLoad")}</p>
        <p className="text-sm text-muted-foreground">
          {status ? `${status} · ` : ""}
          {message}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.tryAgain")}
        </Button>
      ) : null}
    </div>
  );
}

export function humanizeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
