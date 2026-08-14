"use client";

import { CheckIcon, ChevronDownIcon, LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, useTranslation, type Locale, type TranslationKey } from "@/lib/i18n/i18n";

const LOCALE_CODE: Record<Locale, string> = { en: "EN", es: "ES", ar: "AR" };

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5" />}>
        <LanguagesIcon className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide">{LOCALE_CODE[locale]}</span>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {LOCALES.map((code) => {
            const active = locale === code;
            return (
              <DropdownMenuItem key={code} onClick={() => setLocale(code)} className="justify-between gap-3">
                <span className={active ? "font-semibold" : "font-normal"}>{t(`language.${code}` as TranslationKey)}</span>
                {active ? <CheckIcon className="size-4 shrink-0 text-primary" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
