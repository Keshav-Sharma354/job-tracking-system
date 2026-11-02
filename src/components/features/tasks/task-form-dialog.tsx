"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceFormDialog } from "@/components/ui/resource-form";
import { createTaskAction, updateTaskAction } from "@/app/actions/crm";
import { taskFormFields, type TaskFormOptions } from "./task-form-fields";

export function TaskFormDialog({
  open,
  onOpenChange,
  options,
  defaults,
  taskId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TaskFormOptions;
  defaults?: Parameters<typeof taskFormFields>[0];
  taskId?: string;
}) {
  const router = useRouter();

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={taskId ? "Edit task" : "New follow-up"}
      description={
        taskId ? undefined : "Reminders for applications, contacts and replies."
      }
      submitLabel={taskId ? "Save changes" : "Create task"}
      fields={taskFormFields(defaults ?? {}, options)}
      action={async (formData) =>
        taskId
          ? updateTaskAction(taskId, Object.fromEntries(formData))
          : createTaskAction(Object.fromEntries(formData))
      }
      onSuccess={() => router.refresh()}
    />
  );
}

export function NewTaskButton({
  options,
  defaults,
  label = "New task",
}: {
  options: TaskFormOptions;
  defaults?: Parameters<typeof taskFormFields>[0];
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarCheck />
        {label}
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        options={options}
        defaults={defaults}
      />
    </>
  );
}
