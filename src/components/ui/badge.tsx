import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { labelTone } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral:
          "bg-surface-sunken text-muted ring-border",
        accent: "bg-accent-subtle text-accent ring-accent/25",
        success: "bg-success-subtle text-success ring-success/25",
        warning: "bg-warning-subtle text-warning ring-warning/30",
        danger: "bg-destructive-subtle text-destructive ring-destructive/25",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/**
 * A pill for a status.
 *
 * Accepts either an explicit palette (`className`, used by the status metadata
 * in `@/lib/constants` so a stage always looks the same everywhere) or a
 * semantic `tone`.
 */
export function StatusBadge({
  label,
  className,
  tone,
}: {
  label: string;
  className?: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset whitespace-nowrap",
        className ?? badgeVariants({ tone }),
      )}
    >
      {label}
    </span>
  );
}

/** A pill for a free-form label (tag, company, industry) with a stable colour. */
export function LabelBadge({
  children,
  seed,
  className,
}: {
  children: React.ReactNode;
  seed?: string;
  className?: string;
}) {
  const tone = labelTone(seed ?? String(children));
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset",
        tone,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small circular monogram for contacts and companies. */
export function Avatar({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const letters =
    label
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ring-1 ring-inset",
        labelTone(label),
        className,
      )}
    >
      {letters}
    </span>
  );
}

export { badgeVariants };
