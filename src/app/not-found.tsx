import Link from "next/link";
import { Card, CardBody } from "@/components/ui/layout";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardBody className="space-y-4 text-center">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
              404
            </p>
            <h1 className="mt-1 text-lg font-semibold text-foreground">
              We couldn&apos;t find that
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              The record may have been deleted, or the link may be out of date.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
            >
              Dashboard
            </Link>
            <Link
              href="/search"
              className="inline-flex h-9 items-center rounded-lg bg-surface px-3.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border-strong transition-colors hover:bg-surface-hover"
            >
              Search
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
