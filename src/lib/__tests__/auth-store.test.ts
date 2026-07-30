import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, getToken, getUser, getUserSnapshot, setSession, subscribeSession } from "../auth-store";

const user = {
  userId: "u1",
  email: "a@b.c",
  role: "CLIENT_ADMIN" as const,
  clientId: "c1",
  siteIds: ["SITE-1"],
  permissions: ["employee:read"],
};

describe("auth-store", () => {
  afterEach(() => {
    clearSession();
    localStorage.clear();
  });

  it("persists and reads the token and user", () => {
    setSession("t", user);
    expect(getToken()).toBe("t");
    expect(getUser()).toEqual(user);
  });

  it("notifies subscribers on session changes", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeSession(cb);

    setSession("t", user);
    expect(cb).toHaveBeenCalledTimes(1);

    clearSession();
    expect(cb).toHaveBeenCalledTimes(2);

    unsubscribe();
    setSession("t2", user);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("clears both the token and the user", () => {
    setSession("t", user);
    clearSession();
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("returns null for a corrupted user record instead of throwing", () => {
    localStorage.setItem("tlmSiteOps.user", "{not json");
    expect(getUser()).toBeNull();
  });

  // Regression test: getUserSnapshot() is the getSnapshot passed to useSyncExternalStore, which
  // requires a referentially stable return value between calls when the underlying data hasn't
  // changed. getUser() re-parses JSON on every call (a fresh object each time), which is fine for
  // a one-off read but causes an infinite render loop when used as a snapshot getter directly —
  // this bug shipped and broke the app immediately after login until it was caught by browser
  // testing, since no unit test covered snapshot stability.
  it("returns a stable snapshot reference until the value changes", () => {
    setSession("t", user);
    const first = getUserSnapshot();
    const second = getUserSnapshot();
    expect(first).toBe(second);

    setSession("t", { ...user, permissions: ["employee:read", "site:read"] });
    const third = getUserSnapshot();
    expect(third).not.toBe(second);
    expect(third).toEqual({ ...user, permissions: ["employee:read", "site:read"] });
  });
});
