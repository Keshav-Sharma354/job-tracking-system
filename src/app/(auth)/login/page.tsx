import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage() {
  if (await getSession()) {
    redirect("/dashboard");
  }

  return (
    <>
      <h2 className="mb-1 text-base font-semibold text-foreground">Sign in</h2>
      <p className="mb-5 text-sm text-muted">
        Welcome back. Pick up where you left off.
      </p>
      <AuthForm mode="login" />
    </>
  );
}
