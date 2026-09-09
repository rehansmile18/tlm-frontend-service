import { clearSession, getToken } from "./auth-store";

/**
 * The fetch machinery both frontends share, with the base URL left as a parameter.
 *
 * It lives apart from ./api.ts because the two apps genuinely differ in how many backends they
 * talk to — the rule-repository app has one, the operations app has two — while the request
 * handling itself (bearer token, error-envelope normalization, 401 handling) is the same work in
 * both. Splitting on that seam keeps this file byte-identical across the repos (see
 * shared-files.json) instead of forking the part that matters over the part that doesn't.
 */

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
  /**
   * Opts out of the "401 means the session died, sign the user out" handling below. Set it for the
   * handful of endpoints where a 401 is about the REQUEST's own credentials rather than the bearer
   * token — currently just change-password, where "current password is incorrect" would otherwise
   * log a user out over a typo.
   */
  expects401?: boolean;
}

/** Strips the trailing slash so callers can join paths without doubling it. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Renders a validation error's per-field issues as one readable sentence, e.g.
 * `timezone: Not a recognised IANA time zone`. Returns "" for anything that isn't a recognisable
 * issue list, so the caller can fall through to its other candidates.
 */
function describeFieldIssues(detail: unknown): string {
  if (!Array.isArray(detail)) return "";
  const parts: string[] = [];
  for (const entry of detail) {
    if (!entry || typeof entry !== "object") continue;
    const issue = entry as { message?: unknown; path?: unknown };
    if (typeof issue.message !== "string") continue;
    const path = Array.isArray(issue.path) ? issue.path.filter((p) => p !== undefined && p !== null).join(".") : "";
    parts.push(path ? `${path}: ${issue.message}` : issue.message);
  }
  // Two or three field errors read fine inline; beyond that the list becomes the error.
  return parts.slice(0, 3).join("; ") + (parts.length > 3 ? `; and ${parts.length - 3} more` : "");
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
 * Attaches the bearer token, normalizes the backend's `{ error, message, details|issues }` JSON
 * error envelope into a typed ApiError, and clears the session on a 401 so a revoked/expired token
 * bounces the user back to login (handled by the auth provider). Always `cache: "no-store"` —
 * these are live operational tools, not static sites.
 */
export async function request<T>(baseUrl: string, path: string, opts: RequestOptions = {}): Promise<T> {
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

  if (res.status === 401 && !opts.expects401) {
    clearSession();
  }

  if (!res.ok) {
    const envelope = (data ?? {}) as { error?: string; message?: string; details?: unknown; issues?: unknown };
    const detail = envelope.details ?? envelope.issues;
    const message =
      envelope.message ||
      // A zod ValidationError from either backend carries NO `message` — the reasons live in
      // `details`, one entry per bad field. Without this the UI showed the bare word
      // "ValidationError" and threw away the only part a user can act on.
      describeFieldIssues(detail) ||
      envelope.error ||
      (typeof data === "string" && data) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(res.status, message, envelope.error, detail);
  }

  return data as T;
}
