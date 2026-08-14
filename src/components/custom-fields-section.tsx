"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanizeError } from "@/components/data-state";
import { useTranslation } from "@/lib/i18n/i18n";
import type { CustomFields } from "@/lib/resources";

interface CustomFieldDefinitionLike {
  _id: string;
  name: string;
}

/** Generic over which per-client catalog backs it (site vs employee) — pass in that catalog's own
 * list/create API functions and query key so this stays a single shared component instead of two
 * near-identical copies. */
export function CustomFieldsSection({
  clientId,
  value,
  onChange,
  queryKey,
  listDefinitions,
  createDefinition,
}: {
  clientId: string;
  value: CustomFields | null;
  onChange: (next: CustomFields) => void;
  queryKey: unknown[];
  listDefinitions: (clientId: string) => Promise<{ items: CustomFieldDefinitionLike[] }>;
  createDefinition: (clientId: string, name: string) => Promise<CustomFieldDefinitionLike>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newFieldName, setNewFieldName] = useState("");

  const definitionsQuery = useQuery({
    queryKey,
    queryFn: () => listDefinitions(clientId),
    enabled: Boolean(clientId),
  });
  const definitions = definitionsQuery.data?.items ?? [];
  const values = value ?? {};

  const createMutation = useMutation({
    mutationFn: (name: string) => createDefinition(clientId, name),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey });
      setNewFieldName("");
      onChange({ ...values, [created.name]: "" });
    },
    onError: (error) => toast.error(t("customFields.couldntAdd"), { description: humanizeError(error) }),
  });

  function setFieldValue(name: string, fieldValue: string) {
    onChange({ ...values, [name]: fieldValue });
  }

  return (
    <div className="space-y-3">
      {!clientId ? (
        <p className="text-xs text-muted-foreground">{t("customFields.selectClientFirst")}</p>
      ) : definitions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("customFields.none")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {definitions.map((def) => (
            <div key={def._id} className="space-y-1.5">
              <Label htmlFor={`customField-${def._id}`}>{def.name}</Label>
              <Input
                id={`customField-${def._id}`}
                value={values[def.name] ?? ""}
                onChange={(e) => setFieldValue(def.name, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t pt-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="newCustomFieldName">{t("customFields.addFieldLabel")}</Label>
          <Input
            id="newCustomFieldName"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder={t("customFields.addFieldPlaceholder")}
            disabled={!clientId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!clientId || !newFieldName.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate(newFieldName.trim())}
        >
          <PlusIcon className="size-4" />
          {t("customFields.addField")}
        </Button>
      </div>
    </div>
  );
}
