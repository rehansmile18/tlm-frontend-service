"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ClockIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapPinIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, useAuth } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-store";
import { useTranslation, type TranslationKey } from "@/lib/i18n/i18n";

type Role = SessionUser["role"];

export interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Fine-grained permission key required to see this item, checked via hasPermission(). */
  permissionKey?: string;
  /** Restricts visibility to specific roles. Combined with permissionKey (both must pass) when
   * an item declares both; "Team & Permissions" below is the one role-only case. */
  roles?: Role[];
}

// Flat list (mirrors tlm-frontend's own NAV shape, which has no section grouping either).
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboardIcon },
  { href: "/employees", labelKey: "nav.employees", icon: UsersIcon, permissionKey: "employee:read" },
  { href: "/sites", labelKey: "nav.sites", icon: MapPinIcon, permissionKey: "site:read" },
  { href: "/tasks", labelKey: "nav.tasks", icon: ListChecksIcon, permissionKey: "task:read" },
  {
    href: "/pay-period-configs",
    labelKey: "nav.payPeriodConfigs",
    icon: CalendarClockIcon,
    permissionKey: "payPeriodConfig:read",
  },
  {
    href: "/payroll-calendars",
    labelKey: "nav.payrollCalendars",
    icon: CalendarDaysIcon,
    permissionKey: "payrollCalendar:read",
  },
  { href: "/schedule", labelKey: "nav.schedule", icon: CalendarIcon, permissionKey: "schedule:read" },
  { href: "/punches", labelKey: "nav.punches", icon: ClockIcon, permissionKey: "punch:read" },
  { href: "/timesheets", labelKey: "nav.timesheets", icon: ReceiptTextIcon, permissionKey: "timesheet:read" },
  // Deliberately role-gated only: managing other users' permissions is not itself a delegable
  // permission in this system, so PLATFORM_ADMIN/CLIENT_ADMIN is checked directly, not via
  // hasPermission().
  { href: "/team", labelKey: "nav.team", icon: ShieldCheckIcon, roles: ["PLATFORM_ADMIN", "CLIENT_ADMIN"] },
  { href: "/profile", labelKey: "nav.profile", icon: UserCircleIcon },
];

export function isNavItemVisible(item: NavItem, user: SessionUser | null): boolean {
  if (!user) return false;
  if (item.roles && !item.roles.includes(user.role)) return false;
  if (item.permissionKey && !hasPermission(user, item.permissionKey)) return false;
  return true;
}

/** Shared nav list rendered inside both the desktop Sidebar and the mobile Sheet drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();
  const items = NAV_ITEMS.filter((item) => isNavItemVisible(item, user));

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
