/**
 * Note service. Notes are the timeline's free-form layer: conversation history,
 * interview write-ups and company research all land here.
 */
import { ActivityAction, ActivityEntity } from "@/generated/prisma/enums";
import type { NoteData } from "@/lib/validation/schemas";
import * as noteRepo from "@/server/repo/notes";
import * as jobRepo from "@/server/repo/jobs";
import * as contactRepo from "@/server/repo/contacts";
import { logActivity } from "@/server/repo/activity";
import { fieldError, internal, notFound, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import type { NoteItem } from "@/server/repo/notes";

export type { NoteItem };

async function assertLinksOwned(
  userId: string,
  links: { jobId: string | null; contactId: string | null },
): Promise<ActionResult<never> | null> {
  if (links.jobId && !(await jobRepo.getJobById(userId, links.jobId))) {
    return fieldError("jobId", "That application no longer exists");
  }
  if (
    links.contactId &&
    !(await contactRepo.getContactById(userId, links.contactId))
  ) {
    return fieldError("contactId", "That contact no longer exists");
  }
  return null;
}

export async function createNote(
  userId: string,
  input: NoteData,
): Promise<ActionResult<NoteItem>> {
  const linkProblem = await assertLinksOwned(userId, {
    jobId: input.jobId,
    contactId: input.contactId,
  });
  if (linkProblem) return linkProblem;

  try {
    const note = await noteRepo.createNote(userId, {
      body: input.body,
      noteType: input.noteType,
      isPinned: input.isPinned,
      jobId: input.jobId,
      contactId: input.contactId,
    });

    await logActivity(userId, {
      action: ActivityAction.NOTE_ADDED,
      entityType: ActivityEntity.NOTE,
      entityId: note.id,
      jobId: note.jobId,
      contactId: note.contactId,
      summary: `Added a ${note.noteType.toLowerCase().replace(/_/g, " ")} note`,
    });

    return ok(note, "Note saved");
  } catch (error) {
    console.error("createNote failed", error);
    return internal("Could not save this note");
  }
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: NoteData,
): Promise<ActionResult<NoteItem>> {
  const existing = await noteRepo.getNoteById(userId, noteId);
  if (!existing) return notFound("That note no longer exists");

  const linkProblem = await assertLinksOwned(userId, {
    jobId: input.jobId,
    contactId: input.contactId,
  });
  if (linkProblem) return linkProblem;

  try {
    const note = await noteRepo.updateNote(userId, noteId, {
      body: input.body,
      noteType: input.noteType,
      isPinned: input.isPinned,
      jobId: input.jobId,
      contactId: input.contactId,
    });
    if (!note) return notFound();
    return ok(note, "Note updated");
  } catch (error) {
    console.error("updateNote failed", error);
    return internal("Could not save your changes");
  }
}

export async function toggleNotePin(
  userId: string,
  noteId: string,
  pinned: boolean,
): Promise<ActionResult<NoteItem>> {
  const existing = await noteRepo.getNoteById(userId, noteId);
  if (!existing) return notFound("That note no longer exists");
  const note = await noteRepo.updateNote(userId, noteId, { isPinned: pinned });
  if (!note) return notFound();
  return ok(note, pinned ? "Note pinned" : "Note unpinned");
}

export async function deleteNote(
  userId: string,
  noteId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await noteRepo.getNoteById(userId, noteId);
  if (!existing) return notFound("That note no longer exists");
  const deleted = await noteRepo.deleteNote(userId, noteId);
  if (!deleted) return notFound();
  return ok({ id: noteId }, "Note deleted");
}
