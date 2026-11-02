'use server';

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import {
  companySchema,
  contactSchema,
  noteSchema,
  taskSchema,
} from "@/lib/validation/schemas";
import { idParamSchema } from "@/lib/validation/schemas";
import { invalid, unauthorized } from "@/lib/utils/result";
import * as contactService from "@/server/services/contacts";
import * as companyService from "@/server/services/companies";
import * as taskService from "@/server/services/tasks";
import * as noteService from "@/server/services/notes";
import type { ActionResult } from "@/lib/utils/result";
import type { ContactItem } from "@/server/repo/contacts";
import type { CompanyItem } from "@/server/repo/companies";
import type { TaskItem } from "@/server/repo/tasks";
import type { NoteItem } from "@/server/repo/notes";

async function requireUser(): Promise<{ userId: string } | { denied: true }> {
  try {
    return { userId: await requireUserId() };
  } catch {
    return { denied: true };
  }
}

function parseId(id: string): string | null {
  const parsed = idParamSchema.safeParse({ id });
  return parsed.success ? parsed.data.id : null;
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function createCompanyAction(
  input: unknown,
): Promise<ActionResult<CompanyItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<CompanyItem>;

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<CompanyItem>;

  const result = await companyService.createCompany(auth.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/companies");
    revalidatePath("/jobs");
  }
  return result;
}

/**
 * FormData entry point for the declarative `ResourceFormTrigger`.
 *
 * A Server Component cannot hand an inline closure to a Client Component unless
 * it is marked "use server", so the page passes this reference instead. Doing the
 * FormData conversion here leaves `createCompanyAction` callable with a plain
 * object from the client-side dialogs.
 */
export async function createCompanyFromFormAction(
  formData: FormData,
): Promise<ActionResult<CompanyItem>> {
  return createCompanyAction(Object.fromEntries(formData));
}

export async function updateCompanyAction(
  companyId: string,
  input: unknown,
): Promise<ActionResult<CompanyItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<CompanyItem>;

  const id = parseId(companyId);
  if (!id) return invalid("Invalid company id") as ActionResult<CompanyItem>;

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<CompanyItem>;

  const result = await companyService.updateCompany(auth.userId, id, parsed.data);
  if (result.ok) {
    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
  }
  return result;
}

export async function deleteCompanyAction(
  companyId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<{ id: string }>;

  const id = parseId(companyId);
  if (!id) return invalid("Invalid company id");

  const result = await companyService.deleteCompany(auth.userId, id);
  if (result.ok) {
    revalidatePath("/companies");
    revalidatePath("/jobs");
    revalidatePath("/contacts");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function createContactAction(
  input: unknown,
): Promise<ActionResult<ContactItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<ContactItem>;

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<ContactItem>;

  const result = await contactService.createContact(auth.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function updateContactAction(
  contactId: string,
  input: unknown,
): Promise<ActionResult<ContactItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<ContactItem>;

  const id = parseId(contactId);
  if (!id) return invalid("Invalid contact id") as ActionResult<ContactItem>;

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<ContactItem>;

  const result = await contactService.updateContact(auth.userId, id, parsed.data);
  if (result.ok) {
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
  }
  return result;
}

export async function deleteContactAction(
  contactId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<{ id: string }>;

  const id = parseId(contactId);
  if (!id) return invalid("Invalid contact id");

  const result = await contactService.deleteContact(auth.userId, id);
  if (result.ok) {
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTaskAction(
  input: unknown,
): Promise<ActionResult<TaskItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<TaskItem>;

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<TaskItem>;

  const result = await taskService.createTask(auth.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function updateTaskAction(
  taskId: string,
  input: unknown,
): Promise<ActionResult<TaskItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<TaskItem>;

  const id = parseId(taskId);
  if (!id) return invalid("Invalid task id") as ActionResult<TaskItem>;

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<TaskItem>;

  const result = await taskService.updateTask(auth.userId, id, parsed.data);
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function toggleTaskAction(
  taskId: string,
  done: boolean,
): Promise<ActionResult<TaskItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<TaskItem>;

  const id = parseId(taskId);
  if (!id) return invalid("Invalid task id") as ActionResult<TaskItem>;

  const result = await taskService.toggleTask(auth.userId, id, done);
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function snoozeTaskAction(
  taskId: string,
  days: number,
): Promise<ActionResult<TaskItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<TaskItem>;

  const id = parseId(taskId);
  if (!id) return invalid("Invalid task id") as ActionResult<TaskItem>;

  if (!Number.isFinite(days) || Math.abs(days) > 365) {
    return invalid("Choose a number of days between -365 and 365");
  }

  const result = await taskService.snoozeTask(auth.userId, id, days);
  if (result.ok) revalidatePath("/tasks");
  return result;
}

export async function deleteTaskAction(
  taskId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<{ id: string }>;

  const id = parseId(taskId);
  if (!id) return invalid("Invalid task id");

  const result = await taskService.deleteTask(auth.userId, id);
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function createNoteAction(
  input: unknown,
): Promise<ActionResult<NoteItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<NoteItem>;

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<NoteItem>;

  const result = await noteService.createNote(auth.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/notes");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function updateNoteAction(
  noteId: string,
  input: unknown,
): Promise<ActionResult<NoteItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<NoteItem>;

  const id = parseId(noteId);
  if (!id) return invalid("Invalid note id") as ActionResult<NoteItem>;

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error) as ActionResult<NoteItem>;

  const result = await noteService.updateNote(auth.userId, id, parsed.data);
  if (result.ok) revalidatePath("/notes");
  return result;
}

export async function toggleNotePinAction(
  noteId: string,
  pinned: boolean,
): Promise<ActionResult<NoteItem>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<NoteItem>;

  const id = parseId(noteId);
  if (!id) return invalid("Invalid note id") as ActionResult<NoteItem>;

  const result = await noteService.toggleNotePin(auth.userId, id, pinned);
  if (result.ok) revalidatePath("/notes");
  return result;
}

export async function deleteNoteAction(
  noteId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if ("denied" in auth) return unauthorized() as ActionResult<{ id: string }>;

  const id = parseId(noteId);
  if (!id) return invalid("Invalid note id");

  const result = await noteService.deleteNote(auth.userId, id);
  if (result.ok) revalidatePath("/notes");
  return result;
}
