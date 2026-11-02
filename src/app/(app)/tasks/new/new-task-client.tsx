"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TaskFormDialog } from "@/components/features/tasks/task-form-dialog";
import type { TaskFormOptions } from "@/components/features/tasks/task-form-fields";

export function NewTaskClient({
  options,
  defaultDueDate,
}: {
  options: TaskFormOptions;
  defaultDueDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  const handleClose = () => {
    setOpen(false);
    router.push("/tasks");
  };

  const handleSuccess = () => {
    router.push("/tasks");
    router.refresh();
  };

  return (
    <TaskFormDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
      options={options}
      defaults={{ dueAt: defaultDueDate }}
      onSuccess={handleSuccess}
    />
  );
}

