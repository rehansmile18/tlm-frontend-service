"use client";

import { CheckIcon, LayoutGridIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n/i18n";
import { THIS_APP, OTHER_APP_URL } from "@/lib/app-identity";

// Whichever app this build is, its own entry is always "active" regardless of whether the other
// app's url happens to be configured — that url is a real cross-origin navigation, not a Next.js
// route, so only the other entry depends on the env var.
const ALL_APPS = ["ruleRepositoryApp", "siteOperationsApp"] as const;
const APPS = ALL_APPS.map((key) =>
  key === THIS_APP ? { key, url: undefined, active: true } : { key, url: OTHER_APP_URL, active: false }
);

export function AppSwitcher() {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("nav.appSwitcher")} />}>
        <LayoutGridIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("nav.appSwitcher")}</DropdownMenuLabel>
          {APPS.map((app) => (
            <DropdownMenuItem
              key={app.key}
              disabled={app.active || !app.url}
              onClick={() => {
                if (app.url) window.location.assign(app.url);
              }}
              className={`justify-between gap-3 py-2 ${app.active ? "bg-accent" : ""}`}
            >
              <span className={`text-sm ${app.active ? "font-semibold" : "font-medium"}`}>{t(`nav.${app.key}`)}</span>
              {app.active ? <CheckIcon className="size-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
