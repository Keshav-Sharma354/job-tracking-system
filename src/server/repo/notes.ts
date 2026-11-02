/**
 * Note repository — free-form notes attached to a job and/or a contact.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  andWhere,
  normalisePaging,
  paginate,
  searchText,
  type Paginated,
} from "@/server/repo/shared";

export const noteSelect = {
  id: true,
  body: true,
  noteType: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  jobId: true,
  job: { select: { id: true, title: true, company: { select: { name: true } } } },
  contactId: true,
  contact: { select: { id: true, name: true } },
} satisfies Prisma.NoteSelect;

export type NoteItem = Prisma.NoteGetPayload<{ select: typeof noteSelect }>;

export interface NoteFilters {
  q?: string;
  noteType?: NoteItem["noteType"];
  jobId?: string;
  contactId?: string;
  pinnedOnly?: boolean;
}

function buildWhere(userId: string, filters: NoteFilters): Prisma.NoteWhereInput {
  const clauses: Prisma.NoteWhereInput[] = [{ userId }];
  if (filters.noteType) clauses.push({ noteType: filters.noteType });
  if (filters.jobId) clauses.push({ jobId: filters.jobId });
  if (filters.contactId) clauses.push({ contactId: filters.contactId });
  if (filters.pinnedOnly) clauses.push({ isPinned: true });

  const text = searchText<Prisma.NoteWhereInput>(filters.q ?? "", ["body"]);
  return andWhere<Prisma.NoteWhereInput>({ userId }, ...clauses, text);
}

export async function listNotes(
  userId: string,
  params: NoteFilters & { page?: number; pageSize?: number } = {},
): Promise<Paginated<NoteItem>> {
  const { page, pageSize, skip, take } = normalisePaging(params);
  const where = buildWhere(userId, params);

  const [items, total] = await Promise.all([
    db.note.findMany({
      where,
      // Pinned notes float to the top, then newest first.
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: noteSelect,
      skip,
      take,
    }),
    db.note.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function getNoteById(
  userId: string,
  noteId: string,
): Promise<NoteItem | null> {
  return db.note.findFirst({ where: { id: noteId, userId }, select: noteSelect });
}

export interface NoteData {
  body: string;
  noteType: NoteItem["noteType"];
  isPinned: boolean;
  jobId: string | null;
  contactId: string | null;
}

export async function createNote(
  userId: string,
  data: NoteData,
): Promise<NoteItem> {
  return db.note.create({ data: { userId, ...data }, select: noteSelect });
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: Partial<NoteData>,
): Promise<NoteItem | null> {
  const existing = await db.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });
  if (!existing) return null;
  return db.note.update({ where: { id: noteId }, data, select: noteSelect });
}

export async function deleteNote(
  userId: string,
  noteId: string,
): Promise<boolean> {
  const { count } = await db.note.deleteMany({ where: { id: noteId, userId } });
  return count > 0;
}

export async function listNotesForJob(userId: string, jobId: string) {
  return db.note.findMany({
    where: { userId, jobId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    select: noteSelect,
  });
}

export async function listNotesForContact(userId: string, contactId: string) {
  return db.note.findMany({
    where: { userId, contactId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    select: noteSelect,
  });
}
