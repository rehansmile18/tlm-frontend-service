import type { TranslationKey } from "./i18n/i18n";

/**
 * Single source of truth for every "module" a client can rename. Drives both the module-names
 * customization page (row list) and the t() override overlay's key -> module lookup (i18n.tsx).
 * The `key` is the opaque string stored in Client.moduleLabels — TLM never inspects it.
 */
export interface ModuleDefinition {
  key: string;
  /** Translation key resolving this module's built-in singular default name (see locale files' `moduleName`). */
  singularKey: TranslationKey;
  /** Translation key resolving this module's built-in plural default name (reuses each namespace's existing `title`). */
  pluralKey: TranslationKey;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  { key: "dashboard", singularKey: "dashboard.moduleName", pluralKey: "nav.dashboard" },
  { key: "employees", singularKey: "employees.moduleName", pluralKey: "employees.title" },
  { key: "sites", singularKey: "sites.moduleName", pluralKey: "sites.title" },
  { key: "tasks", singularKey: "tasks.moduleName", pluralKey: "tasks.title" },
  { key: "payPeriodConfigs", singularKey: "payPeriodConfigs.moduleName", pluralKey: "payPeriodConfigs.title" },
  { key: "payrollCalendars", singularKey: "payrollCalendars.moduleName", pluralKey: "payrollCalendars.title" },
  { key: "schedule", singularKey: "schedule.moduleName", pluralKey: "schedule.title" },
  { key: "punches", singularKey: "punches.moduleName", pluralKey: "punches.title" },
  { key: "timesheets", singularKey: "timesheets.moduleName", pluralKey: "timesheets.title" },
  { key: "processing", singularKey: "processing.moduleName", pluralKey: "processing.title" },
  { key: "team", singularKey: "team.moduleName", pluralKey: "nav.team" },
  { key: "profile", singularKey: "profile.moduleName", pluralKey: "profile.title" },
];

/**
 * Maps a translation key's own namespace prefix to the module it's about. Longest/most-specific
 * prefix wins (checked in order), so a nested cross-reference like "employees.sites." (the
 * site-assignment panel embedded in the Employees module) correctly resolves to "sites", not
 * "employees", even though it starts with the employees namespace.
 */
const MODULE_KEY_PREFIXES: { prefix: string; moduleKey: string }[] = [
  { prefix: "employees.sites.", moduleKey: "sites" },
  { prefix: "nav.dashboard", moduleKey: "dashboard" },
  { prefix: "dashboard.", moduleKey: "dashboard" },
  { prefix: "nav.employees", moduleKey: "employees" },
  { prefix: "employees.", moduleKey: "employees" },
  { prefix: "nav.sites", moduleKey: "sites" },
  { prefix: "sites.", moduleKey: "sites" },
  { prefix: "nav.tasks", moduleKey: "tasks" },
  { prefix: "tasks.", moduleKey: "tasks" },
  { prefix: "nav.payPeriodConfigs", moduleKey: "payPeriodConfigs" },
  { prefix: "payPeriodConfigs.", moduleKey: "payPeriodConfigs" },
  { prefix: "nav.payrollCalendars", moduleKey: "payrollCalendars" },
  { prefix: "payrollCalendars.", moduleKey: "payrollCalendars" },
  { prefix: "nav.schedule", moduleKey: "schedule" },
  { prefix: "schedule.", moduleKey: "schedule" },
  { prefix: "nav.punches", moduleKey: "punches" },
  { prefix: "punches.", moduleKey: "punches" },
  { prefix: "nav.timesheets", moduleKey: "timesheets" },
  { prefix: "timesheets.", moduleKey: "timesheets" },
  { prefix: "processing.", moduleKey: "processing" },
  { prefix: "nav.team", moduleKey: "team" },
  { prefix: "team.", moduleKey: "team" },
  { prefix: "nav.profile", moduleKey: "profile" },
  { prefix: "profile.", moduleKey: "profile" },
];

export function moduleKeyOf(translationKey: string): string | undefined {
  return MODULE_KEY_PREFIXES.find((entry) => translationKey.startsWith(entry.prefix))?.moduleKey;
}
