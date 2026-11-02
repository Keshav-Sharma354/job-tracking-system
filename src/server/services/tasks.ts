/**
 * Task service — the follow-up engine.
 *
 * Completing a task records it on the timeline, and it is the natural place for
 * the "snooze"/"reschedule" helper the dashboard needs.
 */
import { ActivityAction, ActivityEntity, TaskStatus } from "@/generated/prisma/enums";
import type { TaskData } from "@/lib/validation/schemas";
import * as taskRepo from "@/server/repo/tasks";
import * as jobRepo from "@/server/repo/jobs";
import * as contactRepo from "@/server/repo/contacts";
import * as emailRepo from "@/server/repo/emails";
import { logActivity } from "@/server/repo/activity";
import { fieldError, internal, notFound, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import type { TaskItem } from "@/server/repo/tasks";

export type { TaskItem };

/** Verifies that any entity the task points at is owned by this user. */
async function assertLinksOwned(
  userId: string,
  links: { jobId: string | null; contactId: string | null; emailId: string | null },
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
  if (links.emailId && !(await emailRepo.getEmailById(userId, links.emailId))) {
    return fieldError("emailId", "That message no longer exists");
  }
  return null;
}

export async function createTask(
  userId: string,
  input: TaskData,
): Promise<ActionResult<TaskItem>> {
  const linkProblem = await assertLinksOwned(userId, input);
  if (linkProblem) return linkProblem;

  try {
    const task = await taskRepo.createTask(userId, input);
    return ok(task, "Task created");
  } catch (error) {
    console.error("createTask failed", error);
    return internal("Could not save this task");
  }
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: TaskData,
): Promise<ActionResult<TaskItem>> {
  const existing = await taskRepo.getTaskById(userId, taskId);
  if (!existing) return notFound("That task no longer exists");

  const linkProblem = await assertLinksOwned(userId, input);
  if (linkProblem) return linkProblem;

  try {
    const task = await taskRepo.updateTask(userId, taskId, input);
    if (!task) return notFound();

    if (
      task.status === TaskStatus.DONE &&
      existing.status !== TaskStatus.DONE
    ) {
      await logActivity(userId, {
        action: ActivityAction.TASK_COMPLETED,
        entityType: ActivityEntity.TASK,
        entityId: task.id,
        jobId: task.jobId,
        contactId: task.contactId,
        emailId: task.emailId,
        summary: `Completed: ${task.title}`,
      });
    }

    return ok(task, "Task updated");
  } catch (error) {
    console.error("updateTask failed", error);
    return internal("Could not save your changes");
  }
}

export async function toggleTask(
  userId: string,
  taskId: string,
  done: boolean,
): Promise<ActionResult<TaskItem>> {
  const existing = await taskRepo.getTaskById(userId, taskId);
  if (!existing) return notFound("That task no longer exists");

  try {
    const task = await taskRepo.completeTask(userId, taskId, done);
    if (!task) return notFound();

    if (done) {
      await logActivity(userId, {
        action: ActivityAction.TASK_COMPLETED,
        entityType: ActivityEntity.TASK,
        entityId: task.id,
        jobId: task.jobId,
        contactId: task.contactId,
        summary: `Completed: ${task.title}`,
      });
    }

    return ok(task, done ? "Task completed" : "Task reopened");
  } catch (error) {
    console.error("toggleTask failed", error);
    return internal("Could not update this task");
  }
}

/** Pushes a task's due date out by a number of days. */
export async function snoozeTask(
  userId: string,
  taskId: string,
  days: number,
): Promise<ActionResult<TaskItem>> {
  const existing = await taskRepo.getTaskById(userId, taskId);
  if (!existing) return notFound("That task no longer exists");

  const base = existing.dueAt ?? new Date();
  const dueAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  try {
    const task = await taskRepo.updateTask(userId, taskId, { dueAt });
    if (!task) return notFound();
    return ok(task, days >= 0 ? `Snoozed ${days} day(s)` : `Moved up ${Math.abs(days)} day(s)`);
  } catch (error) {
    console.error("snoozeTask failed", error);
    return internal("Could not reschedule this task");
  }
}

export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await taskRepo.getTaskById(userId, taskId);
  if (!existing) return notFound("That task no longer exists");

  const deleted = await taskRepo.deleteTask(userId, taskId);
  if (!deleted) return notFound();
  return ok({ id: taskId }, "Task deleted");
}
