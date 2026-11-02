import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { isRegistrationEnabled } from "@/server/services/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: { absolute: "Create account · Job Search CRM" },
};

export default async function RegisterPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }

  if (!isRegistrationEnabled()) {
    return (
      <div className="text-center">
        <h2 className="text-base font-semibold text-foreground">
          Registration is disabled
        </h2>
        <p className="mt-2 text-sm text-muted">
          This server has self-service sign-up turned off. Ask the administrator
          to provision an account for you.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">
        Create your account
      </h2>
      <p className="mb-5 text-sm text-muted">
        One account keeps your whole search private and isolated.
      </p>
      <AuthForm mode="register" />
    </>
  );
}
