"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/layout";

/**
 * Segment-level error boundary.
 *
 * Scoped to the authenticated area so a failure inside one page — say the Kanban
 * board — does not take down the whole application shell, and so the sidebar
 * stays navigable while the user recovers.
 */
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Unhandled error in the application area", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg">
      <CardBody className="space-y-4 text-center">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            This page failed to load
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Your data is unaffected. You can retry, or use the sidebar to go
            somewhere else.
          </p>
        </div>

        {error.digest ? (
          <p className="rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs text-subtle">
            Reference: {error.digest}
          </p>
        ) : null}

        <Button onClick={reset}>Try again</Button>
      </CardBody>
    </Card>
  );
}
