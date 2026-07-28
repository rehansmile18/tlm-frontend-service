"use client";

import Link from "next/link";
import { LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-store";
import { useTranslation } from "@/lib/i18n/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";

// No `roles.*` entries exist in the translation dictionaries (only nav/common/auth/profile), so
// role display labels are a small local lookup rather than routed through t().
export const ROLE_LABELS: Record<SessionUser["role"], string> = {
  PLATFORM_ADMIN: "Platform Admin",
  CLIENT_ADMIN: "Client Admin",
  SITE_MANAGER: "Site Manager",
  VIEWER: "Viewer",
};

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[.\-_+]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
}

export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheckIcon className="size-4.5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">TLM Site Ops</span>
        <span className="text-[11px] text-muted-foreground">Site Operations</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e bg-card md:flex">
      <div className="flex h-16 items-center border-b px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <SidebarNav />
      </div>

      {user ? (
        <>
          <Separator />
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {initialsFromEmail(user.email)}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                <span className="truncate text-sm font-medium">{user.email}</span>
                <Badge variant="outline" className="w-fit">
                  {ROLE_LABELS[user.role]}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" className="justify-start gap-2" onClick={logout}>
              <LogOutIcon className="size-4" />
              {t("common.signOut")}
            </Button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
