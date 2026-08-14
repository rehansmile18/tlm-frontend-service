"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { clientsApi, geoApi, type Location } from "./resources";
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

/** Resolves a stored Location's ISO country/state codes to display names via TLM's geo catalog —
 * shared by every detail page that shows a Location read-only (the edit form does its own
 * resolution live via LocationFields; this is the read-only counterpart). */
export function useLocationSummary(location: Location | null | undefined) {
  const countriesQuery = useQuery({
    queryKey: ["geo", "countries"],
    queryFn: () => geoApi.listCountries(),
    staleTime: Infinity,
    enabled: Boolean(location?.country),
  });
  const statesQuery = useQuery({
    queryKey: ["geo", "states", location?.country ?? ""],
    queryFn: () => geoApi.listStates(location!.country as string),
    enabled: Boolean(location?.country),
    staleTime: Infinity,
  });

  const countryName = location?.country
    ? (countriesQuery.data?.items.find((c) => c.isoCode === location.country)?.name ?? location.country)
    : null;
  const stateName = location?.state
    ? (statesQuery.data?.items.find((s) => s.isoCode === location.state)?.name ?? location.state)
    : null;

  const hasAnyLocationData = Boolean(
    location &&
      (location.addressLine1 || location.addressLine2 || location.city || location.state || location.country || location.postalCode)
  );

  return { countryName, stateName, hasAnyLocationData };
}
