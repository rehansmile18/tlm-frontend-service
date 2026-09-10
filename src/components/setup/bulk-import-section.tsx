"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckIcon, DownloadIcon, FileSpreadsheetIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { humanizeError } from "@/components/data-state";
import {
  ImportError,
  buildCsvTemplate,
  buildFailuresCsv,
  buildXlsxTemplate,
  downloadBlob,
  parseImportFile,
  type ColumnSpec,
  type ParsedSheet,
  type ReferenceList,
} from "@/lib/bulk-import";
import { useTranslation } from "@/lib/i18n/i18n";

/** How many creates run at once. Enough to be quick, low enough not to swamp the API. */
const CONCURRENCY = 4;

interface RowResult {
  index: number;
  row: Record<string, string>;
  label: string;
  status: "ok" | "failed";
  error?: string;
}

/**
 * Download-a-template, fill it in, import it — shared by every setup step that manages a list.
 *
 * Rows are created through the SAME per-record API the single-record form uses, one call each with
 * bounded concurrency, rather than through a bulk endpoint. That keeps every server-side
 * validation and tenancy check in force and gives a genuine per-row verdict, at the cost of one
 * request per row — fine at setup scale, and the reason the result list reports each row rather
 * than a single pass/fail.
 *
 * A partial import is the normal outcome, not an error: valid rows land, invalid ones come back as
 * a CSV with the reason appended so they can be fixed and re-imported.
 */
