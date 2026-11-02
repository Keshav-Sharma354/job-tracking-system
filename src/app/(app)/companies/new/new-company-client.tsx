"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { ResourceFormDialog } from "@/components/ui/resource-form";
import { companyFormFields } from "@/components/features/companies/company-form-fields";
import { createCompanyFromFormAction } from "@/app/actions/crm";

export function NewCompanyClient() {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  const handleClose = () => {
    setOpen(false);
    router.push("/companies");
  };

  const handleSuccess = () => {
    router.push("/companies");
    router.refresh();
  };

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
      title="Add company"
      description="Research you can reuse across applications."
      submitLabel="Add company"
      fields={companyFormFields()}
      action={createCompanyFromFormAction}
      onSuccess={handleSuccess}
    >
      <Building2 className="size-4 text-subtle" aria-hidden />
    </ResourceFormDialog>
  );
}

