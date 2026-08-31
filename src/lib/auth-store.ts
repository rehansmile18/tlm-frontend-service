import { createAuthStore } from "./auth-store-core";

/**
 * The session user this app stores. Richer than the sibling frontend's, because site-scoped
 * authorization decisions (which sites a SITE_MANAGER may read) are made in the UI here.
 */
export interface SessionUser {
  userId: string;
  email: string;
  role: "PLATFORM_ADMIN" | "CLIENT_ADMIN" | "VIEWER" | "SITE_MANAGER";
  clientId: string | null;
  siteIds: string[];
  permissions: string[];
}

// "tlmSiteOps.*" is already in users' browsers — changing the prefix would sign everyone out.
const store = createAuthStore<SessionUser>("tlmSiteOps");

export const subscribeSession = store.subscribeSession;
export const getToken = store.getToken;
export const getUser = store.getUser;
export const getUserSnapshot = store.getUserSnapshot;
export const getServerUserSnapshot = store.getServerUserSnapshot;
export const setSession = store.setSession;
export const clearSession = store.clearSession;
