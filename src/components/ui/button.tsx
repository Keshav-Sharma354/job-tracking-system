import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium " +
    "transition-[background-color,color,border-color,box-shadow,transform] duration-150 " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 " +
    "active:translate-y-px select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover focus-visible:outline-accent",
        secondary:
          "bg-surface text-foreground ring-1 ring-border-strong shadow-sm hover:bg-surface-hover",
        ghost: "text-muted hover:bg-surface-hover hover:text-foreground",
        danger:
          "bg-destructive text-white shadow-sm hover:brightness-110 focus-visible:outline-destructive",
        "danger-ghost":
          "text-destructive hover:bg-destructive-subtle focus-visible:outline-destructive",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        md: "h-9 px-3.5 [&_svg]:size-4",
        lg: "h-11 px-5 text-[0.9375rem] [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables interaction while an action is in flight. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading, children, disabled, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    /*
     * Radix's `Slot` merges props onto exactly one child element, so the `asChild`
     * branch forwards `children` untouched — the caller owns the entire content,
     * including any icon. Passing the loading spinner alongside would give Slot
     * two children and it would throw at render time.
     */
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} aria-busy={loading || undefined} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
