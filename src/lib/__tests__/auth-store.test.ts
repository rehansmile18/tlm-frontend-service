import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, getToken, getUser, setSession, subscribeSession } from "../auth-store";

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
});
