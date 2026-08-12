"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTranslation, type TranslationKey } from "@/lib/i18n/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarNav } from "./sidebar-nav";

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[.\-_+]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheckIcon className="size-4.5" />
      </span>
      {!collapsed ? (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">TLM Site Ops</span>
          <span className="text-[11px] text-muted-foreground">Site Operations</span>
        </span>
      ) : null}
    </Link>
  );
}

const SIDEBAR_COLLAPSED_KEY = "tlm-service.sidebar.collapsed";
const sidebarListeners = new Set<() => void>();

function getSidebarSnapshot(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function subscribeSidebar(listener: () => void): () => void {
  sidebarListeners.add(listener);
  return () => sidebarListeners.delete(listener);
}

function setSidebarCollapsedPersisted(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
  for (const listener of sidebarListeners) listener();
}

/** Persists the collapsed state in localStorage via useSyncExternalStore — hydration-safe by
 * construction (React reconciles the server/client snapshot mismatch itself), no effects needed. */
function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, getSidebarServerSnapshot);
  const setCollapsed = (next: boolean | ((prev: boolean) => boolean)) =>
    setSidebarCollapsedPersisted(typeof next === "function" ? next(getSidebarSnapshot()) : next);
  return [collapsed, setCollapsed] as const;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { t, dir } = useTranslation();
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  // The chevron always points in the direction the panel is about to grow toward — which
  // direction that visually is flips with dir, since the sidebar itself sits on the opposite
  // physical edge in RTL (right) vs LTR (left).
  const willExpandIcon = dir === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const willCollapseIcon = dir === "rtl" ? ChevronRightIcon : ChevronLeftIcon;
  const ToggleIcon = collapsed ? willExpandIcon : willCollapseIcon;

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 flex-col border-e bg-card transition-[width] duration-150 md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center px-2" : "px-5")}>
        <Brand collapsed={collapsed} />
      </div>

      <div className={cn("flex-1 overflow-y-auto overflow-x-hidden p-3", collapsed && "px-2")}>
        <SidebarNav collapsed={collapsed} />
      </div>

      {user ? (
        <>
          <Separator />
          <div className={cn("flex flex-col gap-3 p-4", collapsed && "items-center p-2")}>
            <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {initialsFromEmail(user.email)}
              </span>
              {!collapsed ? (
                <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                  <span className="truncate text-sm font-medium">{user.email}</span>
                  <Badge variant="outline" className="w-fit">
                    {t(`roles.${user.role}` as TranslationKey)}
                  </Badge>
                </div>
              ) : null}
            </div>
            {!collapsed ? (
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={logout}>
                <LogOutIcon className="size-4" />
                {t("common.signOut")}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="outline" size="icon" onClick={logout} aria-label={t("common.signOut")} />
                  }
                >
                  <LogOutIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="inline-end">{t("common.signOut")}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        className="absolute -end-3 top-16 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      >
        <ToggleIcon className="size-3.5" />
      </button>
    </aside>
  );
}
