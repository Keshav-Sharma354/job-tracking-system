import type { Metadata } from "next";
import Link from "next/link";
import { Pin, StickyNote } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listNotes } from "@/server/repo/notes";
import { NOTE_TYPE_LABELS } from "@/lib/constants";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NoteList } from "@/components/features/notes/note-list";
import { NoteComposer } from "@/components/features/notes/note-composer";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";

  const q = first(params.q);
  const noteType = first(params.type);

  const result = await listNotes(session.userId, {
    q: q || undefined,
    noteType: (noteType as never) || undefined,
    pinnedOnly: first(params.pinned) === "1",
    pageSize: 100,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notes"
        description="Interview write-ups, company research and conversation history"
      />

      <Card>
        <div className="border-b border-border p-4">
          <NoteComposer />
        </div>
      </Card>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="min-w-48 flex-1 sm:max-w-xs"
        />
        <Select
          name="type"
          defaultValue={noteType}
          aria-label="Filter by note type"
          className="w-auto min-w-40"
        >
          <option value="">All types</option>
          {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            name="pinned"
            value="1"
            defaultChecked={first(params.pinned) === "1"}
            className="size-3.5 rounded border-input"
          />
          Pinned only
        </label>
        <Button type="submit" variant="secondary" size="md">
          Filter
        </Button>
      </form>

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<StickyNote className="size-5" />}
            title={q || noteType ? "No notes match" : "No notes yet"}
            description={
              q || noteType
                ? "Try a different search."
                : "Notes you attach to an application or contact appear here too."
            }
          />
        ) : (
          <NoteList notes={result.items} />
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <Pin className="size-3" aria-hidden />
        Pinned notes stay at the top of every list.
        <Link href="/notes?pinned=1" className="text-accent hover:underline">
          View pinned only
        </Link>
      </p>
    </div>
  );
}
