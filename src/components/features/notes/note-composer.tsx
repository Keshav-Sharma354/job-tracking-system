"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { NOTE_TYPE_LABELS } from "@/lib/constants";
import { createNoteAction } from "@/app/actions/crm";

/**
 * Inline note capture.
 *
 * Present on job and contact pages so notes can be written at the moment the
 * information arrives, rather than deferred to a separate screen.
 */
export function NoteComposer({
  jobId,
  contactId,
  compact = false,
}: {
  jobId?: string;
  contactId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [noteType, setNoteType] = React.useState("GENERAL");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    try {
      const result = await createNoteAction({
        body,
        noteType,
        jobId: jobId ?? "",
        contactId: contactId ?? "",
        isPinned: false,
      });
      if (result.ok) {
        setBody("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What do you want to remember?"
        rows={compact ? 2 : 3}
        aria-label="Note body"
        onKeyDown={(event) => {
          // ⌘/Ctrl + Enter submits, matching the convention in most note apps.
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Select
          value={noteType}
          onChange={(event) => setNoteType(event.target.value)}
          aria-label="Note type"
          className="h-8 w-auto min-w-32 text-xs"
        >
          {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          onClick={submit}
          loading={pending}
          disabled={!body.trim()}
          className="ml-auto"
        >
          <Send />
          Add note
        </Button>
      </div>
    </div>
  );
}
