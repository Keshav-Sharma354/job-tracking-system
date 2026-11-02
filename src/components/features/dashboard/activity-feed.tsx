import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/date";
import { ActivityAction, ActivityEntity } from "@/lib/constants";
import {
  ArrowRight,
  CircleDot,
  FileText,
  Mail,
  MailCheck,
  MailPlus,
  Pencil,
  PlusCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import type { ActivityItem } from "@/server/repo/activity";

const ICONS: Record<ActivityEntity, React.ComponentType<{ className?: string }>> = {
  JOB: FileText,
  CONTACT: CircleDot,
  COMPANY: PlusCircle,
  EMAIL: Mail,
  TEMPLATE: FileText,
  TASK: CheckCircle2,
  NOTE: Pencil,
  RESUME: FileText,
};

const ACTION_STYLE: Record<ActivityAction, string> = {
  CREATED: "text-success",
  UPDATED: "text-muted",
  DELETED: "text-destructive",
  STATUS_CHANGED: "text-accent",
  EMAIL_SENT: "text-accent",
  EMAIL_REPLIED: "text-success",
  TASK_COMPLETED: "text-success",
  NOTE_ADDED: "text-warning",
  IMPORTED: "text-accent",
};

/** Reverse-chronological log of everything the user has done. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const Icon =
          item.action === "EMAIL_SENT"
            ? MailPlus
            : item.action === "EMAIL_REPLIED"
              ? MailCheck
              : item.action === "DELETED"
                ? Trash2
                : ICONS[item.entityType];

        return (
          <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken ring-1 ring-border",
                ACTION_STYLE[item.action],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{item.summary}</p>
              <p className="text-xs text-subtle">
                {formatDateTime(item.createdAt)}
              </p>
            </div>
            <ArrowRight className="mt-1 size-3.5 shrink-0 text-subtle/60" aria-hidden />
          </li>
        );
      })}
    </ul>
  );
}
