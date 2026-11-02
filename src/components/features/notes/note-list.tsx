"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { IconTooltip } from "@/components/ui/tooltip";
import { DeleteButton } from "@/components/features/common/delete-button";
import { deleteNoteAction, toggleNotePinAction } from "@/app/actions/crm";
import { NOTE_TYPE_LABELS } from "@/lib/constants";

export interface NoteListItem {
  id: string;
  body: string;
  noteType: string;
  isPinned: boolean;
  createdAt: Date;
  jobId: string | null;
  job: { id: string; title: string; company: { name: string } } | null;
  contactId: string | null;
  contact: { id: string; name: string } | null;
}

export function NoteList({ notes }: { notes: NoteListItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function togglePin(note: NoteListItem) {
    setBusy(note.id);
    try {
      await toggleNotePinAction(note.id, !note.isPinned);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="divide-y divide-border">
      {notes.map((note) => (
        <li
          key={note.id}
          className={cn(
            "group px-4 py-3 transition-colors hover:bg-surface-hover/60",
            busy === note.id && "pointer-events-none opacity-60",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={
                    NOTE_TYPE_LABELS[
                      note.noteType as keyof typeof NOTE_TYPE_LABELS
                    ] ?? note.noteType
                  }
                />
                {note.job ? (
                  <Link
                    href={`/jobs/${note.job.id}`}
                    className="truncate text-xs text-muted hover:text-accent hover:underline"
                  >
                    {note.job.title} · {note.job.company.name}
                  </Link>
                ) : note.contact ? (
                  <Link
                    href={`/contacts/${note.contact.id}`}
                    className="truncate text-xs text-muted hover:text-accent hover:underline"
                  >
                    {note.contact.name}
                  </Link>
                ) : (
                  <span className="text-xs text-subtle">General</span>
                )}
              </div>

              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {note.body}
              </p>

              <p className="mt-1.5 text-xs text-subtle">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <IconTooltip
                label={note.isPinned ? "Unpin note" : "Pin note"}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => togglePin(note)}
                  aria-pressed={note.isPinned}
                  aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                  className={note.isPinned ? "text-warning" : undefined}
                >
                  {note.isPinned ? (
                    <Pin className="size-3.5" />
                  ) : (
                    <PinOff className="size-3.5 opacity-0 group-hover:opacity-100" />
                  )}
                </Button>
              </IconTooltip>
              <DeleteButton
                entityName="note"
                onDelete={() => deleteNoteAction(note.id)}
                size="icon-sm"
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
