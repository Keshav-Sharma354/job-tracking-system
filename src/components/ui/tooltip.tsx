"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function TooltipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={
          "z-50 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs font-medium text-foreground shadow-lg " +
          "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 " +
          (className ?? "")
        }
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/** Convenience wrapper: an icon button with an accessible tooltip. */
export function IconTooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
