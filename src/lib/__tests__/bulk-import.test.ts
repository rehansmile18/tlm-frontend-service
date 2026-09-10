import { describe, expect, it } from "vitest";
import {
  ImportError,
  buildCsvTemplate,
  buildFailuresCsv,
  parseImportFile,
  type ColumnSpec,
} from "../bulk-import";

/**
 * This module reads files a user was handed by someone else, and its output is fed straight into
 * create calls. The behaviour worth pinning is therefore the parsing quirks people actually hit —
 * a European CSV that is really semicolon-separated, headers spelled a different way, a legacy
 * .xls under a misleading name — rather than the happy path alone.
 */

const COLUMNS: ColumnSpec[] = [
  { key: "siteId", header: "Site Code", required: true, example: "DC-LAS", aliases: ["code", "site id"] },
  { key: "name", header: "Site Name", required: true, example: "Las Vegas DC" },
  { key: "timezone", header: "Time Zone", required: true, example: "America/Los_Angeles", aliases: ["tz"] },
  { key: "costCentre", header: "Cost Centre", example: "CC-4410" },
];

function file(contents: string, name = "sites.csv"): File {
  return new File([contents], name, { type: "text/plain" });
}

describe("parseImportFile — delimited", () => {
  it("reads a comma-separated file into rows keyed by column", async () => {
    const sheet = await parseImportFile(
      file("Site Code,Site Name,Time Zone\nDC-1,Fontana,America/Los_Angeles\n"),
      COLUMNS
    );
    expect(sheet.rows).toEqual([{ siteId: "DC-1", name: "Fontana", timezone: "America/Los_Angeles" }]);
    expect(sheet.missingColumns).toEqual([]);
    expect(sheet.unknownHeaders).toEqual([]);
  });

  it("detects tab, pipe and semicolon without being told", async () => {
    // The delimiter is inferred from the header line rather than the extension, because a ".csv"
    // exported from a European locale is very often semicolon-separated.
    const cases: [string, string][] = [
      ["tab", "Site Code\tSite Name\tTime Zone\nDC-2\tDallas\tAmerica/Chicago\n"],
      ["pipe", "Site Code|Site Name|Time Zone\nDC-3|Phoenix|America/Phoenix\n"],
      ["semicolon", "Site Code;Site Name;Time Zone\nDC-4;Oakland;America/Los_Angeles\n"],
    ];
    for (const [label, text] of cases) {
      const sheet = await parseImportFile(file(text, `sites-${label}.csv`), COLUMNS);
      expect(sheet.rows, label).toHaveLength(1);
      expect(sheet.rows[0].siteId, label).toMatch(/^DC-\d$/);
      expect(sheet.rows[0].timezone, label).toContain("America/");
    }
  });

  it("matches headers regardless of case, spacing, punctuation or alias", async () => {
    const sheet = await parseImportFile(
      file("site_id,SITE NAME,tz,cost-centre\nDC-5,Reno,America/Los_Angeles,CC-1\n"),
      COLUMNS
    );
    expect(sheet.rows[0]).toEqual({
      siteId: "DC-5",
      name: "Reno",
      timezone: "America/Los_Angeles",
      costCentre: "CC-1",
    });
    expect(sheet.unknownHeaders).toEqual([]);
  });

  it("reports unknown headers instead of silently dropping them", async () => {
    const sheet = await parseImportFile(
      file("Site Code,Site Name,Time Zone,Manager Email\nDC-6,Boise,America/Boise,a@b.c\n"),
      COLUMNS
    );
    expect(sheet.unknownHeaders).toEqual(["Manager Email"]);
    // The row still imports — an extra column is the user's business, not a failure.
    expect(sheet.rows[0].siteId).toBe("DC-6");
  });

  it("names required columns the file is missing", async () => {
    const sheet = await parseImportFile(file("Site Code,Cost Centre\nDC-7,CC-2\n"), COLUMNS);
    expect(sheet.missingColumns).toEqual(["Site Name", "Time Zone"]);
  });

  it("skips blank trailing lines rather than counting them as failed rows", async () => {
    // Hand-edited spreadsheets routinely carry empty rows at the end; treating those as failures
    // would report a clean file as partly broken.
    const sheet = await parseImportFile(
      file("Site Code,Site Name,Time Zone\nDC-8,Tucson,America/Phoenix\n,,\n\n,,\n"),
      COLUMNS
    );
    expect(sheet.rows).toHaveLength(1);
  });

  it("trims surrounding whitespace from every value", async () => {
    const sheet = await parseImportFile(
      file("Site Code,Site Name,Time Zone\n  DC-9  ,  Denver  ,  America/Denver  \n"),
      COLUMNS
    );
    expect(sheet.rows[0]).toEqual({ siteId: "DC-9", name: "Denver", timezone: "America/Denver" });
  });

  it("rejects a file with no header row at all", async () => {
    await expect(parseImportFile(file(""), COLUMNS)).rejects.toBeInstanceOf(ImportError);
  });
});

