import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getTaskCounts } from "@/server/repo/tasks";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Authenticated layout.
 *
 * `getSession()` — not `requireSession()` — is used here so the layout can render
 * a real page rather than a redirect frame. Every page and server action beneath
 * this layout performs its own `requireSession()` check, so this is a UX
 * affordance, not the security boundary.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const counts = await getTaskCounts(session.userId);

  return (
    <AppShell
      userName={session.user.name}
      userEmail={session.user.email}
      openTaskCount={counts.overdue + counts.today}
    >
      {children}
    </AppShell>
  );
}
