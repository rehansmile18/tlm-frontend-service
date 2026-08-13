"use client";

import { useMemo } from "react";
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

  // Preserves whatever value a record already has (e.g. a legacy alias like "US/Eastern" that
  // Intl.supportedValuesOf omits but the runtime still resolves fine) so opening an existing
  // record's edit form never silently blanks out an already-valid, just-uncommon zone.
  const items = useMemo(
    () => (value && !SUPPORTED_TIMEZONES.includes(value) ? [value, ...SUPPORTED_TIMEZONES] : SUPPORTED_TIMEZONES),
    [value]
  );

  return (
    <Combobox.Root
      items={items}
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
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

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="isolate z-50 outline-none">
          <Combobox.Popup className="max-h-72 w-(--anchor-width) min-w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <Combobox.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("common.noMatches")}
            </Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item
                  key={item}
                  value={item}
                  className="relative flex cursor-default items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="truncate">{item}</span>
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
