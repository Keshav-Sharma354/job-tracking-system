import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/layout";
import { NewCompanyClient } from "./new-company-client";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage() {
  await requireSession();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Add a company"
        description="Research you can reuse across applications."
      />
      <NewCompanyClient />
    </div>
  );
}

