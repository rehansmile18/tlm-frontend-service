"use client";

import { useMemo, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/i18n";

// Intl.supportedValuesOf omits "UTC" itself (and any Etc/* zone) even though the runtime accepts
// it as a timeZone value — prepended explicitly since it's a common choice.
const SUPPORTED_TIMEZONES: string[] = (() => {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
})();

// The zone's CURRENT UTC offset (it moves with DST, same as any "what time is it there right
// now" reference) — shown next to each option since "America/Indiana/Knox" alone tells a picker
// nothing about how far off local time actually is.
function formatOffset(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(
      new Date()
    );
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return raw && raw !== "GMT" ? raw.replace("GMT", "UTC") : "UTC+00:00";
  } catch {
    return "";
  }
}

const TIMEZONE_OFFSETS: Record<string, string> = Object.fromEntries(
  SUPPORTED_TIMEZONES.map((zone) => [zone, formatOffset(zone)])
);

function offsetLabelFor(zone: string): string {
  return TIMEZONE_OFFSETS[zone] ?? formatOffset(zone);
}

/**
 * The zone's familiar spoken name — "Asia/Kolkata" means little to someone who calls it Indian
 * Standard Time.
 *
 * Uses "longGeneric" rather than "long" deliberately: "long" reports whichever side of DST today
 * happens to fall on, so America/Los_Angeles would read "Pacific Daylight Time" for half the year
 * and "Pacific Standard Time" the other half. A picker label describing a zone, not an instant,
 * should not change with the season.
 */
function formatZoneName(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longGeneric" }).formatToParts(
      new Date()
    );
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // longGeneric renders UTC as the bare "GMT", and echoing the zone id back adds nothing.
    if (!name || name === zone) return "";
    return name;
  } catch {
    return "";
  }
}

const TIMEZONE_NAMES: Record<string, string> = Object.fromEntries(
  SUPPORTED_TIMEZONES.map((zone) => [zone, formatZoneName(zone)])
);

function zoneNameFor(zone: string): string {
  return TIMEZONE_NAMES[zone] ?? formatZoneName(zone);
}

/**
 * Current tzdata renamed a number of zones, but the ICU build behind Intl.supportedValuesOf still
 * reports the OLD names — this runtime lists "Asia/Calcutta", not "Asia/Kolkata", and the same for
 * Kyiv, Ho Chi Minh City, Yangon and Nuuk (verified in both Node and the browser). Someone
 * searching for the name their city actually has today would otherwise find nothing.
 *
 * Keyed by the listed (legacy) id, with the modern name as an extra search term. Deliberately a
 * curated list of renames people actually type rather than the whole tzdata alias set, most of
 * which nobody searches for.
 */
const ALSO_KNOWN_AS: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Europe/Kiev": "Europe/Kyiv",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "America/Godthab": "America/Nuuk",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Atlantic/Faeroe": "Atlantic/Faroe",
};

/**
 * The zone this browser is actually in.
 *
 * Nothing in either app consulted this before, so every timezone field started empty and the user
 * picked whichever plausible-looking option their first few keystrokes matched — which is how a
 * client in India ended up with sites on Africa/Tripoli and a pay cycle on America/Goose_Bay.
 * Period boundaries are computed in these zones, so a mis-picked one quietly produces wrong pay
 * dates rather than an error.
 *
 * Offered as a suggestion rather than silently prefilled: this is the browser's zone, which is a
 * good guess for the person configuring the system and not necessarily right for the site or
 * employee being configured.
 */
function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

function nameWordMatches(name: string, q: string): boolean {
  return name.split(/[\s/]+/).some((word) => word.startsWith(q) || (word.length >= 4 && q.startsWith(word)));
}

/**
 * Ranks a zone against the query. Lower is better; -1 means no match.
 *
 * Ranking rather than a plain boolean filter, because the obvious search is the one that goes
 * wrong: "indian" is a substring of "America/Indiana/*", so five Indiana zones would crowd out
 * Asia/Kolkata — the very zone someone typing "Indian Standard Time" is looking for. A name match
 * therefore outranks a zone-id match.
 */
function rankZone(zone: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = zoneNameFor(zone).toLowerCase();
  const id = zone.toLowerCase();
  const spacedId = id.replace(/_/g, " ");
  const city = (id.split("/").pop() ?? "").replace(/_/g, " ");
  const alias = (ALSO_KNOWN_AS[zone] ?? "").toLowerCase().replace(/_/g, " ");
  const aliasCity = alias.split("/").pop() ?? "";

  // Bidirectional word-prefix, not a plain startsWith. ICU's official name is "India Standard
  // Time", but the common spoken form is "Indian Standard Time" — so typing "indian" has to match
  // "india", or it lands on "Indian Ocean Time" instead. The >= 4 floor keeps short words like
  // "time" from matching everything.
  if (nameWordMatches(name, q)) return 0;
  if (aliasCity.startsWith(q)) return 1; // "kolkata" should beat "America/Indiana/*"
  if (name.includes(q)) return 2;
  if (city.startsWith(q)) return 3;
  if (alias.includes(q)) return 4;
  if (offsetLabelFor(zone).toLowerCase().includes(q)) return 5;
  if (id.includes(q) || spacedId.includes(q)) return 6;
  return -1;
}

export function TimezoneCombobox({
  value,
  onValueChange,
  placeholder,
  id,
  disabled,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  const { t } = useTranslation();

  // Read once per mount rather than per render: it cannot change while the page is open, and
  // useState's lazy initializer keeps it off the server-render path where Intl would resolve to
  // the server's zone instead of the viewer's.
  const [detected] = useState(detectBrowserTimezone);

  // Preserves whatever value a record already has (e.g. a legacy alias like "US/Eastern" that
  // Intl.supportedValuesOf omits but the runtime still resolves fine) so opening an existing
  // record's edit form never silently blanks out an already-valid, just-uncommon zone.
  const [query, setQuery] = useState("");

  const allZones = useMemo(
    () => (value && !SUPPORTED_TIMEZONES.includes(value) ? [value, ...SUPPORTED_TIMEZONES] : SUPPORTED_TIMEZONES),
    [value]
  );

  const items = useMemo(() => {
    if (!query.trim()) return allZones;
    return allZones
      .map((zone) => ({ zone, rank: rankZone(zone, query) }))
      .filter((entry) => entry.rank >= 0)
      // Stable within a rank: the source list is already alphabetical.
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.zone);
  }, [allZones, query]);

  return (
    <Combobox.Root
      items={items}
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
      filter={null}
      onInputValueChange={setQuery}
    >
      <div className="relative">
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          aria-invalid={ariaInvalid}
          className={cn(
            "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 pe-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
          )}
        />
        <Combobox.Icon className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-2.5 text-muted-foreground">
          <ChevronDownIcon className="size-4" />
        </Combobox.Icon>
      </div>

      {!value && detected && !disabled ? (
        <button
          type="button"
          onClick={() => onValueChange(detected)}
          className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("common.useDetectedTimezone", { zone: detected })}
        </button>
      ) : null}

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50 outline-none">
          <Combobox.Popup className="max-h-72 w-max min-w-(--anchor-width) max-w-[26rem] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <Combobox.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("common.noMatches")}
            </Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item
                  key={item}
                  value={item}
                  className="relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {item}
                    {zoneNameFor(item) ? (
                      <span className="ms-1.5 text-xs text-muted-foreground">({zoneNameFor(item)})</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{offsetLabelFor(item)}</span>
                  <Combobox.ItemIndicator>
                    <CheckIcon className="size-3.5 shrink-0 text-primary" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
