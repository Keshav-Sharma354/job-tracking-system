/**
 * Task repository. Tasks are the follow-up engine: they carry a due date, an
 * optional link to the job/contact/email they stem from, and a status.
 */
import type { Prisma } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  andWhere,
  normalisePaging,
  paginate,
  searchText,
  type Paginated,
} from "@/server/repo/shared";

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  taskType: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  jobId: true,
  job: {
    select: { id: true, title: true, company: { select: { name: true } } },
  },
  contactId: true,
  contact: { select: { id: true, name: true } },
  emailId: true,
} satisfies Prisma.TaskSelect;

export type TaskItem = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export interface TaskFilters {
  q?: string;
  status?: TaskItem["status"] | TaskItem["status"][];
  taskType?: TaskItem["taskType"];
  priority?: TaskItem["priority"];
  jobId?: string;
  contactId?: string;
  /** Bucket selector used by the Tasks page tabs. */
  bucket?: "overdue" | "today" | "upcoming" | "done" | "all";
  /** Anchor for `today`/`upcoming` buckets, injected by the caller. */
  now?: Date;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

function buildWhere(userId: string, filters: TaskFilters): Prisma.TaskWhereInput {
  const clauses: Prisma.TaskWhereInput[] = [{ userId }];
  const now = filters.now ?? new Date();

  if (filters.taskType) clauses.push({ taskType: filters.taskType });
  if (filters.priority) clauses.push({ priority: filters.priority });
  if (filters.jobId) clauses.push({ jobId: filters.jobId });
  if (filters.contactId) clauses.push({ contactId: filters.contactId });

  switch (filters.bucket) {
    case "overdue":
      clauses.push({ status: TaskStatus.OPEN, dueAt: { lt: startOfDay(now) } });
      break;
    case "today":
      clauses.push({
        status: TaskStatus.OPEN,
        dueAt: { gte: startOfDay(now), lte: endOfDay(now) },
      });
      break;
    case "upcoming":
      clauses.push({
        status: TaskStatus.OPEN,
        dueAt: { gt: endOfDay(now) },
      });
      break;
    case "done":
      clauses.push({ status: TaskStatus.DONE });
      break;
    case "all":
    default:
      break;
  }

  if (filters.status !== undefined) {
    clauses.push(
      Array.isArray(filters.status)
        ? { status: { in: filters.status } }
        : { status: filters.status },
    );
  }

  const text = searchText<Prisma.TaskWhereInput>(filters.q ?? "", [
    "title",
    "description",
  ]);
  return andWhere<Prisma.TaskWhereInput>({ userId }, ...clauses, text);
}

/** Open tasks first, soonest due at the top, undated tasks last. */
const OPEN_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { dueAt: { sort: "asc", nulls: "last" } },
];

const DONE_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { completedAt: { sort: "desc", nulls: "last" } },
  { id: "asc" },
];

export async function listTasks(
  userId: string,
  params: TaskFilters & { page?: number; pageSize?: number } = {},
): Promise<Paginated<TaskItem>> {
  const { page, pageSize, skip, take } = normalisePaging(params);
  const where = buildWhere(userId, params);
  const orderBy = params.bucket === "done" ? DONE_ORDER : OPEN_ORDER;

  const [items, total] = await Promise.all([
    db.task.findMany({
      where,
      orderBy,
      select: taskSelect,
      skip,
      take,
    }),
    db.task.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function listAllTasks(
  userId: string,
  filters: TaskFilters = {},
): Promise<TaskItem[]> {
  return db.task.findMany({
    where: buildWhere(userId, filters),
    orderBy: OPEN_ORDER,
    select: taskSelect,
  });
}

export async function getTaskById(
  userId: string,
  taskId: string,
): Promise<TaskItem | null> {
  return db.task.findFirst({ where: { id: taskId, userId }, select: taskSelect });
}

export interface TaskData {
  title: string;
  description: string | null;
  taskType: TaskItem["taskType"];
  status: TaskItem["status"];
  priority: TaskItem["priority"];
  dueAt: Date | null;
  jobId: string | null;
  contactId: string | null;
  emailId: string | null;
}

export async function createTask(
  userId: string,
  data: TaskData,
): Promise<TaskItem> {
  return db.task.create({
    data: { userId, ...data },
    select: taskSelect,
  });
}

export async function updateTask(
  userId: string,
  taskId: string,
  data: Partial<TaskData>,
): Promise<TaskItem | null> {
  const existing = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  // Keep `completedAt` consistent with the status rather than trusting the form.
  const completedAt =
    data.status === TaskStatus.DONE ? new Date() : data.status === TaskStatus.OPEN ? null : undefined;

  return db.task.update({
    where: { id: taskId },
    data: { ...data, ...(completedAt !== undefined ? { completedAt } : {}) },
    select: taskSelect,
  });
}

/** Sets status to DONE and stamps `completedAt` in one statement. */
export async function completeTask(
  userId: string,
  taskId: string,
  done: boolean,
): Promise<TaskItem | null> {
  const existing = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });
  if (!existing) return null;

  return db.task.update({
    where: { id: taskId },
    data: {
      status: done ? TaskStatus.DONE : TaskStatus.OPEN,
      completedAt: done ? new Date() : null,
    },
    select: taskSelect,
  });
}

export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const { count } = await db.task.deleteMany({ where: { id: taskId, userId } });
  return count > 0;
}

export interface TaskCounts {
  overdue: number;
  today: number;
  upcoming: number;
  done: number;
  all: number;
}

export async function getTaskCounts(
  userId: string,
  now: Date = new Date(),
): Promise<TaskCounts> {
  const base = { userId };
  const [overdue, today, upcoming, done, all] = await Promise.all([
    db.task.count({
      where: { ...base, status: TaskStatus.OPEN, dueAt: { lt: startOfDay(now) } },
    }),
    db.task.count({
      where: {
        ...base,
        status: TaskStatus.OPEN,
        dueAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
    }),
    db.task.count({
      where: { ...base, status: TaskStatus.OPEN, dueAt: { gt: endOfDay(now) } },
    }),
    db.task.count({ where: { ...base, status: TaskStatus.DONE } }),
    db.task.count({ where: { ...base, status: { not: TaskStatus.CANCELLED } } }),
  ]);

  return { overdue, today, upcoming, done, all };
}
