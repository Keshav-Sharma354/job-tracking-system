"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { APPLICATION_STATUSES, STATUS_META } from "@/lib/constants";
import { moveJobAction } from "@/app/actions/jobs";
import { JobCard } from "@/components/features/jobs/job-cards";
import type { JobListItem } from "@/server/repo/jobs";

/**
 * Kanban board with native HTML5 drag and drop.
 *
 * Chosen over a DnD library deliberately: the interaction is a single column
 * transfer with no reordering or keyboard-reordering requirement, and the native
 * implementation is a few dozen lines with no dependency. Status changes go
 * through `moveJobAction`, which revalidates the route on success.
 *
 * Dragging is *not* optimistic: the card stays in place until the server
 * confirms, so a rejected move (for example a lost ownership check) cannot leave
 * the board lying about persisted state.
 */
export function KanbanBoard({
  columns,
  timezone,
  now,
}: {
  columns: Record<string, JobListItem[]>;
  timezone: string;
  now: number;
}) {
  const router = useRouter();
  const [dragging, setDragging] = React.useState<{ jobId: string; from: string } | null>(
    null,
  );
  const [saving, setSaving] = React.useState<string | null>(null);

  async function move(jobId: string, to: string, from: string) {
    if (to === from) return;
    setSaving(jobId);
    try {
      const result = await moveJobAction({ jobId, status: to });
      if (result.ok) {
        toast.success(result.message ?? "Moved");
      } else if (result.code !== "VALIDATION") {
        toast.error(result.error);
      }
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  const total = Object.values(columns).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="overflow-x-auto pb-4 overscroll-x-contain">
      <div className="flex min-w-max gap-3 pb-2">
        {APPLICATION_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            jobs={columns[status] ?? []}
            timezone={timezone}
            now={now}
            dragging={dragging}
            saving={saving}
            onDragStart={(jobId) => setDragging({ jobId, from: status })}
            onDrop={(jobId) => {
              if (dragging) void move(jobId, status, dragging.from);
              setDragging(null);
            }}
          />
        ))}
      </div>

      <p className="mt-3 text-xs text-subtle">
        {total} application{total === 1 ? "" : "s"} · drag a card to change its
        stage
      </p>
    </div>
  );
}

function Column({
  status,
  jobs,
  timezone,
  now,
  dragging,
  saving,
  onDragStart,
  onDrop,
}: {
  status: string;
  jobs: JobListItem[];
  timezone: string;
  now: number;
  dragging: { jobId: string; from: string } | null;
  saving: string | null;
  onDragStart: (jobId: string) => void;
  onDrop: (jobId: string) => void;
}) {
  const meta = STATUS_META[status as keyof typeof STATUS_META];
  const [isOver, setIsOver] = React.useState(false);

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={() => setIsOver(true)}
      onDragLeave={(event) => {
        // Prevent child elements from flickering isOver to false
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const jobId = event.dataTransfer.getData("text/plain");
        if (jobId) onDrop(jobId);
      }}
      aria-label={`${meta.label} (${jobs.length})`}
      className={`flex w-[18rem] shrink-0 max-h-[calc(100dvh-13rem)] min-h-[28rem] flex-col rounded-card border transition-colors ${
        isOver && dragging
          ? "border-accent bg-accent-subtle/40"
          : "border-border bg-surface-sunken"
      }`}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 pb-2 pt-3 border-b border-border/50">
        <span className={`size-2 shrink-0 rounded-full ${meta.accent}`} aria-hidden />
        <h2 className="flex-1 truncate text-sm font-semibold text-foreground">
          {meta.label}
        </h2>
        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-muted ring-1 ring-border">
          {jobs.length}
        </span>
      </header>

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 py-2">
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
            {isOver ? "Drop here" : "Empty"}
          </p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", job.id);
                event.dataTransfer.effectAllowed = "move";
                onDragStart(job.id);
              }}
              onDragEnd={() => undefined}
              className={saving === job.id ? "pointer-events-none opacity-60" : undefined}
            >
              <JobCard
                job={job}
                timezone={timezone}
                now={now}
                isDragging={dragging?.jobId === job.id}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
