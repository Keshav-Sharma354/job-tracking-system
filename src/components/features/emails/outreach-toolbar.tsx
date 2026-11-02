"use client";

import Link from "next/link";
import { Mail, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EMAIL_STATUS_LABELS } from "@/lib/constants";

/** Status filter chips with live counts from the database. */
export function OutreachToolbar({ counts }: { counts: Record<string, number> }) {
  const statuses = ["DRAFT", "SENT", "REPLIED", "FAILED", "BOUNCED"] as const;

  return (
    <nav aria-label="Outreach filters" className="flex flex-wrap gap-1.5">
      <Chip href="/emails" label="All" activeIcon={<Mail className="size-3.5" />} />
      {statuses.map((status) => (
        <Chip
          key={status}
          href={`/emails?status=${status}`}
          label={EMAIL_STATUS_LABELS[status]}
          count={counts[status] ?? 0}
          activeIcon={
            status === "REPLIED" ? (
              <MailOpen className="size-3.5" />
            ) : (
              <Mail className="size-3.5" />
            )
          }
        />
      ))}
    </nav>
  );
}

function Chip({
  href,
  label,
  count,
  activeIcon,
}: {
  href: string;
  label: string;
  count?: number;
  activeIcon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
        "ring-border text-muted hover:bg-surface-hover hover:text-foreground",
        "aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:ring-transparent",
      )}
    >
      {activeIcon}
      {label}
      {count !== undefined ? (
        <span className="tabular-nums opacity-70">{count}</span>
      ) : null}
    </Link>
  );
}
