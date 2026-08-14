"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { DateFormatProvider } from "@/lib/date-format";
import { I18nProvider } from "@/lib/i18n/i18n";

export function Providers({ children }: { children: ReactNode }) {
  // Stable across renders (created once via useState's lazy initializer), matching the standard
  // Next.js App Router react-query setup — a module-level singleton would leak state across
  // requests on the server, so it must be created inside the component instead.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DateFormatProvider>
            <I18nProvider>{children}</I18nProvider>
          </DateFormatProvider>
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
