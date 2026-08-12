"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import en from "./locales/en";
import es from "./locales/es";
import ar from "./locales/ar";
import { useMyClient } from "../hooks";
import { MODULE_REGISTRY, moduleKeyOf } from "../module-registry";

export const LOCALES = ["en", "es", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

const DICTIONARIES: Record<Locale, typeof en> = { en, es, ar };
const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", es: "ltr", ar: "rtl" };

const LOCALE_KEY = "tlmSiteOps.locale";
const localeListeners = new Set<() => void>();

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

function getLocaleSnapshot(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_KEY);
  return isLocale(stored) ? stored : "en";
}

function getLocaleServerSnapshot(): Locale {
  return "en";
}

function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_KEY, locale);
  for (const listener of localeListeners) listener();
}

type Dictionary = typeof en;
type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown> ? DotPaths<T[K], `${Prefix}${K}.`> : `${Prefix}${K}`;
}[keyof T & string];
export type TranslationKey = DotPaths<Dictionary>;

function resolveOptional(dict: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- traversing a typed dictionary by a dynamic dot-path
  let node: any = dict;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function resolveKey(dict: Dictionary, key: string): string {
  return resolveOptional(dict, key) ?? key;
}

/** Resolves a key's built-in default in an EXPLICIT locale, regardless of the current UI locale —
 * used by the module-names customization page to pre-fill all 3 language tabs at once. */
export function resolveInLocale(locale: Locale, key: TranslationKey): string {
  return resolveKey(DICTIONARIES[locale], key);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Client-level module renaming (e.g. "Site" -> "Business Unit"), applied as a word-boundary,
 * case-insensitive substring swap over an already-resolved string — not a locale-string rewrite.
 * Works for every current and future string in the module's namespace with zero per-string edits,
 * since it's keyed by the translation key's own prefix (see module-registry.ts), not by which
 * component renders it. Accepted limitation: this is a plain textual swap, not grammar-aware — a
 * custom term won't pick up Spanish/Arabic gender or case agreement with surrounding words.
 */
function applyModuleOverride(
  text: string,
  dict: Dictionary,
  moduleKey: string,
  locale: Locale,
  moduleLabels: Record<string, Record<string, { singular: string; plural: string }>> | null | undefined
): string {
  const override = moduleLabels?.[moduleKey]?.[locale];
  if (!override) return text;
  const moduleDef = MODULE_REGISTRY.find((m) => m.key === moduleKey);
  if (!moduleDef) return text;
  const pluralDefault = resolveOptional(dict, moduleDef.pluralKey);
  const singularDefault = resolveOptional(dict, moduleDef.singularKey);
  let result = text;
  if (pluralDefault) {
    result = result.replace(new RegExp(`\\b${escapeRegExp(pluralDefault)}\\b`, "gi"), override.plural);
  }
  if (singularDefault) {
    result = result.replace(new RegExp(`\\b${escapeRegExp(singularDefault)}\\b`, "gi"), override.singular);
  }
  return result;
}

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /**
   * Untyped lookup for keys that aren't statically known (e.g. the backend's dynamic policy
   * rules schema, whose field names/enum values are arbitrary strings, not a fixed literal
   * union). Returns undefined on a miss instead of echoing the key back, so callers can fall
   * back to a mechanical humanization for anything not yet in the dictionary.
   */
  tOptional: (key: string, params?: Record<string, string | number>) => string | undefined;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleServerSnapshot);
  const dir = LOCALE_DIR[locale];
  // React Query dedupes this against any other caller of the same query key (e.g. the module-names
  // customization page), so calling it here too costs nothing extra.
  const clientQuery = useMyClient();
  const moduleLabels = clientQuery.data?.client?.moduleLabels;

  // Synchronizes the <html> element (outside React's own tree) to the current locale/direction —
  // a legitimate effect (syncing to an external system), not a setState-in-effect case.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[locale];
    const t: I18nContextValue["t"] = (key, params) => {
      let text = resolveKey(dict, key);
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
        }
      }
      const moduleKey = moduleKeyOf(key);
      if (moduleKey) text = applyModuleOverride(text, dict, moduleKey, locale, moduleLabels);
      return text;
    };
    const tOptional: I18nContextValue["tOptional"] = (key, params) => {
      let text = resolveOptional(dict, key);
      if (text === undefined) return undefined;
      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
        }
      }
      const moduleKey = moduleKeyOf(key);
      if (moduleKey) text = applyModuleOverride(text, dict, moduleKey, locale, moduleLabels);
      return text;
    };
    return { locale, dir, setLocale: persistLocale, t, tOptional };
  }, [locale, dir, moduleLabels]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within an I18nProvider");
  return ctx;
}
