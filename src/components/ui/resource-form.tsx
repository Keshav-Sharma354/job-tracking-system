"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";
import { toDateTimeInputValue } from "@/lib/utils/date";
import type { ActionResult } from "@/lib/utils/result";

export type FieldType =
  | "text"
  | "email"
  | "url"
  | "tel"
  | "number"
  | "date"
  | "datetime-local"
  | "textarea"
  | "select"
  | "checkbox"
  | "tags";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | boolean | null;
  /** How many of the 12-column grid to span. */
  span?: 1 | 2 | 3 | 4 | 6 | 8 | 12;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface ResourceFormValues {
  [key: string]: string | boolean;
}

/**
 * Declarative form used by every create/edit dialog.
 *
 * Submits a `FormData` straight to a server action and renders whatever field
 * errors come back, so validation stays on the server where it cannot be
 * bypassed. Keeps the ~15 CRUD screens small enough to audit at a glance.
 *
 * The dialog shell and the form body are separate components so that state
 * resets when the form is remounted, rather than being cleared by an effect.
 */
export interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  variant?: "primary" | "danger";
  fields: FieldSpec[];
  action: (formData: FormData) => Promise<ActionResult<unknown> | null>;
  /** Extra content rendered above the fields (alerts, context). */
  extra?: React.ReactNode;
  onSuccess?: () => void;
  /** Rendered in the footer to the left of the actions. */
  children?: React.ReactNode;
  dialogClassName?: string;
}

export function ResourceFormDialog(props: ResourceFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={cn("max-w-2xl", props.dialogClassName)}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description ? (
            <DialogDescription>{props.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {props.open ? <ResourceFormBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ResourceFormBody({
  onOpenChange,
  submitLabel = "Save",
  variant = "primary",
  fields,
  action,
  extra,
  onSuccess,
  children,
}: ResourceFormDialogProps) {
  const [pending, setPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (formError) setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    // Client-side quick validation for required fields
    const clientErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const val = formData.get(field.name);
        if (!val || (typeof val === "string" && !val.trim())) {
          clientErrors[field.name] = `${field.label} is required`;
        }
      }
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setPending(false);
      const first = Object.keys(clientErrors)[0];
      const el = form.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    try {
      const result = await action(formData);

      if (!result) return;

      if (result.ok) {
        toast.success(result.message ?? "Saved");
        onOpenChange(false);
        onSuccess?.();
      } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.error);
        toast.error(result.error);
        // Move focus to the first problem so keyboard users are not stranded.
        const first = Object.keys(result.fieldErrors)[0];
        const el = form.querySelector<HTMLElement>(`[name="${first}"]`);
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Form submission failed", error);
      setFormError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody className="space-y-4">
        {extra}

        {formError ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <div className="grid grid-cols-12 gap-4">
          {fields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              error={fieldErrors[field.name]}
              onClearError={clearFieldError}
            />
          ))}
        </div>
      </DialogBody>

      <DialogFooter>
        {children ? <div className="mr-auto">{children}</div> : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant={variant === "danger" ? "danger" : "primary"}
          loading={pending}
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

const SPAN_CLASS: Record<number, string> = {
  1: "col-span-12 sm:col-span-1",
  2: "col-span-12 sm:col-span-2",
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  6: "col-span-12 sm:col-span-6",
  8: "col-span-12 sm:col-span-8",
  12: "col-span-12",
};

function FieldControl({
  field,
  error,
  onClearError,
}: {
  field: FieldSpec;
  error?: string;
  onClearError?: (name: string) => void;
}) {
  const id = `field-${field.name}`;
  const errorId = error ? `${id}-error` : undefined;
  const span = SPAN_CLASS[field.span ?? 6] ?? SPAN_CLASS[12];

  const handleChange = () => {
    if (error && onClearError) {
      onClearError(field.name);
    }
  };

  if (field.type === "checkbox") {
    return (
      <div className={cn(span, "flex items-start gap-2.5 pt-6")}>
        <Checkbox
          id={id}
          name={field.name}
          defaultChecked={Boolean(field.defaultValue)}
          onCheckedChange={handleChange}
        />
        <div className="space-y-0.5">
          <Label htmlFor={id}>{field.label}</Label>
          {field.hint ? (
            <p className="text-xs text-subtle">{field.hint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", span)}>
      <Label htmlFor={id} required={field.required}>
        {field.label}
      </Label>

      {field.type === "select" ? (
        <Select
          id={id}
          name={field.name}
          defaultValue={(field.defaultValue as string) ?? ""}
          onChange={handleChange}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          invalid={Boolean(error)}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          name={field.name}
          rows={field.name === "body" ? 12 : 4}
          placeholder={field.placeholder}
          defaultValue={(field.defaultValue as string) ?? ""}
          onChange={handleChange}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          invalid={Boolean(error)}
        />
      ) : (
        <Input
          id={id}
          name={field.name}
          type={field.type === "tags" ? "text" : field.type}
          placeholder={field.placeholder}
          defaultValue={
            field.type === "datetime-local"
              ? toDateTimeInputValue(field.defaultValue as string | null)
              : field.defaultValue === null || field.defaultValue === undefined
                ? ""
                : String(field.defaultValue)
          }
          onChange={handleChange}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          step={field.type === "number" ? 1 : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          invalid={Boolean(error)}
        />
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : field.hint ? (
        <p className="text-xs text-subtle">{field.hint}</p>
      ) : null}
    </div>
  );
}

/** Dialog trigger + form in one, for the common "New…" button case. */
export function ResourceFormTrigger({
  label,
  icon,
  title,
  description,
  submitLabel,
  fields,
  action,
  extra,
  triggerVariant = "primary",
  triggerSize = "md",
  onSuccess,
}: {
  label: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  fields: FieldSpec[];
  action: (formData: FormData) => Promise<ActionResult<unknown> | null>;
  extra?: React.ReactNode;
  triggerVariant?: "primary" | "secondary";
  triggerSize?: "sm" | "md" | "lg";
  onSuccess?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <ResourceFormDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        submitLabel={submitLabel}
        fields={fields}
        action={action}
        extra={extra}
        onSuccess={onSuccess}
      />
    </>
  );
}