describe("parseImportFile — legacy .xls", () => {
  // OLE2 compound-document magic. exceljs cannot read this format and in practice only SheetJS
  // can, so it is detected and refused with an instruction rather than failing obscurely deeper in.
  const OLE2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

  it("refuses a real legacy .xls with a message saying what to do", async () => {
    const legacy = new File([OLE2], "old.xls", { type: "application/vnd.ms-excel" });
    await expect(parseImportFile(legacy, COLUMNS)).rejects.toThrow(/save as \.xlsx or CSV/i);
  });

  it("still reads a CSV that has merely been named .xls", async () => {
    // Exporters do this often enough that rejecting on extension alone would block valid files.
    const sheet = await parseImportFile(
      file("Site Code,Site Name,Time Zone\nDC-10,Mesa,America/Phoenix\n", "actually-a-csv.xls"),
      COLUMNS
    );
    expect(sheet.rows[0].siteId).toBe("DC-10");
  });
});

describe("templates and failure export", () => {
  it("writes a header row and one example row", async () => {
    const text = await buildCsvTemplate(COLUMNS).text();
    const [header, example] = text.replace(/^﻿/, "").split("\r\n");
    expect(header).toBe("Site Code,Site Name,Time Zone,Cost Centre");
    expect(example).toBe("DC-LAS,Las Vegas DC,America/Los_Angeles,CC-4410");
  });

  it("starts with a BOM so Excel opens it as UTF-8", async () => {
    // Checked as BYTES, not via .text(): Blob.text() decodes UTF-8 with BOM removal per spec, so
    // it can never observe the marker. Excel reads the bytes, which is what actually matters —
    // without EF BB BF it mangles non-ASCII on double-click, the normal way these are opened.
    const bytes = new Uint8Array(await buildCsvTemplate(COLUMNS).arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("round-trips: a generated template parses back to zero data rows plus the example", async () => {
    const text = await buildCsvTemplate(COLUMNS).text();
    const sheet = await parseImportFile(file(text), COLUMNS);
    expect(sheet.missingColumns).toEqual([]);
    expect(sheet.unknownHeaders).toEqual([]);
    expect(sheet.rows).toHaveLength(1); // the example row
  });

  it("exports failed rows with the reason appended, ready to fix and re-import", async () => {
    const csv = await buildFailuresCsv(COLUMNS, [
      { row: { siteId: "DC-11", name: "Bad", timezone: "Not/AZone", costCentre: "" }, error: "timezone: not recognised" },
    ]).text();
    const [header, row] = csv.replace(/^﻿/, "").split("\r\n");
    expect(header).toBe("Site Code,Site Name,Time Zone,Cost Centre,Error");
    expect(row).toBe("DC-11,Bad,Not/AZone,,timezone: not recognised");
  });

  it("quotes values containing a comma so the export stays parseable", async () => {
    const csv = await buildFailuresCsv(COLUMNS, [
      { row: { siteId: "DC-12", name: "Reno, Nevada", timezone: "", costCentre: "" }, error: "nope" },
    ]).text();
    expect(csv).toContain('"Reno, Nevada"');
    // And the export must survive a round trip through the parser it is meant to feed.
    const sheet = await parseImportFile(file(csv.replace(/^﻿/, "")), COLUMNS);
    expect(sheet.rows[0].name).toBe("Reno, Nevada");
  });
});
