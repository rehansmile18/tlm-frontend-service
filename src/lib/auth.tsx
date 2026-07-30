"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "./resources";
import { clearSession, getUserSnapshot, setSession, subscribeSession, type SessionUser } from "./auth-store";

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Session lives in localStorage; subscribe to it as an external store so reads are consistent
  // across tabs and hydration-safe. auth-store doesn't export a separate server-snapshot getter
  // (it's a client-only module), so the server snapshot is inlined here as a constant `null`.
  const user = useSyncExternalStore(subscribeSession, getUserSnapshot, () => null);

  // Gate route guards until after mount so an authenticated user isn't bounced to /login during
  // the initial (server-snapshot) render, before localStorage has been read.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration flag
    setMounted(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    // login's own response is thin (role/clientId only, per TLM's /auth/login). Seed the session
    // immediately so a bearer token exists for the authApi.me() call below, then upgrade it to
    // the full profile (siteIds/permissions/status) before returning, so nothing downstream ever
    // observes a session with an incomplete permission set.
    //
    // `role` comes back as a plain `string` over the wire (resources.ts doesn't know about
    // SessionUser's stricter union) — this is the trust boundary where we narrow it, since TLM is
    // the sole issuer of that field and only ever emits one of the four known roles.
    setSession(res.token, { ...res.user, role: res.user.role as SessionUser["role"], siteIds: [], permissions: [] });
    const fullProfile = await authApi.me();
    setSession(res.token, { ...fullProfile, role: fullProfile.role as SessionUser["role"] });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    // Drop every cached query so no previous session's data (policies, rule groups, users, …)
    // can flash or linger into whichever session logs in next.
    queryClient.clear();
    // A hard redirect, not router.replace: it guarantees a full reset (no reliance on every
    // consumer correctly reacting to the store change) and can't be raced by in-flight requests
    // or lingering component state from the authenticated app shell.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    } else {
      router.replace("/login");
    }
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: Boolean(user), isReady: mounted, login, logout }),
    [user, mounted, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export interface RoleInfo {
  role: SessionUser["role"] | undefined;
  clientId: string | null;
  siteIds: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
  isClientAdmin: boolean;
  isSiteManager: boolean;
  isViewer: boolean;
}

export function useRole(): RoleInfo {
  const { user } = useAuth();
  const role = user?.role;
  return {
    role,
    clientId: user?.clientId ?? null,
    siteIds: user?.siteIds ?? [],
    permissions: user?.permissions ?? [],
    isPlatformAdmin: role === "PLATFORM_ADMIN",
    isClientAdmin: role === "CLIENT_ADMIN",
    isSiteManager: role === "SITE_MANAGER",
    isViewer: role === "VIEWER",
  };
}

/**
 * Mirrors tlm-backend's own `requirePermission` bypass logic: PLATFORM_ADMIN always passes every
 * check, everyone else needs the permission key explicitly granted. Used to hide/disable nav
 * items and action buttons based on fine-grained permission, not just coarse role.
 */
export function hasPermission(user: SessionUser | null, key: string): boolean {
  if (!user) return false;
  if (user.role === "PLATFORM_ADMIN") return true;
  return user.permissions.includes(key);
}
