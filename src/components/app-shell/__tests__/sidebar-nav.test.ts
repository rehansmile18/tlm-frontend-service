import { describe, expect, it } from "vitest";
import { isNavItemVisible, NAV_ITEMS } from "../sidebar-nav";
import type { SessionUser } from "@/lib/auth-store";

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: "u1",
    email: "a@b.c",
    role: "SITE_MANAGER",
    clientId: "c1",
    siteIds: ["SITE-1"],
    permissions: [],
    ...overrides,
  };
}

function itemFor(href: string) {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`no nav item for ${href}`);
  return item;
}

describe("isNavItemVisible", () => {
  it("hides everything when there's no user", () => {
    for (const item of NAV_ITEMS) {
      expect(isNavItemVisible(item, null)).toBe(false);
    }
  });

  it("always shows items with no permissionKey/roles gate (dashboard, profile)", () => {
    const viewer = makeUser({ role: "VIEWER" });
    expect(isNavItemVisible(itemFor("/dashboard"), viewer)).toBe(true);
    expect(isNavItemVisible(itemFor("/profile"), viewer)).toBe(true);
  });

  it("gates a permission-keyed item on the user's permissions, unless PLATFORM_ADMIN", () => {
    const employeesItem = itemFor("/employees");
    const withoutPermission = makeUser({ role: "CLIENT_ADMIN", permissions: [] });
    const withPermission = makeUser({ role: "CLIENT_ADMIN", permissions: ["employee:read"] });
    const admin = makeUser({ role: "PLATFORM_ADMIN", permissions: [] });

    expect(isNavItemVisible(employeesItem, withoutPermission)).toBe(false);
    expect(isNavItemVisible(employeesItem, withPermission)).toBe(true);
    expect(isNavItemVisible(employeesItem, admin)).toBe(true);
  });

  it("gates Team & Permissions on role alone, deliberately not permission-delegable", () => {
    const teamItem = itemFor("/team");
    const clientAdmin = makeUser({ role: "CLIENT_ADMIN", permissions: [] });
    const siteManagerWithEveryPermission = makeUser({
      role: "SITE_MANAGER",
      permissions: ["employee:read", "site:read", "schedule:read"],
    });

    expect(isNavItemVisible(teamItem, clientAdmin)).toBe(true);
    expect(isNavItemVisible(teamItem, siteManagerWithEveryPermission)).toBe(false);
  });
});
