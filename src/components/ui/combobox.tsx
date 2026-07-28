"use client";

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

export interface ComboboxItemProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Declarative option, mirroring `<option>` for a near drop-in swap from NativeSelect. Combobox
 * reads `value`/`disabled`/`children` off these at render time — it never mounts one directly.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- marker component; Combobox reads props off the element itself, never renders this
export function ComboboxItem(_props: ComboboxItemProps): null {
  return null;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Classes for the OUTER wrapper div — the actual flex/grid item in the caller's layout. */
  wrapperClassName?: string;
  "aria-label"?: string;
  children: ReactNode;
}

/**
 * A styled dropdown built on the Menu primitive (the same one powering the profile menu), used
 * instead of a native <select> so the option list is positioned by real DOM measurement
 * (floating-ui via Base UI) rather than each browser's own, inconsistent <select> heuristic —
 * that inconsistency (occasionally opening upward even with room below) is exactly what this
 * replaces. Defaults to opening below the trigger, flipping only when there's genuinely no room.
 */
export function Combobox({
  value,
  onValueChange,
  placeholder,
  disabled,
  id,
  className,
  wrapperClassName,
  children,
  ...aria
}: ComboboxProps) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<ComboboxItemProps>[];
  const selected = items.find((item) => item.props.value === value);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          id={id}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:border-ring dark:bg-input/30",
            className
          )}
          {...aria}
        >
          <span className={cn("truncate text-start", !selected && "text-muted-foreground")}>
            {selected ? selected.props.children : (placeholder ?? "Select…")}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="max-h-72 w-(--anchor-width) min-w-(--anchor-width) overflow-y-auto">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.props.value}
              disabled={item.props.disabled}
              onClick={() => onValueChange(item.props.value)}
              className="justify-between"
            >
              <span className="truncate">{item.props.children}</span>
              {item.props.value === value ? <CheckIcon className="size-3.5 shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
