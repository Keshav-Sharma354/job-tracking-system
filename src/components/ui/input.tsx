import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, type = "text", invalid, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    aria-invalid={invalid || undefined}
    className={cn(
      "flex h-9 w-full rounded-lg bg-surface px-3 py-1 text-sm text-foreground shadow-sm",
      "ring-1 ring-inset ring-input transition-shadow",
      "placeholder:text-subtle",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-sunken",
      "aria-invalid:ring-destructive aria-invalid:focus-visible:ring-destructive",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "flex w-full rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm",
      "ring-1 ring-inset ring-input transition-shadow",
      "placeholder:text-subtle",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-sunken",
      "aria-invalid:ring-destructive aria-invalid:focus-visible:ring-destructive",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Native `<select>` styled to match Input; avoids a portal for long lists. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-9 w-full appearance-none rounded-lg bg-surface py-1 pl-3 pr-9 text-sm text-foreground shadow-sm",
        "ring-1 ring-inset ring-input transition-shadow",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-sunken",
        "aria-invalid:ring-destructive aria-invalid:focus-visible:ring-destructive",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
));
Select.displayName = "Select";
