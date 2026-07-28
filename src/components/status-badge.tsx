import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type BadgeTone } from "@/lib/format";

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
