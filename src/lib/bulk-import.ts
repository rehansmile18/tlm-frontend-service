/**
 * Spreadsheet parsing and template generation for the guided setup's bulk import.
 *
 * On library choice: the obvious pick is SheetJS, which reads every format including legacy .xls.
 * The version published to npm is permanently stuck at 0.18.5 — SheetJS moved distribution to
 * their own CDN — and that version carries two HIGH advisories, prototype pollution (fixed 0.19.3)
 * and ReDoS (fixed 0.20.2). Parsing a file someone was handed by a third party is precisely where
 * prototype pollution matters, so this uses maintained registry packages instead: exceljs for
 * .xlsx and papaparse for delimited text.
 *
 * The cost is legacy .xls (the pre-2007 BIFF format), which exceljs cannot read and which in
 * practice only SheetJS handles. Such a file is rejected with a message telling the user to save
 * it as .xlsx or CSV, rather than failing obscurely.
 *
 * Both parsers are imported dynamically: they are large, and nobody pays for them unless they
 * actually open an import panel.
 */

export type ImportFormat = "xlsx" | "csv" | "tsv" | "psv" | "ssv" | "delimited";

export interface ColumnSpec {
  /** Key on the parsed row object, and the canonical template header. */
  key: string;
  /** Header text written into the template. */
  header: string;
  required?: boolean;
  /** Shown in the sample row so the expected shape is obvious. */
  example: string;
  /** Extra header spellings accepted on import, beyond the canonical one. */
  aliases?: string[];
  hint?: string;
}

export interface ParsedSheet {
  /** Row objects keyed by ColumnSpec.key, with values trimmed. */
  rows: Record<string, string>[];
  /** Headers found in the file that matched no column — surfaced, not silently dropped. */
  unknownHeaders: string[];
  /** Required columns entirely absent from the file. */
  missingColumns: string[];
}

export class ImportError extends Error {}

const LEGACY_XLS_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0]; // OLE2 compound document

/** Normalizes a header for matching: case, spaces, underscores and punctuation all collapse. */
function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-.]+/g, "");
}

function buildHeaderIndex(columns: ColumnSpec[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const col of columns) {
    index.set(normalizeHeader(col.header), col.key);
    index.set(normalizeHeader(col.key), col.key);
    for (const alias of col.aliases ?? []) index.set(normalizeHeader(alias), col.key);
  }
  return index;
}

/**
 * Picks the delimiter by counting candidates in the header line rather than trusting the file
 * extension — a ".csv" exported from a European locale is very often semicolon-delimited, and a
 * pipe file is frequently named ".txt".
 */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const candidates = [",", "\t", "|", ";"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : ",";
}

function toRows(
  rawRows: Record<string, unknown>[],
  headers: string[],
  columns: ColumnSpec[]
): ParsedSheet {
  const headerIndex = buildHeaderIndex(columns);
  const mapped = new Map<string, string>(); // file header -> column key
  const unknownHeaders: string[] = [];

  for (const header of headers) {
    if (!header?.trim()) continue;
    const key = headerIndex.get(normalizeHeader(header));
    if (key) mapped.set(header, key);
    else unknownHeaders.push(header.trim());
  }

  const presentKeys = new Set(mapped.values());
  const missingColumns = columns.filter((c) => c.required && !presentKeys.has(c.key)).map((c) => c.header);

  const rows: Record<string, string>[] = [];
  for (const raw of rawRows) {
    const row: Record<string, string> = {};
    let hasValue = false;
    for (const [header, key] of mapped) {
      const value = raw[header];
      const text = value === null || value === undefined ? "" : String(value).trim();
      row[key] = text;
      if (text) hasValue = true;
    }
    // Trailing blank lines are normal in hand-edited spreadsheets; they are not failed rows.
    if (hasValue) rows.push(row);
  }

  return { rows, unknownHeaders, missingColumns };
}

async function parseDelimited(file: File, columns: ColumnSpec[]): Promise<ParsedSheet> {
  const { default: Papa } = await import("papaparse");
  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: detectDelimiter(text),
    transformHeader: (h) => h.trim(),
  });
  // Papa reports malformed rows but still returns what it could read; a fully unreadable file
  // yields no fields at all, which is the case worth stopping on.
  if (!result.meta.fields || result.meta.fields.length === 0) {
    throw new ImportError("No column headers found. The first row must contain the column names.");
  }
  return toRows(result.data, result.meta.fields, columns);
}

