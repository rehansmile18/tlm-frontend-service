"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TONE_CLASSES, type BadgeTone } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/i18n";

/**
 * One step of the guided setup. Every step reports the same four states so the whole flow reads at
 * a glance, and the body stays collapsed until it is the step that needs work — a wizard that
 * expands everything at once is just a long form with headings.
 */
export type StepState = "done" | "attention" | "todo" | "blocked";

const STATE_TONE: Record<StepState, BadgeTone> = {
  done: "success",
  attention: "warning",
  todo: "neutral",
  blocked: "danger",
};

const STATE_ICON: Record<StepState, typeof CheckIcon> = {
  done: CheckIcon,
  attention: TriangleAlertIcon,
  todo: CircleDashedIcon,
  blocked: CircleAlertIcon,
};

export function SetupStepCard({
  index,
  title,
  description,
  state,
  summary,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
  footer,
  children,
}: {
  index: number;
  title: string;
  description: string;
  state: StepState;
  /** One line of current fact, e.g. "3 sites". Shown collapsed, so progress is visible unopened. */
  summary?: string;
  defaultOpen?: boolean;
  /**
   * Optional controlled mode. Supplied together, these let a parent steer which step is open —
   * used to walk the user forward from one step to the next. Left out, the card manages itself,
   * so every existing usage is unaffected.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rendered under the body, e.g. a "continue to the next step" action. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(Boolean(defaultOpen));
  const open = controlledOpen ?? uncontrolledOpen;
  const toggle = () => {
    if (onOpenChange) onOpenChange(!open);
    else setUncontrolledOpen((v) => !v);
  };
  const Icon = STATE_ICON[state];
  const panelId = `setup-step-${index}-panel`;

  return (
    <Card className={state === "blocked" ? "border-destructive/40" : undefined}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-start gap-4 px-5 py-4 text-left"
        >
          <span
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              state === "done" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"
            }`}
          >
            {state === "done" ? <CheckIcon className="size-4" /> : index}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{title}</span>
              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASSES[STATE_TONE[state]]}`}>
                {t(`setup.state.${state}`)}
              </span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
            {summary ? (
              <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Icon className="size-3.5" />
                {summary}
              </span>
            ) : null}
          </span>
          <ChevronDownIcon className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? (
          <div id={panelId} role="region" aria-label={title} className="border-t px-5 py-4">
            {children}
            {footer ? <div className="mt-4 border-t pt-3">{footer}</div> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The findings the readiness report returns for a step, rendered as plain remedial advice. */
export function SetupFindings({ findings }: { findings: { code: string; severity: string; title: string; count: number; sample: string[]; fix: string }[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="mb-4 space-y-2">
      {findings.map((f) => (
        <li
          key={f.code}
          className={`rounded-lg border-l-2 bg-muted/40 px-3 py-2 text-sm ${
            f.severity === "blocked" ? "border-l-destructive" : "border-l-amber-500"
          }`}
        >
          <p className="font-medium">
            {f.title}
            {f.count > 0 ? <span className="text-muted-foreground"> · {f.count}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{f.fix}</p>
          {f.sample.length > 0 ? (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{f.sample.join(", ")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
