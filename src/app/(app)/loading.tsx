import { Suspense } from "react";
import { Card, CardBody } from "@/components/ui/layout";

/** Skeleton shown while a page's data is still loading. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-sunken" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-card border border-border bg-surface-sunken"
          />
        ))}
      </div>
      <Card>
        <CardBody>
          <Suspense fallback={null}>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-surface-sunken"
                />
              ))}
            </div>
          </Suspense>
        </CardBody>
      </Card>
    </div>
  );
}