async function parseXlsx(file: File, columns: ColumnSpec[]): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const signature = Array.from(new Uint8Array(buffer.slice(0, 4)));
  if (LEGACY_XLS_SIGNATURE.every((byte, i) => signature[i] === byte)) {
    throw new ImportError(
      "This is a legacy .xls file, which cannot be read here. Open it and save as .xlsx or CSV."
    );
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportError("The workbook has no sheets.");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? "").trim();
  });
  if (headers.filter(Boolean).length === 0) {
    throw new ImportError("No column headers found in the first row of the sheet.");
  }

  const rawRows: Record<string, unknown>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const header = headers[col - 1];
      if (!header) return;
      const value = cell.value;
      // Dates arrive as Date objects; the APIs all want YYYY-MM-DD.
      if (value instanceof Date) raw[header] = value.toISOString().slice(0, 10);
      else if (value && typeof value === "object" && "text" in value) raw[header] = (value as { text: string }).text;
      else if (value && typeof value === "object" && "result" in value) raw[header] = (value as { result: unknown }).result;
      else raw[header] = value;
    });
    rawRows.push(raw);
  });

  return toRows(rawRows, headers, columns);
}

export async function parseImportFile(file: File, columns: ColumnSpec[]): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) return parseXlsx(file, columns);
  if (name.endsWith(".xls")) {
    // Some tools emit CSV or XML under a .xls name, so sniff rather than reject on extension.
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (LEGACY_XLS_SIGNATURE.every((byte, i) => head[i] === byte)) {
      throw new ImportError(
        "This is a legacy .xls file, which cannot be read here. Open it and save as .xlsx or CSV."
      );
    }
    return parseDelimited(file, columns);
  }
  // .csv, .tsv, .psv, .txt and anything else delimited — the delimiter is detected, not assumed.
  return parseDelimited(file, columns);
}

/** Header row plus one example row, so the expected values are visible rather than described. */
export function buildTemplateRows(columns: ColumnSpec[]): { headers: string[]; example: string[] } {
  return {
    headers: columns.map((c) => c.header),
    example: columns.map((c) => c.example),
  };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsvTemplate(columns: ColumnSpec[]): Blob {
  const { headers, example } = buildTemplateRows(columns);
  const csv = [headers.map(csvCell).join(","), example.map(csvCell).join(",")].join("\r\n");
  // The BOM makes Excel open UTF-8 correctly instead of mangling non-ASCII on double-click.
  return new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
}

/** Valid values for a column, written into the template so they don't have to be memorised. */
export interface ReferenceList {
  title: string;
  values: string[];
}

export async function buildXlsxTemplate(
  columns: ColumnSpec[],
  sheetName: string,
  references: ReferenceList[] = []
): Promise<Blob> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel's sheet-name limit
  const { headers, example } = buildTemplateRows(columns);

  sheet.addRow(headers);
  sheet.addRow(example);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = columns.map((c) => ({
    width: Math.max(c.header.length, c.example.length, 12) + 4,
  }));

  // A comment per required column, so the rules travel with the file rather than living only in
  // the UI the user has already navigated away from.
  columns.forEach((col, i) => {
    const cell = sheet.getRow(1).getCell(i + 1);
    const note = [col.required ? "Required" : "Optional", col.hint].filter(Boolean).join(" — ");
    cell.note = note;
  });

  // A second sheet listing this client's actual valid values. The employee template asks for a
  // pay cycle and site BY NAME, and without this the only way to learn the accepted names is to
  // guess, submit, and read the errors.
  const populated = references.filter((r) => r.values.length > 0);
  if (populated.length > 0) {
    const ref = workbook.addWorksheet("Reference");
    ref.addRow(populated.map((r) => r.title));
    ref.getRow(1).font = { bold: true };
    const depth = Math.max(...populated.map((r) => r.values.length));
    for (let i = 0; i < depth; i++) ref.addRow(populated.map((r) => r.values[i] ?? ""));
    ref.columns = populated.map((r) => ({
      width: Math.max(r.title.length, ...r.values.map((v) => v.length), 12) + 4,
    }));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Failed rows, back out as CSV with the reason appended, so they can be corrected and re-imported. */
export function buildFailuresCsv(
  columns: ColumnSpec[],
  failures: { row: Record<string, string>; error: string }[]
): Blob {
  const headers = [...columns.map((c) => c.header), "Error"];
  const lines = [headers.map(csvCell).join(",")];
  for (const failure of failures) {
    const cells = columns.map((c) => csvCell(failure.row[c.key] ?? ""));
    cells.push(csvCell(failure.error));
    lines.push(cells.join(","));
  }
  return new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next tick rather than immediately: Safari cancels an in-flight download if the
  // object URL disappears synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
