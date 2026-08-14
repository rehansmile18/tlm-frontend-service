"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useTranslation, type TranslationKey } from "@/lib/i18n/i18n";
import { useDateFormat } from "@/lib/date-format";
import { formatDuration } from "@/lib/format";

interface HourBuckets {
  regularMinutes: number;
  otMinutes: number;
  dtMinutes: number;
}

interface RateInfo {
  rateType: "hourly" | "salary";
  baseRate: number;
  minimumWage: number;
}

interface EngineState {
  hourBuckets?: HourBuckets;
  rate?: RateInfo;
  violations?: { code: string }[];
}

// The backend's audit-trail entries are intentionally untyped (`unknown[]`) — this is what a
// ProcessingAuditEntry actually looks like in practice (see tlm-punch-processor's
// processingAudit.model.ts), used here only to read fields defensively, not as a strict contract.
interface AuditEntry {
  sequenceIndex: number;
  policyType: string;
  humanReadableSummary: string;
  businessDate?: string | null;
  sourceAssignment?: { targetType?: string; priority?: number };
  inputState?: EngineState;
  outputState?: EngineState;
}

function asAuditEntry(entry: unknown): AuditEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.humanReadableSummary !== "string" || typeof e.policyType !== "string") return null;
  return entry as AuditEntry;
}

/** A short list of "what actually changed" lines derived from a step's before/after engine state — the
 * readable alternative to dumping the full input/output state for every step. */
function diffLines(t: (key: TranslationKey, params?: Record<string, string | number>) => string, before?: EngineState, after?: EngineState): string[] {
  const lines: string[] = [];
  if (before?.hourBuckets && after?.hourBuckets) {
    if (before.hourBuckets.regularMinutes !== after.hourBuckets.regularMinutes) {
      lines.push(`${t("timesheets.regularHours")}: ${formatDuration(before.hourBuckets.regularMinutes)} → ${formatDuration(after.hourBuckets.regularMinutes)}`);
    }
    if (before.hourBuckets.otMinutes !== after.hourBuckets.otMinutes) {
      lines.push(`${t("timesheets.overtimeHours")}: ${formatDuration(before.hourBuckets.otMinutes)} → ${formatDuration(after.hourBuckets.otMinutes)}`);
    }
    if (before.hourBuckets.dtMinutes !== after.hourBuckets.dtMinutes) {
      lines.push(`${t("timesheets.doubleTimeHours")}: ${formatDuration(before.hourBuckets.dtMinutes)} → ${formatDuration(after.hourBuckets.dtMinutes)}`);
    }
  }
  if (after?.rate && (!before?.rate || before.rate.baseRate !== after.rate.baseRate || before.rate.rateType !== after.rate.rateType)) {
    const rateTypeLabel = t(`timesheets.rateTypeOptions.${after.rate.rateType}`);
    lines.push(`${t("timesheets.rateSet")}: ${rateTypeLabel} @ ${after.rate.baseRate.toFixed(2)}`);
  }
  const beforeViolations = before?.violations?.length ?? 0;
  const afterViolations = after?.violations?.length ?? 0;
  if (afterViolations > beforeViolations) {
    const newCodes = (after?.violations ?? []).slice(beforeViolations).map((v) => v.code);
    lines.push(`${t("timesheets.newViolations")}: ${newCodes.join(", ")}`);
  }
  return lines;
}

function AuditStep({ entry, stepNumber }: { entry: AuditEntry; stepNumber: number }) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const changes = diffLines(t, entry.inputState, entry.outputState);

  return (
    <div className="rounded-lg border border-input p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="info">
          {t("timesheets.step")} {stepNumber}
        </StatusBadge>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{entry.policyType}</span>
        {entry.sourceAssignment?.targetType ? (
          <span className="text-xs text-muted-foreground">
            {t("timesheets.via")} {entry.sourceAssignment.targetType}
            {entry.sourceAssignment.priority !== undefined ? ` · priority ${entry.sourceAssignment.priority}` : ""}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm">{entry.humanReadableSummary}</p>

      {changes.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {changes.map((line, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {showRaw ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        {showRaw ? t("timesheets.hideRawData") : t("timesheets.showRawData")}
      </button>
      {showRaw ? (
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
          {JSON.stringify({ input: entry.inputState, output: entry.outputState }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/**
 * One section per business date, one numbered step per policy the engine actually applied —
 * grouping and numbering make it legible to scan a whole multi-day timesheet's processing
 * history at a glance, instead of a flat list of raw JSON blobs.
 */
export function AuditTrailTimeline({ entries }: { entries: unknown[] }) {
  const { formatDate } = useDateFormat();
  const parsed = entries.map(asAuditEntry).filter((e): e is AuditEntry => e !== null);
  const dateGroups = new Map<string, AuditEntry[]>();
  for (const entry of parsed) {
    const key = entry.businessDate ?? "";
    const list = dateGroups.get(key);
    if (list) list.push(entry);
    else dateGroups.set(key, [entry]);
  }

  return (
    <div className="space-y-5">
      {[...dateGroups.entries()].map(([businessDate, groupEntries]) => (
        <div key={businessDate || "unknown"} className="space-y-2">
          {businessDate ? <h4 className="text-sm font-semibold">{formatDate(businessDate)}</h4> : null}
          <div className="space-y-2">
            {groupEntries.map((entry, i) => (
              <AuditStep key={`${businessDate}-${entry.sequenceIndex}`} entry={entry} stepNumber={i + 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
