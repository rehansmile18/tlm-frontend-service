"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { humanizeError } from "@/components/data-state";
import { timesheetsApi, type Timesheet } from "@/lib/resources";
import { queryKeys } from "@/lib/query-keys";
import { useTranslation } from "@/lib/i18n/i18n";

const voidFormSchema = z.object({
  reason: z.string().min(1),
});

type VoidFormValues = z.infer<typeof voidFormSchema>;

function VoidTimesheetForm({ timesheet, onDone }: { timesheet: Timesheet; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<VoidFormValues>({
    resolver: zodResolver(voidFormSchema),
    defaultValues: { reason: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: VoidFormValues) => timesheetsApi.void(timesheet._id, values.reason),
    onSuccess: () => {
      toast.success(t("timesheets.voided"));
      // Loose prefix invalidation: matches every ["timesheets", ...params] list query, not just
      // whichever filters the list page happens to be showing right now.
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.timesheet(timesheet._id) });
      onDone();
    },
    onError: (error) => {
      toast.error(t("timesheets.couldntVoid"), { description: humanizeError(error) });
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reason">{t("timesheets.voidReason")}</Label>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Textarea
              id="reason"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={Boolean(errors.reason)}
            />
          )}
        />
        {errors.reason ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>

      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {t("timesheets.voidTimesheet")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function VoidTimesheetDialog({
  timesheet,
  open,
  onOpenChange,
}: {
  timesheet: Timesheet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("timesheets.voidTimesheet")}</DialogTitle>
          <DialogDescription>{t("timesheets.voidConfirmDescription")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <VoidTimesheetForm key={timesheet._id} timesheet={timesheet} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
