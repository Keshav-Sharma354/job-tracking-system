import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Link href={session ? "/dashboard" : "/login"}>Continue</Link>
    </main>
  );
}
