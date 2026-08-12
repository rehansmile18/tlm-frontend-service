"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { clientsApi } from "./resources";
import { queryKeys } from "./query-keys";

/**
 * The caller's own client (null for PLATFORM_ADMIN, who spans every client). Drives client-wide
 * settings shown to every user of that client — currently just moduleLabels (per-module display
 * name overrides). Safe to call from multiple places at once: React Query dedupes by query key.
 */
export function useMyClient() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.myClient,
    queryFn: () => clientsApi.me(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}