export function BulkImportSection<T>({
  entityKey,
  entityLabel,
  columns,
  templateName,
  toBody,
  labelOf,
  create,
  invalidateKeys,
  existingKeys = [],
  references = [],
}: {
  /** Used for the file input id and result keys. */
  entityKey: string;
  /** Already-translated name of what is being imported, e.g. "Sites". */
  entityLabel: string;
  columns: ColumnSpec[];
  templateName: string;
  /** Row -> API body. Throw an Error with a readable message to reject the row before any call. */
  toBody: (row: Record<string, string>) => T;
  /** How to name the row in the results list. */
  labelOf: (row: Record<string, string>) => string;
  create: (body: T) => Promise<unknown>;
  invalidateKeys: string[];
  /** Values that already exist, so a clash is caught in the preview instead of on the server. */
  existingKeys?: string[];
  /** Valid values written into the Excel template's Reference sheet. */
  references?: ReferenceList[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  // What the DISPLAYED results came from — reading `validateOnly` directly would relabel a real
  // import the moment the user ticked the box afterwards.
  const [checkedOnly, setCheckedOnly] = useState(false);
  const [progress, setProgress] = useState(0);
  // Checking without writing matters most where there is no undo: importing 200 wrong rows and
  // then discovering it leaves 200 records to archive one at a time.
  const [validateOnly, setValidateOnly] = useState(false);

  function reset() {
    setParsed(null);
    setFileName("");
    setParseError(null);
    setResults(null);
    setProgress(0);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const sheet = await parseImportFile(file, columns);
      if (sheet.rows.length === 0) {
        setParseError(t("setup.import.noRows"));
        return;
      }
      setParsed(sheet);
    } catch (error) {
      setParseError(error instanceof ImportError ? error.message : humanizeError(error));
    }
  }

  async function runImport(subset?: Record<string, string>[]) {
    if (!parsed) return;
    setBusy(true);
    setProgress(0);
    const rows = subset ?? parsed.rows;
    const existingSet = new Set(existingKeys);
    const collected: RowResult[] = new Array(rows.length);
    let cursor = 0;

    async function worker() {
      while (cursor < rows.length) {
        const index = cursor++;
        const row = rows[index];
        const label = labelOf(row) || `#${index + 2}`; // +2: header row, then 1-based
        try {
          // toBody throws for a row that is wrong on its face, so an obviously bad row costs no
          // round trip and reports the reason immediately.
          const body = toBody(row);
          if (validateOnly) {
            // A local check can only catch what is knowable without the server: required fields
            // and shapes via toBody, plus a clash with something that already exists. It cannot
            // catch server-side rules like whether a time zone is real, so the result is reported
            // as "would" rather than as a verdict.
            if (existingSet.has(label)) throw new Error(t("setup.import.wouldClash"));
            collected[index] = { index, row, label, status: "ok" };
          } else {
            await create(body);
            collected[index] = { index, row, label, status: "ok" };
          }
        } catch (error) {
          collected[index] = { index, row, label, status: "failed", error: humanizeError(error) };
        }
        setProgress((done) => done + 1);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

    setResults(collected);
    setCheckedOnly(validateOnly);
    setBusy(false);
    if (!validateOnly) {
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ["setup-readiness"] });
    }

    const ok = collected.filter((r) => r.status === "ok").length;
    const failed = collected.length - ok;
    if (validateOnly) {
      if (failed === 0) toast.success(t("setup.import.checkedClean", { count: String(ok) }));
      else toast.warning(t("setup.import.checkedProblems", { count: String(failed) }));
    } else if (failed === 0) toast.success(t("setup.import.allImported", { count: String(ok) }));
    else if (ok === 0) toast.error(t("setup.import.noneImported", { count: String(failed) }));
    else toast.warning(t("setup.import.partial", { ok: String(ok), failed: String(failed) }));
  }

  const failures = (results ?? []).filter((r) => r.status === "failed");

  // Two kinds of clash, both worth naming before any request is sent: a row that collides with a
  // record that already exists, and rows that collide with each other inside the same file.
  const existing = new Set(existingKeys);
  const seen = new Set<string>();
  const clashesExisting: string[] = [];
  const clashesInFile: string[] = [];
  for (const row of parsed?.rows ?? []) {
    const key = labelOf(row);
    if (!key) continue;
    if (existing.has(key)) clashesExisting.push(key);
    if (seen.has(key)) clashesInFile.push(key);
    seen.add(key);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <UploadIcon className="size-3.5" />
        {t("setup.import.open", { entity: entityLabel })}
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-start gap-2">
        <FileSpreadsheetIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("setup.import.title")}</p>
          <p className="text-xs text-muted-foreground">{t("setup.import.description")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label={t("common.cancel")}
          className="text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => downloadBlob(buildCsvTemplate(columns), `${templateName}.csv`)}>
          <DownloadIcon className="size-3.5" />
          {t("setup.import.templateCsv")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => downloadBlob(await buildXlsxTemplate(columns, templateName, references), `${templateName}.xlsx`)}
        >
          <DownloadIcon className="size-3.5" />
          {t("setup.import.templateXlsx")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("setup.import.templateHint")}</span>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`import-${entityKey}`}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-4 text-sm hover:bg-muted/60"
        >
          <UploadIcon className="size-4 text-muted-foreground" />
          {fileName || t("setup.import.choose")}
        </label>
        <input
          ref={fileInput}
          id={`import-${entityKey}`}
          type="file"
          className="sr-only"
          accept=".csv,.tsv,.psv,.txt,.xlsx,.xlsm,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">{t("setup.import.formats")}</p>
      </div>

      {parseError ? (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {parseError}
        </p>
      ) : null}

      {parsed && !results ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm font-medium">{t("setup.import.readyToImport", { count: String(parsed.rows.length) })}</p>
          {parsed.missingColumns.length > 0 ? (
            <p className="text-xs text-destructive">
              {t("setup.import.missingColumns", { columns: parsed.missingColumns.join(", ") })}
            </p>
          ) : null}
          {parsed.unknownHeaders.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("setup.import.unknownColumns", { columns: parsed.unknownHeaders.join(", ") })}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {columns.map((c) => (
                    <th key={c.key} className="px-2 py-1 font-medium whitespace-nowrap">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1 whitespace-nowrap">
                        {row[c.key] || <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 3 ? (
            <p className="text-xs text-muted-foreground">{t("setup.import.previewNote", { count: String(parsed.rows.length - 3) })}</p>
          ) : null}

          {clashesExisting.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("setup.import.clashExisting", {
                count: String(clashesExisting.length),
                names: clashesExisting.slice(0, 5).join(", "),
              })}
            </p>
          ) : null}
          {clashesInFile.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("setup.import.clashInFile", {
                count: String(clashesInFile.length),
                names: clashesInFile.slice(0, 5).join(", "),
              })}
            </p>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 rounded border-input accent-primary"
              checked={validateOnly}
              onChange={(e) => setValidateOnly(e.target.checked)}
            />
            {t("setup.import.validateOnly")}
          </label>

          <Button type="button" size="sm" disabled={busy || parsed.missingColumns.length > 0} onClick={() => runImport()}>
            {busy ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {busy
              ? t("setup.import.importing", { done: String(progress), total: String(parsed.rows.length) })
              : validateOnly
                ? t("setup.import.checkRows", { count: String(parsed.rows.length) })
                : t("setup.import.importRows", { count: String(parsed.rows.length) })}
          </Button>
        </div>
      ) : null}

      {results ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {t(checkedOnly ? "setup.import.checkSummary" : "setup.import.resultSummary", {
              ok: String(results.length - failures.length),
              failed: String(failures.length),
            })}
          </p>
          {checkedOnly ? <p className="text-xs text-muted-foreground">{t("setup.import.checkCaveat")}</p> : null}
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {results.map((r) => (
              <li key={r.index} className="flex items-start gap-1.5">
                {r.status === "ok" ? (
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                )}
                <span className="font-mono">{r.label}</span>
                {r.error ? <span className="text-muted-foreground">— {r.error}</span> : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {failures.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadBlob(
                    buildFailuresCsv(
                      columns,
                      failures.map((f) => ({ row: f.row, error: f.error ?? "" }))
                    ),
                    `${templateName}-errors.csv`
                  )
                }
              >
                <DownloadIcon className="size-3.5" />
                {t("setup.import.downloadFailures", { count: String(failures.length) })}
              </Button>
            ) : null}
            {failures.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  // Re-runs just the failures, so fixing a transient problem does not mean
                  // re-uploading the whole file and re-creating everything that already worked.
                  setValidateOnly(false);
                  runImport(failures.map((f) => f.row));
                }}
              >
                {t("setup.import.retryFailed", { count: String(failures.length) })}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              {t("setup.import.importAnother")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
