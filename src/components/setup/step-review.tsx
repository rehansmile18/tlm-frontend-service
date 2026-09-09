"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDateFormat } from "@/lib/date-format";
import type { ReadinessReport } from "@/lib/resources";
import { useTranslation } from "@/lib/i18n/i18n";
import { SetupFindings } from "./setup-step-card";

/**
 * The go-live gate. Reads the same readiness report the rest of the page is driven by, so it
 * cannot disagree with the individual steps — and it is recomputed from the data on every load
 * rather than recording that someone once clicked "done".
 */
export function StepReview({ report, rulesReady }: { report: ReadinessReport; rulesReady: boolean }) {
  const { t } = useTranslation();
  const { formatDateTime } = useDateFormat();
  const router = useRouter();

  const blocking = report.steps.flatMap((s) => s.findings.filter((f) => f.severity === "blocked"));
  const attention = report.steps.flatMap((s) => s.findings.filter((f) => f.severity === "attention"));
  const ready = blocking.length === 0 && rulesReady;

  return (
    <div className="space-y-4">
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          ready ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30" : "border-destructive/40 bg-destructive/5"
        }`}
      >
        {ready ? (
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
        )}
        <div className="min-w-0">
          <p className="font-semibold">{ready ? t("setup.review.readyTitle") : t("setup.review.blockedTitle")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ready
              ? t("setup.review.readyBody")
              : t("setup.review.blockedBody", { count: String(blocking.length + (rulesReady ? 0 : 1)) })}
          </p>
        </div>
      </div>

      {!rulesReady ? (
        <div className="rounded-lg border-l-2 border-l-destructive bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">{t("setup.review.rulesMissing")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("setup.review.rulesMissingFix")}</p>
        </div>
      ) : null}

      <SetupFindings findings={blocking} />

      {attention.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
            {t("setup.review.attentionTitle")}
          </p>
          <p className="text-xs text-muted-foreground">{t("setup.review.attentionBody")}</p>
          <SetupFindings findings={attention} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {ready ? (
          <Button type="button" onClick={() => router.push("/processing")}>
            {t("setup.review.runProcessing")}
          </Button>
        ) : (
          <Button type="button" disabled>
            {t("setup.review.runProcessing")}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {t("setup.review.generatedAt", { at: formatDateTime(report.generatedAt) })}
        </span>
      </div>
    </div>
  );
}
