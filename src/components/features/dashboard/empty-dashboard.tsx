import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  FileText,
  Mail,
  Rocket,
  Users,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    href: "/jobs/new",
    icon: FileText,
    title: "Add an application",
    body: "Record the role, the company and where you found it. Deadlines and the resume you used can wait until later.",
  },
  {
    href: "/contacts/new",
    icon: Users,
    title: "Save your contacts",
    body: "Recruiters, hiring managers and employee referrals all live in one place with their history attached.",
  },
  {
    href: "/companies/new",
    icon: Building2,
    title: "Research companies",
    body: "Keep company research and notes alongside every role you have applied to.",
  },
  {
    href: "/emails/new",
    icon: Mail,
    title: "Reach out",
    body: "Use a template, personalise it, and the CRM will schedule a follow-up if nobody replies.",
  },
  {
    href: "/tasks/new",
    icon: CalendarCheck,
    title: "Set a follow-up",
    body: "Interviews, calls and reminders all show up on your dashboard on the day they are due.",
  },
];

/**
 * First-run experience.
 *
 * Shown instead of the dashboard when an account has no data, so a new user is
 * told what the app is for rather than looking at a wall of zeroes.
 */
export function EmptyDashboard({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
          <Rocket className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Let&apos;s set up your search, {first}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          This workspace keeps every application, conversation and reminder in one
          place. Start with any of these — you can fill in the rest as you go.
        </p>
      </div>

      <Card>
        <CardHeader title="Getting started" description="Five things worth setting up first" />
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.href} className="flex items-start gap-3.5 px-4 py-4">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-subtle ring-1 ring-border">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{step.body}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="shrink-0">
                    <Link href={step.href}>Start</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
