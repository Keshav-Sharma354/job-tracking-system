"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/layout";

/**
 * Root error boundary.
 *
 * `reset` re-renders the tree without a full reload, which recovers from most
 * transient failures. The digest is displayed because it is the only handle a
 * user has for correlating a client-side error with server logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    // Surface the error where your monitoring picks it up.
    console.error("Unhandled application error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="max-w-lg">
        <CardBody className="space-y-4 text-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              The page could not be rendered. Trying again often fixes it.
            </p>
          </div>

          {error.digest ? (
            <p className="rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs text-subtle">
              Reference: {error.digest}
            </p>
          ) : null}

          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}>
              Try again
            </Button>
            <Button onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
