import { backendFetch, tlmFetch } from "./api";

// Mirrors the two backends' domain models and API response shapes, grouped by domain. TLM
// (`~/Git/TLM`) is the single auth authority (login, User CRUD); tlm-backend (`~/Git/tlm-backend`)
// owns every operational resource — Employee, EmployeeGroup, Site, Task, PayPeriodConfig,
// PayrollCalendar, Punch, EmployeeSiteAssignment, Schedule, and the Timesheet/Processing proxies.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Auth (TLM) ----
export interface LoginResult {
  token: string;
  user: {
    userId: string;
    email: string;
    role: string;
    clientId: string | null;
  };
}

export interface MeResult {
  userId: string;
  email: string;
  role: string;
  clientId: string | null;
  siteIds: string[];
  permissions: string[];
  status: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    tlmFetch<LoginResult>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => tlmFetch<MeResult>("/users/me"),
};

// ---- Users (TLM; for the future Team/Permissions management page) ----
export interface UserRecord {
  _id: string;
  email: string;
  role: string;
  clientId: string | null;
  // Optional, not just string[]: a user document created before these fields existed in TLM's
  // schema can omit them entirely (Mongoose's default only applies to newly-created documents),
  // so every consumer must handle undefined here rather than assuming an array.
  siteIds?: string[];
  permissions?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateUserBody {
  email: string;
  password: string;
  role: string;
  clientId?: string;
  siteIds?: string[];
  permissions?: string[];
}

export type UpdateUserBody = Partial<{
  role: string;
  clientId: string;
  siteIds: string[];
  permissions: string[];
  status: string;
}>;

export const usersApi = {
  list: (params: UserListParams = {}) => tlmFetch<Paginated<UserRecord>>("/users", { query: { ...params } }),
  get: (id: string) => tlmFetch<UserRecord>(`/users/${id}`),
  create: (body: CreateUserBody) => tlmFetch<UserRecord>("/users", { method: "POST", body }),
  update: (id: string, body: UpdateUserBody) => tlmFetch<UserRecord>(`/users/${id}`, { method: "PATCH", body }),
};

// ---- Clients (TLM) ----
// Per-module display-name overrides (e.g. renaming "Site" to "Business Unit"), shared by every
// user of a client — one singular/plural pair per supported locale, since a single override
// reused across languages would produce mixed-language sentences. Keyed by an opaque module key
// this app defines (see module-registry.ts); TLM itself never inspects the keys.
export type ModuleLabelOverrides = Record<string, Record<"en" | "es" | "ar", { singular: string; plural: string }>>;

export interface ClientRecord {
  _id: string;
  name: string;
  country: string | null;
  enabledStates: string[];
  calendarFormat: string;
  moduleLabels: ModuleLabelOverrides | null;
}

export const clientsApi = {
  me: () => tlmFetch<{ client: ClientRecord | null }>("/clients/me"),
  // Self-service — CLIENT_ADMIN customizing their own client's module labels.
  updateMe: (body: { moduleLabels: ModuleLabelOverrides | null }) =>
    tlmFetch<ClientRecord>("/clients/me", { method: "PATCH", body }),
  // PLATFORM_ADMIN has no client of their own, so `updateMe` doesn't apply to them.
  update: (id: string, body: { moduleLabels: ModuleLabelOverrides | null }) =>
    tlmFetch<ClientRecord>(`/clients/${id}`, { method: "PATCH", body }),
  list: () => tlmFetch<{ items: ClientRecord[] }>("/clients"),
};

// ---- Employees (tlm-backend) ----
export interface Employee {
  _id: string;
  clientId: string;
  employeeId: string;
  employeeGroupId: string | null;
  timezone: string;
  payPeriodConfigId: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSiteAssignment {
  _id: string;
  clientId: string;
  employeeId: string;
  siteId: string;
  task: string | null;
  isPrimary: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListParams {
  clientId?: string;
  employeeGroupId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateEmployeeBody {
  clientId: string;
  employeeId: string;
  employeeGroupId?: string | null;
  timezone: string;
  payPeriodConfigId?: string | null;
  status?: "active" | "inactive";
}

export type UpdateEmployeeBody = Partial<{
  employeeId: string;
  employeeGroupId: string | null;
  timezone: string;
  payPeriodConfigId: string | null;
  status: "active" | "inactive";
}>;

export interface AssignEmployeeSiteBody {
  siteId: string;
  task: string;
  isPrimary?: boolean;
  status?: "active" | "inactive";
}

export type UpdateEmployeeSiteAssignmentBody = Partial<{
  task: string;
  isPrimary: boolean;
  status: "active" | "inactive";
}>;

export const employeesApi = {
  list: (params: EmployeeListParams = {}) => backendFetch<Paginated<Employee>>("/employees", { query: { ...params } }),
  get: (id: string) => backendFetch<Employee>(`/employees/${id}`),
  create: (body: CreateEmployeeBody) => backendFetch<Employee>("/employees", { method: "POST", body }),
  update: (id: string, body: UpdateEmployeeBody) =>
    backendFetch<Employee>(`/employees/${id}`, { method: "PATCH", body }),
  listSites: (employeeId: string) =>
    backendFetch<{ items: EmployeeSiteAssignment[] }>(`/employees/${employeeId}/sites`),
  assignSite: (employeeId: string, body: AssignEmployeeSiteBody) =>
    backendFetch<EmployeeSiteAssignment>(`/employees/${employeeId}/sites`, { method: "POST", body }),
  updateSiteAssignment: (employeeId: string, siteId: string, body: UpdateEmployeeSiteAssignmentBody) =>
    backendFetch<EmployeeSiteAssignment>(`/employees/${employeeId}/sites/${siteId}`, { method: "PATCH", body }),
  unassignSite: (employeeId: string, siteId: string) =>
    backendFetch<void>(`/employees/${employeeId}/sites/${siteId}`, { method: "DELETE" }),
};

// ---- Employee Groups (tlm-backend) ----
export interface EmployeeGroup {
  _id: string;
  clientId: string;
  name: string;
  payPeriodConfigId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeGroupListParams {
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateEmployeeGroupBody {
  clientId: string;
  name: string;
  payPeriodConfigId: string;
}

export type UpdateEmployeeGroupBody = Partial<{
  name: string;
  payPeriodConfigId: string;
}>;

export const employeeGroupsApi = {
  list: (params: EmployeeGroupListParams = {}) =>
    backendFetch<Paginated<EmployeeGroup>>("/employee-groups", { query: { ...params } }),
  get: (id: string) => backendFetch<EmployeeGroup>(`/employee-groups/${id}`),
  create: (body: CreateEmployeeGroupBody) => backendFetch<EmployeeGroup>("/employee-groups", { method: "POST", body }),
  update: (id: string, body: UpdateEmployeeGroupBody) =>
    backendFetch<EmployeeGroup>(`/employee-groups/${id}`, { method: "PATCH", body }),
};

// ---- Sites (tlm-backend) ----
export interface Site {
  _id: string;
  clientId: string;
  siteId: string;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteListParams {
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateSiteBody {
  clientId: string;
  siteId: string;
  name: string;
  timezone: string;
}

export type UpdateSiteBody = Partial<{
  siteId: string;
  name: string;
  timezone: string;
}>;

export const sitesApi = {
  list: (params: SiteListParams = {}) => backendFetch<Paginated<Site>>("/sites", { query: { ...params } }),
  get: (id: string) => backendFetch<Site>(`/sites/${id}`),
  create: (body: CreateSiteBody) => backendFetch<Site>("/sites", { method: "POST", body }),
  update: (id: string, body: UpdateSiteBody) => backendFetch<Site>(`/sites/${id}`, { method: "PATCH", body }),
};

// ---- Tasks (tlm-backend) ----
export interface Task {
  _id: string;
  clientId: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListParams {
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTaskBody {
  clientId: string;
  name: string;
  code?: string | null;
}

export type UpdateTaskBody = Partial<{
  name: string;
  code: string | null;
}>;

export const tasksApi = {
  list: (params: TaskListParams = {}) => backendFetch<Paginated<Task>>("/tasks", { query: { ...params } }),
  get: (id: string) => backendFetch<Task>(`/tasks/${id}`),
  create: (body: CreateTaskBody) => backendFetch<Task>("/tasks", { method: "POST", body }),
  update: (id: string, body: UpdateTaskBody) => backendFetch<Task>(`/tasks/${id}`, { method: "PATCH", body }),
};

// ---- Pay Period Configs (tlm-backend) ----
export interface PayPeriodConfig {
  _id: string;
  clientId: string;
  name: string;
  cadence: "daily" | "weekly" | "biweekly" | "semi_monthly" | "monthly" | "salaried";
  timezone: string;
  weekStartDay: number | null;
  anchorDate: string | null;
  semiMonthlySplitDay: number;
  payDateOffsetDays: number;
  payDateWeekendRule: "none" | "prior_business_day" | "next_business_day";
  payCalendarId: string | null;
  producesHourlyLines: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayPeriodConfigListParams {
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePayPeriodConfigBody {
  clientId: string;
  name: string;
  cadence: PayPeriodConfig["cadence"];
  timezone: string;
  weekStartDay?: number | null;
  anchorDate?: string | null;
  semiMonthlySplitDay?: number;
  payDateOffsetDays?: number;
  payDateWeekendRule?: PayPeriodConfig["payDateWeekendRule"];
  payCalendarId?: string | null;
  producesHourlyLines?: boolean;
}

export type UpdatePayPeriodConfigBody = Partial<CreatePayPeriodConfigBody>;

export const payPeriodConfigsApi = {
  list: (params: PayPeriodConfigListParams = {}) =>
    backendFetch<Paginated<PayPeriodConfig>>("/pay-period-configs", { query: { ...params } }),
  get: (id: string) => backendFetch<PayPeriodConfig>(`/pay-period-configs/${id}`),
  create: (body: CreatePayPeriodConfigBody) =>
    backendFetch<PayPeriodConfig>("/pay-period-configs", { method: "POST", body }),
  update: (id: string, body: UpdatePayPeriodConfigBody) =>
    backendFetch<PayPeriodConfig>(`/pay-period-configs/${id}`, { method: "PATCH", body }),
};

// ---- Payroll Calendars (tlm-backend) ----
export interface PayrollCalendarRow {
  periodEnd: string;
  payDate: string;
}

export interface PayrollCalendar {
  _id: string;
  clientId: string;
  name: string;
  rows: PayrollCalendarRow[];
  createdAt: string;
  updatedAt: string;
}

export interface PayrollCalendarListParams {
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePayrollCalendarBody {
  clientId: string;
  name: string;
  rows: PayrollCalendarRow[];
}

export type UpdatePayrollCalendarBody = Partial<{
  name: string;
  rows: PayrollCalendarRow[];
}>;

export const payrollCalendarsApi = {
  list: (params: PayrollCalendarListParams = {}) =>
    backendFetch<Paginated<PayrollCalendar>>("/payroll-calendars", { query: { ...params } }),
  get: (id: string) => backendFetch<PayrollCalendar>(`/payroll-calendars/${id}`),
  create: (body: CreatePayrollCalendarBody) =>
    backendFetch<PayrollCalendar>("/payroll-calendars", { method: "POST", body }),
  update: (id: string, body: UpdatePayrollCalendarBody) =>
    backendFetch<PayrollCalendar>(`/payroll-calendars/${id}`, { method: "PATCH", body }),
};

// ---- Punches (tlm-backend) ----
export interface Punch {
  _id: string;
  clientId: string;
  employeeId: string;
  siteId: string;
  task: string;
  clockIn: string;
  clockOut: string | null;
  timezone: string;
  status: "open" | "closed" | "corrected" | "rejected";
  correctionOfPunchId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PunchListParams {
  employeeId?: string;
  siteId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePunchBody {
  clientId: string;
  employeeId: string;
  siteId: string;
  task: string;
  clockIn: string;
  clockOut?: string | null;
  timezone: string;
}

export type CorrectPunchBody = Partial<{
  siteId: string;
  task: string;
  clockIn: string;
  clockOut: string | null;
  timezone: string;
}>;

export interface BulkPunchResult {
  accepted: Punch[];
  rejected: { index: number; error: string }[];
}

export const punchesApi = {
  list: (params: PunchListParams = {}) => backendFetch<Paginated<Punch>>("/punches", { query: { ...params } }),
  get: (id: string) => backendFetch<Punch>(`/punches/${id}`),
  create: (body: CreatePunchBody) => backendFetch<Punch>("/punches", { method: "POST", body }),
  bulkCreate: (punches: CreatePunchBody[]) =>
    backendFetch<BulkPunchResult>("/punches/bulk", { method: "POST", body: { punches } }),
  correct: (id: string, body: CorrectPunchBody) => backendFetch<Punch>(`/punches/${id}`, { method: "PATCH", body }),
};

// ---- Schedules (tlm-backend) ----
export interface ScheduledShift {
  _id: string;
  clientId: string;
  employeeId: string;
  siteId: string;
  task: string | null;
  shiftStart: string;
  shiftEnd: string;
  timezone: string;
  businessDate: string;
  status: "scheduled" | "cancelled";
  seriesId: string | null;
  createdBy: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdherenceEntry {
  shiftId: string;
  clientId: string;
  employeeId: string;
  siteId: string;
  businessDate: string;
  shiftStart: string;
  shiftEnd: string;
  status: "no_show" | "on_time" | "late" | "early";
  matchedPunchId: string | null;
  clockInVarianceMinutes: number | null;
  clockOutVarianceMinutes: number | null;
}

export interface ScheduleListParams {
  employeeId?: string;
  siteId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateScheduleBody {
  clientId: string;
  employeeId: string;
  siteId: string;
  task?: string | null;
  shiftStart: string;
  shiftEnd: string;
  timezone: string;
  notes?: string | null;
}

export type UpdateScheduleBody = Partial<{
  task: string | null;
  shiftStart: string;
  shiftEnd: string;
  timezone: string;
  notes: string | null;
}>;

export interface BulkScheduleResult {
  accepted: ScheduledShift[];
  rejected: { index: number; error: string }[];
  seriesId: string;
}

export interface AdherenceParams {
  employeeId?: string;
  siteId?: string;
  from: string;
  to: string;
}

export const schedulesApi = {
  list: (params: ScheduleListParams = {}) =>
    backendFetch<Paginated<ScheduledShift>>("/schedules", { query: { ...params } }),
  get: (id: string) => backendFetch<ScheduledShift>(`/schedules/${id}`),
  create: (body: CreateScheduleBody) => backendFetch<ScheduledShift>("/schedules", { method: "POST", body }),
  bulkCreate: (shifts: CreateScheduleBody[]) =>
    backendFetch<BulkScheduleResult>("/schedules/bulk", { method: "POST", body: { shifts } }),
  update: (id: string, body: UpdateScheduleBody) =>
    backendFetch<ScheduledShift>(`/schedules/${id}`, { method: "PATCH", body }),
  cancel: (id: string) => backendFetch<ScheduledShift>(`/schedules/${id}/cancel`, { method: "POST" }),
  adherence: (params: AdherenceParams) =>
    backendFetch<{ items: AdherenceEntry[] }>("/schedules/adherence", { query: { ...params } }),
};

// ---- Timesheets (tlm-backend, proxying tlm-punch-processor) ----
export interface TimesheetLine {
  businessDate: string;
  siteId: string;
  employeeId: string;
  task: string;
  rate: number;
  rateType: "hourly" | "salary";
  dailyAmount: number;
  additionalAmount: number;
  additionalHours: number;
  totalHours: number;
  totalAmount: number;
  runId: string;
}

export interface Timesheet {
  _id: string;
  clientId: string;
  employeeId: string;
  payPeriodId: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  status: "draft" | "completed" | "superseded" | "voided" | "failed";
  runId: string;
  lines: TimesheetLine[];
  totalHours: number;
  totalAmount: number;
  payDate: string;
  stale: boolean;
  supersedesTimesheetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetListParams {
  clientId?: string;
  employeeId?: string;
  payPeriodId?: string;
  status?: string;
  includeSuperseded?: boolean;
  page?: number;
  pageSize?: number;
}

export const timesheetsApi = {
  list: (params: TimesheetListParams = {}) =>
    backendFetch<Paginated<Timesheet>>("/timesheets", { query: { ...params } }),
  get: (id: string) => backendFetch<Timesheet>(`/timesheets/${id}`),
  auditTrail: (id: string) => backendFetch<{ entries: unknown[] }>(`/timesheets/${id}/audit-trail`),
  void: (id: string, reason: string) =>
    backendFetch<Timesheet>(`/timesheets/${id}/void`, { method: "POST", body: { reason } }),
};

// ---- Processing (tlm-backend, proxying tlm-punch-processor) ----
export interface TriggerProcessingBody {
  clientId: string;
  employeeIds: string[];
  asOfDate: string;
}

export interface ProcessingRunResult {
  summary: { completed: number; skippedLocked: number; failed: number };
  items: { employeeId: string; status: string; payPeriodId?: string; timesheetId?: string; error?: string }[];
}

export const processingApi = {
  trigger: (body: TriggerProcessingBody) =>
    backendFetch<ProcessingRunResult>("/processing/runs", { method: "POST", body }),
};

// ---- Permissions catalog (tlm-backend) ----
export interface PermissionsCatalog {
  keys: { key: string; description: string }[];
  recommendedDefaults: Record<string, string[]>;
}

export const permissionsApi = {
  catalog: () => backendFetch<PermissionsCatalog>("/permissions/catalog"),
};
