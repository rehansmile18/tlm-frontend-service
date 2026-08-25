import { normalizeBaseUrl, request, type RequestOptions } from "./api-core";

// Re-exported so call sites keep importing everything api-shaped from one module.
export { ApiError, normalizeBaseUrl } from "./api-core";
export type { QueryValue, RequestOptions } from "./api-core";

// This app talks to TWO separate backend APIs that share the same bearer token (TLM issues it;
// tlm-backend only verifies it — neither app should ever be asked to mint or refresh one itself).
//
// TLM (`~/Git/TLM`) is the single auth authority: login, and User CRUD for the Team/Permissions page.
export const TLM_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_TLM_API_BASE_URL ?? "http://localhost:4000/api/v1"
);

// tlm-backend (`~/Git/tlm-backend`) owns everything else: Employee, EmployeeGroup, Site, Task,
// PayPeriodConfig, PayrollCalendar, Punch, EmployeeSiteAssignment, Schedule, Timesheet/Processing
// (proxied through to tlm-punch-processor), and the permissions catalog.
export const BACKEND_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? "http://localhost:4200/api/v1"
);

/** TLM — the single auth authority. Login and User CRUD live here. */
export function tlmFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(TLM_API_BASE_URL, path, opts);
}

/** tlm-backend — everything else (Employee/Site/Task/Punch/Schedule/Timesheet/Processing/...). */
export function backendFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(BACKEND_API_BASE_URL, path, opts);
}
