"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { clientsApi } from "@/lib/resources";
import { useAuth, useRole } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/i18n";

/**
 * Resolves which client a record belongs to. Every CLIENT_ADMIN/SITE_MANAGER session already
 * carries its own clientId; PLATFORM_ADMIN has none (they operate across every client), so
 * creating a NEW record needs an explicit picker. Editing an EXISTING record never does — pass
 * its own clientId and this returns it fixed, since clientId isn't editable after creation
 * anywhere in this app. Render the returned `picker` right in the form; it's null whenever no
 * picker is needed (editing, or a non-platform-admin session already scoped to one client).
 */
export function useEditableClientId(existingClientId?: string | null): { clientId: string; picker: ReactNode } {
  const { user } = useAuth();
  const { isPlatformAdmin } = useRole();
  const [selected, setSelected] = useState("");

  if (existingClientId) {
    return { clientId: existingClientId, picker: null };
  }
  if (!isPlatformAdmin) {
    return { clientId: user?.clientId ?? "", picker: null };
  }
  return { clientId: selected, picker: <ClientPickerField value={selected} onChange={setSelected} /> };
}

function ClientPickerField({ value, onChange }: { value: string; onChange: (clientId: string) => void }) {
  const { t } = useTranslation();
  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: () => clientsApi.list() });

  return (
    <div className="space-y-1.5">
      <Label htmlFor="clientPicker">{t("moduleNames.selectClient")}</Label>
      {clientsQuery.isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <Combobox id="clientPicker" value={value} onValueChange={onChange} placeholder={t("moduleNames.selectClientPlaceholder")}>
          {(clientsQuery.data?.items ?? []).map((client) => (
            <ComboboxItem key={client._id} value={client._id}>
              {client.name}
            </ComboboxItem>
          ))}
        </Combobox>
      )}
    </div>
  );
}
