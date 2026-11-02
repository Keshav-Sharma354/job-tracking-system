import type { Metadata } from "next";
import { Target } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Sign in · Job Search CRM" },
};

/** Centred shell shared by the sign-in and sign-up screens. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-md">
              <Target className="size-6" strokeWidth={2.5} />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Job Search CRM
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                Applications, contacts and follow-ups in one place.
              </p>
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-6 shadow-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
