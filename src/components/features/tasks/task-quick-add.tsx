"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTaskAction } from "@/app/actions/crm";
import { nowDateTimeInputValue } from "@/lib/utils/date";

/**
 * One-line task creation, used on job and contact pages.
 *
 * Defaults the due date to 09:00 UTC tomorrow so the reminder is useful without
 * the user having to reach for a date picker.
 */
export function TaskQuickAdd({
  jobId,
  contactId,
}: {
  jobId?: string;
  contactId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function submit() {
    if (!title.trim()) return;
    setPending(true);
    try {
      const result = await createTaskAction({
        title,
        taskType: "FOLLOW_UP",
        status: "OPEN",
        priority: "MEDIUM",
        dueAt: nowDateTimeInputValue(1),
        jobId: jobId ?? "",
        contactId: contactId ?? "",
        emailId: "",
      });
      if (result.ok) {
        setTitle("");
        router.refresh();
        inputRef.current?.focus();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a follow-up…"
        aria-label="New task title"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <Button size="md" onClick={submit} loading={pending} disabled={!title.trim()}>
        <Plus />
        <span className="sr-only sm:not-sr-only">Add</span>
      </Button>
    </div>
  );
}
