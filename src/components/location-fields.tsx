"use client";

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { geoApi, type Location } from "@/lib/resources";
import { useTranslation } from "@/lib/i18n/i18n";

const EMPTY_LOCATION: Location = {
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  country: null,
  postalCode: null,
};

/** Country/state options come from TLM's own /geo/countries catalog (the same source tlm-frontend
 * already uses for Client/Policy jurisdiction pickers) — tlm-frontend-service calls it directly,
 * the same way it already does for Users/Clients, rather than tlm-backend growing its own copy. */
export function LocationFields({
  value,
  onChange,
}: {
  value: Location | null;
  onChange: (next: Location) => void;
}) {
  const { t } = useTranslation();
  const location = value ?? EMPTY_LOCATION;

  const countriesQuery = useQuery({
    queryKey: ["geo", "countries"],
    queryFn: () => geoApi.listCountries(),
    staleTime: Infinity,
  });
  const statesQuery = useQuery({
    queryKey: ["geo", "states", location.country ?? ""],
    queryFn: () => geoApi.listStates(location.country as string),
    enabled: Boolean(location.country),
    staleTime: Infinity,
  });

  function set(patch: Partial<Location>) {
    onChange({ ...location, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="addressLine1">{t("location.addressLine1")}</Label>
          <Input
            id="addressLine1"
            value={location.addressLine1 ?? ""}
            onChange={(e) => set({ addressLine1: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addressLine2">{t("location.addressLine2")}</Label>
          <Input
            id="addressLine2"
            value={location.addressLine2 ?? ""}
            onChange={(e) => set({ addressLine2: e.target.value || null })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="locationCountry">{t("location.country")}</Label>
          <Combobox
            id="locationCountry"
            value={location.country ?? ""}
            onValueChange={(next) => set({ country: next || null, state: null })}
            placeholder={t("common.select")}
          >
            {(countriesQuery.data?.items ?? []).map((country) => (
              <ComboboxItem key={country.isoCode} value={country.isoCode}>
                {country.name}
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="locationState">{t("location.state")}</Label>
          <Combobox
            id="locationState"
            value={location.state ?? ""}
            onValueChange={(next) => set({ state: next || null })}
            placeholder={location.country ? t("common.select") : t("location.selectCountryFirst")}
            disabled={!location.country}
          >
            {(statesQuery.data?.items ?? []).map((state) => (
              <ComboboxItem key={state.isoCode} value={state.isoCode}>
                {state.name}
              </ComboboxItem>
            ))}
          </Combobox>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="locationCity">{t("location.city")}</Label>
          <Input id="locationCity" value={location.city ?? ""} onChange={(e) => set({ city: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="locationPostalCode">{t("location.postalCode")}</Label>
          <Input
            id="locationPostalCode"
            value={location.postalCode ?? ""}
            onChange={(e) => set({ postalCode: e.target.value || null })}
          />
        </div>
      </div>
    </div>
  );
}
