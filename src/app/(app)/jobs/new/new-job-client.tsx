"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { JobFormDialog } from "@/components/features/jobs/job-form-dialog";
import type { JobFormOptions } from "@/components/features/jobs/job-form-fields";

export function NewJobClient({ options }: { options: JobFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  const handleClose = () => {
    setOpen(false);
    router.push("/jobs");
  };

  const handleSuccess = () => {
    router.push("/jobs");
    router.refresh();
  };

  return (
    <JobFormDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
      options={options}
      onSuccess={handleSuccess}
    />
  );
}

