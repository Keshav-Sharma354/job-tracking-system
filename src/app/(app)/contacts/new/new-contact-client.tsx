"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ContactFormDialog } from "@/components/features/contacts/contact-form-dialog";
import type { ContactFormOptions } from "@/components/features/contacts/contact-form-fields";

export function NewContactClient({ options }: { options: ContactFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  const handleClose = () => {
    setOpen(false);
    router.push("/contacts");
  };

  const handleSuccess = () => {
    router.push("/contacts");
    router.refresh();
  };

  return (
    <ContactFormDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
      options={options}
      onSuccess={handleSuccess}
    />
  );
}

