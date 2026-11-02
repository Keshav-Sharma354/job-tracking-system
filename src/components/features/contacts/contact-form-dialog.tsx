"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceFormDialog } from "@/components/ui/resource-form";
import { createContactAction, updateContactAction } from "@/app/actions/crm";
import { contactFormFields, type ContactFormOptions } from "./contact-form-fields";

export function ContactFormDialog({
  open,
  onOpenChange,
  options,
  defaults,
  contactId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ContactFormOptions;
  defaults?: Parameters<typeof contactFormFields>[0];
  contactId?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={contactId ? "Edit contact" : "Add contact"}
      description={
        contactId
          ? undefined
          : "Recruiters, hiring managers, referrals — everyone you talk to."
      }
      submitLabel={contactId ? "Save changes" : "Add contact"}
      fields={contactFormFields(defaults ?? {}, options)}
      action={async (formData) =>
        contactId
          ? updateContactAction(contactId, Object.fromEntries(formData))
          : createContactAction(Object.fromEntries(formData))
      }
      onSuccess={() => {
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      }}
    />
  );
}

export function NewContactButton({
  options,
  label = "Add contact",
  variant = "primary",
  size = "md",
}: {
  options: ContactFormOptions;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <UserPlus />
        {label}
      </Button>
      <ContactFormDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}
