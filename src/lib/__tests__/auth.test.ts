import { describe, expect, it } from "vitest";
import { hasPermission } from "../auth";
import type { SessionUser } from "../auth-store";

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: "u1",
    email: "a@b.c",
    role: "CLIENT_ADMIN",
    clientId: "c1",
    siteIds: [],
    permissions: [],
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("returns false for no user", () => {
    expect(hasPermission(null, "employee:read")).toBe(false);
  });

  it("PLATFORM_ADMIN bypasses every permission check, mirroring tlm-backend's requirePermission", () => {
    const admin = makeUser({ role: "PLATFORM_ADMIN", permissions: [] });
    expect(hasPermission(admin, "employee:read")).toBe(true);
    expect(hasPermission(admin, "anything:not-in-the-catalog")).toBe(true);
  });

  it("grants access only when the permission key is explicitly present", () => {
    const user = makeUser({ role: "SITE_MANAGER", permissions: ["schedule:read", "punch:write"] });
    expect(hasPermission(user, "schedule:read")).toBe(true);
    expect(hasPermission(user, "punch:write")).toBe(true);
    expect(hasPermission(user, "employee:write")).toBe(false);
  });

  it("denies access for a non-admin with no permissions granted", () => {
    const viewer = makeUser({ role: "VIEWER", permissions: [] });
    expect(hasPermission(viewer, "employee:read")).toBe(false);
  });
});
