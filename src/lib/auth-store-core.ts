/**
 * Session persistence, with the storage keys and the stored user's shape left as parameters.
 *
 * The JWT is a bearer token issued by TLM (the single auth authority for both frontends); it is
 * kept in localStorage so a page reload stays logged in, alongside the user record resolved from
 * the login response. This is a client-only module — every accessor guards against server-side
 * rendering.
 *
 * The two apps differ in exactly two ways here: the localStorage key prefix (they must not share
 * a slot when served from one origin, and the prefixes are already in users' browsers so they are
 * not safe to change) and the shape of the user they store — the operations app additionally
 * carries siteIds and permissions. Both are parameters below, so the mechanics stay byte-identical
 * across the repos (see shared-files.json) rather than being forked over a key name.
 */

type Listener = () => void;

export interface AuthStore<TUser> {
  subscribeSession(listener: Listener): () => void;
  getToken(): string | null;
  /** Reads and re-parses on every call. Fine for a one-off read; use getUserSnapshot in React. */
  getUser(): TUser | null;
  /**
   * Snapshot for useSyncExternalStore, which requires a stable reference between calls when the
   * underlying value hasn't changed — React compares with Object.is and would otherwise re-render
   * forever, since getUser() returns a freshly parsed object every time.
   */
  getUserSnapshot(): TUser | null;
  /** Server snapshot for useSyncExternalStore: there is no session during SSR. */
  getServerUserSnapshot(): TUser | null;
  setSession(token: string, user: TUser): void;
  clearSession(): void;
}

export function createAuthStore<TUser>(keyPrefix: string): AuthStore<TUser> {
  const TOKEN_KEY = `${keyPrefix}.token`;
  const USER_KEY = `${keyPrefix}.user`;

  const listeners = new Set<Listener>();
  const emit = (): void => {
    for (const l of listeners) l();
  };

  function safeParse(raw: string | null): TUser | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TUser;
    } catch {
      return null;
    }
  }

  let cachedRaw: string | null = null;
  let cachedUser: TUser | null = null;

  return {
    subscribeSession(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getToken() {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(TOKEN_KEY);
    },

    getUser() {
      if (typeof window === "undefined") return null;
      return safeParse(window.localStorage.getItem(USER_KEY));
    },

    getUserSnapshot() {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(USER_KEY);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedUser = safeParse(raw);
      }
      return cachedUser;
    },

    getServerUserSnapshot() {
      return null;
    },

    setSession(token, user) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      emit();
    },

    clearSession() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      emit();
    },
  };
}
