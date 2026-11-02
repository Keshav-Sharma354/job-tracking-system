"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { ResourceFormDialog } from "@/components/ui/resource-form";
import { createJobAction, updateJobAction } from "@/app/actions/jobs";
import { jobFormFields, type JobFormOptions } from "./job-form-fields";

/** Create/edit dialog for a single application. */
export function JobFormDialog({
  open,
  onOpenChange,
  options,
  defaults,
  jobId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: JobFormOptions;
  defaults?: Parameters<typeof jobFormFields>[0];
  /** Absent for the create form. */
  jobId?: string;
  title?: string;
}) {
  const router = useRouter();

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? (jobId ? "Edit application" : "Add application")}
      description={
        jobId
          ? undefined
          : "Track a role you have applied to, or saved for later."
      }
      submitLabel={jobId ? "Save changes" : "Add to pipeline"}
      fields={jobFormFields(defaults ?? {}, options)}
      action={async (formData) =>
        jobId ? updateJobAction(jobId, Object.fromEntries(formData)) : createJobAction(Object.fromEntries(formData))
      }
      onSuccess={() => router.refresh()}
    >
      <Briefcase className="size-4 text-subtle" aria-hidden />
    </ResourceFormDialog>
  );
}

/** Button that opens the create form. */
export function NewJobButton({
  options,
  label = "Add application",
  variant = "primary",
}: {
  options: JobFormOptions;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
            : "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-surface px-3.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border-strong transition-colors hover:bg-surface-hover"
        }
      >
        <Briefcase className="size-4" />
        {label}
      </button>
      <JobFormDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}
