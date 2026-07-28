// Centralized TanStack Query keys so reads and cache invalidations after mutations stay in sync.
export const queryKeys = {
  // Auth / profile (TLM)
  myProfile: ["users", "me"] as const,
  myClient: ["clients", "me"] as const,

  // Users (TLM)
  users: (params?: unknown) => ["users", params ?? {}] as const,
  user: (id: string) => ["user", id] as const,

  // Employees
  employees: (params?: unknown) => ["employees", params ?? {}] as const,
  employee: (id: string) => ["employee", id] as const,
  employeeSites: (employeeId: string) => ["employee-sites", employeeId] as const,

  // Employee groups
  employeeGroups: (params?: unknown) => ["employee-groups", params ?? {}] as const,
  employeeGroup: (id: string) => ["employee-group", id] as const,

  // Sites
  sites: (params?: unknown) => ["sites", params ?? {}] as const,
  site: (id: string) => ["site", id] as const,

  // Tasks
  tasks: (params?: unknown) => ["tasks", params ?? {}] as const,
  task: (id: string) => ["task", id] as const,

  // Pay period configs
  payPeriodConfigs: (params?: unknown) => ["pay-period-configs", params ?? {}] as const,
  payPeriodConfig: (id: string) => ["pay-period-config", id] as const,

  // Payroll calendars
  payrollCalendars: (params?: unknown) => ["payroll-calendars", params ?? {}] as const,
  payrollCalendar: (id: string) => ["payroll-calendar", id] as const,

  // Punches
  punches: (params?: unknown) => ["punches", params ?? {}] as const,
  punch: (id: string) => ["punch", id] as const,

  // Schedules
  schedules: (params?: unknown) => ["schedules", params ?? {}] as const,
  schedule: (id: string) => ["schedule", id] as const,
  scheduleAdherence: (params?: unknown) => ["schedule-adherence", params ?? {}] as const,

  // Timesheets
  timesheets: (params?: unknown) => ["timesheets", params ?? {}] as const,
  timesheet: (id: string) => ["timesheet", id] as const,
  timesheetAuditTrail: (id: string) => ["timesheet-audit-trail", id] as const,

  // Permissions catalog
  permissionsCatalog: ["permissions-catalog"] as const,
};
