import { clearSession, getToken } from "./auth-store";

// This app talks to TWO separate backend APIs that share the same bearer token (TLM issues it;
// tlm-backend only verifies it — neither app should ever be asked to mint or refresh one itself).
//
// TLM (`~/Git/TLM`) is the single auth authority: login, and User CRUD for the Team/Permissions page.
export const TLM_API_BASE_URL =
  process.env.NEXT_PUBLIC_TLM_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api/v1";

// tlm-backend (`~/Git/tlm-backend`) owns everything else: Employee, EmployeeGroup, Site, Task,
// PayPeriodConfig, PayrollCalendar, Punch, EmployeeSiteAssignment, Schedule, Timesheet/Processing
// (proxied through to tlm-punch-processor), and the permissions catalog.
export const BACKEND_API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4200/api/v1";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Shared fetch implementation for both backends. Attaches the bearer token, normalizes the
 * backend's `{ error, message, details|issues }` JSON error envelope into a typed ApiError, and
 * clears the session on a 401 so a revoked/expired token bounces the user back to login (handled
 * by the auth provider). Always `cache: "no-store"` — this is a live operational tool, not a
 * static site.
 */
async function request<T>(baseUrl: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(buildUrl(baseUrl, path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    cache: "no-store",
  });

  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (res.status === 401) {
    clearSession();
  }

  if (!res.ok) {
    const envelope = (data ?? {}) as { error?: string; message?: string; details?: unknown; issues?: unknown };
    const message =
      envelope.message || envelope.error || (typeof data === "string" && data) || res.statusText || "Request failed";
    throw new ApiError(res.status, message, envelope.error, envelope.details ?? envelope.issues);
  }

  return data as T;
}

/** TLM — the single auth authority. Login and User CRUD live here. */
export function tlmFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(TLM_API_BASE_URL, path, opts);
}

/** tlm-backend — everything else (Employee/Site/Task/Punch/Schedule/Timesheet/Processing/...). */
export function backendFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(BACKEND_API_BASE_URL, path, opts);
}
