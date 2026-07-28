// Session persistence. The JWT is a bearer token issued by TLM (the single auth authority for
// every user of this app); we keep it in localStorage so a page reload stays logged in, and
// mirror the richer SessionUser record resolved from TLM's login/me responses. This is a
// client-only module — every accessor guards against server-side rendering. Pub/sub via a
// listener Set lets the OTHER agent's auth.tsx drive React state off this store with
// useSyncExternalStore.

const TOKEN_KEY = "tlmSiteOps.token";
const USER_KEY = "tlmSiteOps.user";

export interface SessionUser {
  userId: string;
  email: string;
  role: "PLATFORM_ADMIN" | "CLIENT_ADMIN" | "VIEWER" | "SITE_MANAGER";
  clientId: string | null;
  siteIds: string[];
  permissions: string[];
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const l of listeners) l();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function safeParse(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(USER_KEY));
}

export function setSession(token: string, user: SessionUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  emit();
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  emit();
}
