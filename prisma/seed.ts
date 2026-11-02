/**
 * Database seed.
 *
 * Two modes:
 *
 *   `npm run db:seed -- --demo`
 *     Creates a demo account populated with realistic records. Useful for
 *     evaluating the UI. Requires the explicit `--demo` flag and refuses to run
 *     when NODE_ENV=production.
 *
 *   `npm run db:seed -- --demo --reset`
 *     Deletes the existing demo account first (cascading to its records) and
 *     regenerates it. Touches only rows owned by that account.
 *
 *   `npm run db:seed -- --account you@example.com "Your Name"`
 *     Creates an empty account so you can sign in and enter your own data.
 *
 * Without a flag the script only prints usage and exits non-zero, so an
 * accidental bare `db:seed` can never inject fake records into a real database.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type {
  ApplicationStatus,
  Priority,
  WorkMode,
} from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "DemoPassword123";
const DEFAULT_PASSWORD = "ChangeMe123456";

async function main() {
  const args = process.argv.slice(2);
  const demo = args.includes("--demo");
  const reset = args.includes("--reset");
  const accountIndex = args.indexOf("--account");

  if (demo) {
    await seedDemo({ reset });
    return;
  }

  if (accountIndex !== -1) {
    const email = args[accountIndex + 1];
    const name = args[accountIndex + 2];
    if (!email || !name) {
      console.error("--account requires an email and a name.");
      process.exit(1);
    }
    await createAccount(email, name, DEFAULT_PASSWORD);
    return;
  }

  console.log(
    [
      "",
      "Nothing seeded. Choose one of:",
      "",
      "  npm run db:seed -- --demo",
      "      Create a demo account with sample records for exploring the UI.",
      "",
      "  npm run db:seed -- --account you@example.com \"Your Name\"",
      `      Create an empty account (temporary password: ${DEFAULT_PASSWORD}).`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

async function createAccount(email: string, name: string, password: string) {
  const normalised = email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalised } });

  if (existing) {
    console.log(`A user with ${normalised} already exists; nothing to do.`);
    return existing;
  }

  return db.user.create({
    data: { email: normalised, name, passwordHash: await hashPassword(password) },
  });
}

/** Rejects demo data on a production database. */
function assertNotProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed demo data with NODE_ENV=production. " +
        "Set NODE_ENV=development to use this script.",
    );
  }
}

async function seedDemo({ reset = false }: { reset?: boolean } = {}) {
  assertNotProduction();

  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (existing && !reset) {
    console.log(`Demo account already exists (${DEMO_EMAIL}).`);
    console.log("Pass --reset to regenerate it: npm run db:seed -- --demo --reset");
    return;
  }

  if (existing) {
    // Every table cascades from User, so this removes exactly the demo data.
    await db.user.delete({ where: { id: existing.id } });
    console.log(`Removed the existing demo account (${DEMO_EMAIL}).`);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const at = (offsetDays: number, hour = 10, minute = 0) => {
    const d = new Date(now + offsetDays * day);
    d.setUTCHours(hour, minute, 0, 0);
    return d;
  };

  const user = await db.user.create({
    data: { email: DEMO_EMAIL, name: "Dana Whitfield", passwordHash },
  });

  // --- Resume versions -----------------------------------------------------
  const generalResume = await db.resumeVersion.create({
    data: {
      userId: user.id,
      label: "General 2026",
      fileUrl: null,
      summary: "Backend-leaning general purpose resume.",
      isDefault: true,
    },
  });
  const backendResume = await db.resumeVersion.create({
    data: {
      userId: user.id,
      label: "Backend / Platform",
      fileUrl: null,
      summary: "Emphasises distributed systems and infrastructure work.",
      isDefault: false,
    },
  });

  // --- Companies -----------------------------------------------------------
  const companySpecs = [
    { name: "Northwind Labs", industry: "Developer tools", location: "Berlin, DE", size: "51-200", websiteUrl: "https://northwind.example.com", tags: ["saas", "devtools"] },
    { name: "Contoso Health", industry: "Healthcare", location: "Remote (EU)", size: "201-500", websiteUrl: "https://contoso.example.com", tags: ["healthtech"] },
    { name: "Fabrikam Logistics", industry: "Logistics", location: "Amsterdam, NL", size: "1000+", websiteUrl: "https://fabrikam.example.com", tags: ["logistics", "enterprise"] },
    { name: "Tailspin Toys", industry: "Consumer", location: "Dublin, IE", size: "11-50", websiteUrl: null, tags: ["startup"] },
    { name: "Proseware", industry: "Developer tools", location: "Remote (US)", size: "201-500", websiteUrl: "https://proseware.example.com", tags: ["saas", "remote-first"] },
    { name: "Litware", industry: "Financial services", location: "London, UK", size: "1000+", websiteUrl: "https://litware.example.com", tags: ["fintech", "enterprise"] },
  ] as const;

  const companies = [];
  for (const spec of companySpecs) {
    companies.push(
      await db.company.create({
        data: {
          userId: user.id,
          name: spec.name,
          websiteUrl: spec.websiteUrl,
          linkedinUrl: null,
          industry: spec.industry,
          location: spec.location,
          size: spec.size,
          notes:
            spec.name === "Northwind Labs"
              ? "Series B, hiring a platform team. Engineering blog is worth skimming before the interview."
              : null,
          tags: [...spec.tags],
        },
      }),
    );
  }

  const byName = new Map(companies.map((c) => [c.name, c]));

  // --- Contacts ------------------------------------------------------------
  const contactSpecs = [
    { name: "Amara Osei", title: "Senior Technical Recruiter", type: "RECRUITER", company: "Northwind Labs", email: "amara.osei@northwind.example.com", relationship: "STRONG", lastContactedAt: at(-6), tags: ["recruiter"] },
    { name: "Tobias Lindqvist", title: "Engineering Manager", type: "ENGINEERING_MANAGER", company: "Northwind Labs", email: "tobias.l@northwind.example.com", relationship: "MODERATE", lastContactedAt: at(-14), tags: ["hiring-manager"] },
    { name: "Priya Raman", title: "Director of Engineering", type: "DIRECTOR", company: "Contoso Health", email: "priya.raman@contoso.example.com", relationship: "WEAK", lastContactedAt: null, tags: [] },
    { name: "Marcus Bell", title: "Staff Software Engineer", type: "ENGINEER", company: "Contoso Health", email: "marcus.bell@contoso.example.com", relationship: "MODERATE", lastContactedAt: at(-3), tags: ["referral"] },
    { name: "Sofia Marchetti", title: "Talent Partner", type: "HR", company: "Fabrikam Logistics", email: "sofia.m@fabrikam.example.com", relationship: "WEAK", lastContactedAt: null, tags: [] },
    { name: "Ben Alvarez", title: "Senior Platform Engineer", type: "ENGINEER", company: "Fabrikam Logistics", email: "ben.alvarez@fabrikam.example.com", relationship: "STRONG", lastContactedAt: at(-1), tags: ["referral"] },
    { name: "Hana Kobayashi", title: "Engineering Manager", type: "ENGINEERING_MANAGER", company: "Tailspin Toys", email: "hana@tailspin.example.com", relationship: "MODERATE", lastContactedAt: at(-9), tags: [] },
    { name: "Omar Haddad", title: "Recruiter", type: "RECRUITER", company: "Proseware", email: "omar@proseware.example.com", relationship: "WEAK", lastContactedAt: null, tags: [] },
    { name: "Grace Chen", title: "Principal Engineer", type: "ENGINEER", company: "Proseware", email: "grace.chen@proseware.example.com", relationship: "MODERATE", lastContactedAt: at(-21), tags: ["referral"] },
  ] as const;

  const contacts = [];
  for (const spec of contactSpecs) {
    contacts.push(
      await db.contact.create({
        data: {
          userId: user.id,
          companyId: byName.get(spec.company)?.id ?? null,
          name: spec.name,
          email: spec.email,
          phone: null,
          linkedinUrl: `https://linkedin.com/in/${spec.name.toLowerCase().replace(/[^a-z]/g, ".")}`,
          title: spec.title,
          contactType: spec.type,
          relationship: spec.relationship,
          lastContactedAt: spec.lastContactedAt,
          notes: null,
          tags: [...spec.tags],
        },
      }),
    );
  }

  const contactByName = new Map(contacts.map((c) => [c.name, c]));

  // --- Applications --------------------------------------------------------
  const jobSpecs: Array<{
    company: string;
    title: string;
    status: ApplicationStatus;
    priority: Priority;
    applied: number | null;
    deadline: Date | null;
    salaryMin: number | null;
    salaryMax: number | null;
    workMode: WorkMode;
    location: string;
    tags: string[];
    referral: string | null;
    url: string;
    notes: string | null;
  }> = [
    { company: "Northwind Labs", title: "Staff Platform Engineer", status: "INTERVIEW", priority: "HIGH", applied: -18, deadline: null, salaryMin: 140000, salaryMax: 175000, workMode: "HYBRID", location: "Berlin, DE", tags: ["referral", "priority"], referral: "Tobias Lindqvist", url: "https://northwind.example.com/careers/staff-platform", notes: "Second round scheduled. Focus on the storage sharding discussion." },
    { company: "Proseware", title: "Senior Backend Engineer", status: "PHONE_SCREEN", priority: "HIGH", applied: -12, deadline: null, salaryMin: 155000, salaryMax: 190000, workMode: "REMOTE", location: "Remote (US)", tags: ["remote-first"], referral: null, url: "https://proseware.example.com/jobs/senior-backend", notes: null },
    { company: "Contoso Health", title: "Engineering Manager, Platform", status: "APPLIED", priority: "MEDIUM", applied: -9, deadline: at(4), salaryMin: 130000, salaryMax: 160000, workMode: "HYBRID", location: "Remote (EU)", tags: ["referral"], referral: "Marcus Bell", url: "https://contoso.example.com/careers/em-platform", notes: "Referred by Marcus — he offered to make an internal introduction." },
    { company: "Fabrikam Logistics", title: "Principal Software Engineer", status: "ONSITE", priority: "HIGH", applied: -26, deadline: null, salaryMin: 160000, salaryMax: 200000, workMode: "ONSITE", location: "Amsterdam, NL", tags: ["referral", "priority"], referral: "Ben Alvarez", url: "https://fabrikam.example.com/careers/principal", notes: "Onsite loop across three teams. Panel debrief expected Friday." },
    { company: "Litware", title: "Senior Engineer, Payments", status: "OFFER", priority: "HIGH", applied: -41, deadline: null, salaryMin: 120000, salaryMax: 150000, workMode: "HYBRID", location: "London, UK", tags: ["fintech"], referral: null, url: "https://litware.example.com/careers/payments", notes: "Offer received. Comparing against the Northwind process." },
    { company: "Tailspin Toys", title: "Backend Engineer", status: "REJECTED", priority: "LOW", applied: -33, deadline: null, salaryMin: 80000, salaryMax: 100000, workMode: "HYBRID", location: "Dublin, IE", tags: ["startup"], referral: null, url: "https://tailspin.example.com/careers/backend", notes: "Rejected after the take-home. System design was the weak point." },
    { company: "Northwind Labs", title: "Senior SRE", status: "APPLIED", priority: "MEDIUM", applied: -5, deadline: at(11), salaryMin: 125000, salaryMax: 155000, workMode: "REMOTE", location: "Remote (EU)", tags: ["devtools"], referral: null, url: "https://northwind.example.com/careers/senior-sre", notes: null },
    { company: "Contoso Health", title: "Senior Software Engineer", status: "SAVED", priority: "MEDIUM", applied: null, deadline: at(2), salaryMin: 110000, salaryMax: 140000, workMode: "HYBRID", location: "Remote (EU)", tags: [], referral: null, url: "https://contoso.example.com/careers/senior-swe", notes: "Strong match — apply before the referral goes cold." },
    { company: "Fabrikam Logistics", title: "Team Lead, Routing", status: "SAVED", priority: "LOW", applied: null, deadline: at(9), salaryMin: null, salaryMax: null, workMode: "ONSITE", location: "Amsterdam, NL", tags: [], referral: null, url: "https://fabrikam.example.com/careers/routing-lead", notes: null },
    { company: "Proseware", title: "Infrastructure Engineer", status: "WITHDRAWN", priority: "LOW", applied: -48, deadline: null, salaryMin: null, salaryMax: null, workMode: "REMOTE", location: "Remote (US)", tags: [], referral: null, url: "https://proseware.example.com/careers/infra", notes: "Withdrew — the role was mostly Windows operations work." },
  ];

  const jobs = [];
  for (const spec of jobSpecs) {
    const job = await db.job.create({
      data: {
        userId: user.id,
        companyId: byName.get(spec.company)!.id,
        title: spec.title,
        url: spec.url,
        location: spec.location,
        employmentType: "FULL_TIME",
        workMode: spec.workMode,
        status: spec.status,
        priority: spec.priority,
        salaryMin: spec.salaryMin,
        salaryMax: spec.salaryMax,
        salaryCurrency: "EUR",
        salaryPeriod: "YEAR",
        appliedAt: spec.applied === null ? null : at(spec.applied, 9, 30),
        deadlineAt: spec.deadline,
        closedAt:
          spec.status === "REJECTED" || spec.status === "WITHDRAWN"
            ? at((spec.applied ?? 0) + 12)
            : null,
        resumeVersionId: spec.company === "Northwind Labs" ? backendResume.id : generalResume.id,
        referralContactId: spec.referral ? (contactByName.get(spec.referral)?.id ?? null) : null,
        notes: spec.notes,
        tags: [...spec.tags],
      },
    });
    jobs.push(job);

    // Reconstruct a plausible status history.
    const order: ApplicationStatus[] = [
      "SAVED",
      "APPLIED",
      "PHONE_SCREEN",
      "INTERVIEW",
      "ONSITE",
      "OFFER",
      "HIRED",
      "REJECTED",
      "WITHDRAWN",
    ];
    const appliedOffset = spec.applied ?? 0;
    const target = order.indexOf(spec.status);
    if (spec.status !== "SAVED" && spec.applied !== null) {
      const stop = spec.status === "REJECTED" || spec.status === "WITHDRAWN" ? target - 1 : target;
      for (let i = 1; i <= stop; i++) {
        await db.statusEvent.create({
          data: {
            userId: user.id,
            jobId: job.id,
            fromStatus: order[i - 1]!,
            toStatus: order[i]!,
            createdAt: at(appliedOffset + i * 2),
          },
        });
      }
    }
  }

  const jobByTitle = new Map(jobs.map((j) => [j.title, j]));

  // --- Templates -----------------------------------------------------------
  const templates = [
    {
      name: "Cold outreach — hiring manager",
      category: "COLD_OUTREACH",
      isFavorite: true,
      subject: "{{jobTitle}} at {{company}} — quick question",
      body: "Hi {{firstName}},\n\nI saw you're hiring for the {{jobTitle}} role at {{company}}. I've spent the last few years on distributed backend systems and would be glad to hear what the team is prioritising this quarter.\n\nWould you be open to a 15-minute call, or is there someone better placed to answer?\n\nBest,\n{{senderName}}",
    },
    {
      name: "Follow-up after applying",
      category: "FOLLOW_UP",
      isFavorite: true,
      subject: "Following up — {{jobTitle}} at {{company}}",
      body: "Hi {{firstName}},\n\nI applied for the {{jobTitle}} role at {{company}} a little while ago and wanted to check whether the position is still open.\n\nI'm happy to share more detail on my background, or to re-tailor my resume if that's useful.\n\nBest,\n{{senderName}}",
    },
    {
      name: "Referral request",
      category: "REFERRAL_REQUEST",
      isFavorite: false,
      subject: "Would you refer me for {{jobTitle}} at {{company}}?",
      body: "Hi {{firstName}},\n\nI'm applying for the {{jobTitle}} role at {{company}} and wondered whether you'd be comfortable referring me.\n\nI know referrals carry weight, so no pressure at all — and I'd be glad to send over a short summary you could forward if you think it's worth it.\n\nThanks,\n{{senderName}}",
    },
    {
      name: "Thank-you after an interview",
      category: "THANK_YOU",
      isFavorite: false,
      subject: "Thank you — {{jobTitle}} at {{company}}",
      body: "Hi {{firstName}},\n\nThanks for taking the time to speak with me about the {{jobTitle}} role. The discussion about the team's priorities was especially useful.\n\nI'm happy to follow up on anything else you need.\n\nBest,\n{{senderName}}",
    },
  ] as const;

  for (const spec of templates) {
    await db.emailTemplate.create({ data: { userId: user.id, ...spec } });
  }

  // --- Outreach ------------------------------------------------------------
  const outreach = [
    {
      contact: "Amara Osei",
      subject: "Staff Platform Engineer at Northwind Labs — quick question",
      body: "Hi Amara,\n\nI saw the Staff Platform Engineer role open at Northwind Labs and wanted to introduce myself. I've spent the last few years on distributed backend systems and would be glad to hear what the team is prioritising this quarter.\n\nWould you be open to a 15-minute call?\n\nBest,\nDana",
      sentDaysAgo: 6,
      status: "REPLIED",
    },
    {
      contact: "Ben Alvarez",
      subject: "Would you refer me for Principal Software Engineer?",
      body: "Hi Ben,\n\nI'm applying for the Principal Software Engineer role at Fabrikam and wondered whether you'd be comfortable referring me. Happy to send over a summary you could forward.\n\nThanks,\nDana",
      sentDaysAgo: 21,
      status: "REPLIED",
    },
    {
      contact: "Omar Haddad",
      subject: "Senior Backend Engineer at Proseware — quick question",
      body: "Hi Omar,\n\nI came across the Senior Backend Engineer role at Proseware and would love to hear more about what the team is working on.\n\nHappy to chat if you're the right person for this.\n\nBest,\nDana",
      sentDaysAgo: 4,
      status: "SENT",
    },
    {
      contact: "Hana Kobayashi",
      subject: "Following up — Backend Engineer at Tailspin Toys",
      body: "Hi Hana,\n\nI applied for the Backend Engineer role at Tailspin Toys a few weeks ago and wanted to check whether it's still open.\n\nBest,\nDana",
      sentDaysAgo: 16,
      status: "SENT",
    },
    {
      contact: "Grace Chen",
      subject: "Infrastructure Engineer at Proseware — quick question",
      body: "Hi Grace,\n\nI'm looking at the Infrastructure Engineer role at Proseware and would value any insight you could share about the team.\n\nBest,\nDana",
      sentDaysAgo: 40,
      status: "SENT",
    },
  ] as const;

  for (const spec of outreach) {
    const contact = contactByName.get(spec.contact)!;
    const sentAt = at(-spec.sentDaysAgo, 9, 15);

    const outbound = await db.email.create({
      data: {
        userId: user.id,
        contactId: contact.id,
        direction: "OUTBOUND",
        category: spec.contact === "Ben Alvarez" ? "REFERRAL_REQUEST" : "COLD_OUTREACH",
        status: spec.status,
        toEmail: contact.email,
        toName: contact.name,
        fromEmail: "you@example.com",
        subject: spec.subject,
        body: spec.body,
        sentAt,
        createdAt: sentAt,
        messageId: `<seed-${contact.id}@jobsearch-crm.local>`,
      },
    });

    await db.emailDelivery.create({
      data: {
        userId: user.id,
        emailId: outbound.id,
        attempt: 1,
        status: "SENT",
        provider: "seed",
        providerMessageId: outbound.messageId,
        createdAt: sentAt,
      },
    });

    if (spec.status === "REPLIED") {
      const repliedAt = at(-spec.sentDaysAgo + 2, 11, 40);
      const inbound = await db.email.create({
        data: {
          userId: user.id,
          contactId: contact.id,
          direction: "INBOUND",
          category: "RECRUITER_REPLY",
          status: "SENT",
          toEmail: "you@example.com",
          fromEmail: contact.email,
          subject: `Re: ${spec.subject}`,
          body:
            spec.contact === "Amara Osei"
              ? "Hi Dana,\n\nThanks for reaching out. The team is mid-way through a storage migration so that's a live problem right now. Are you free Thursday for 20 minutes?\n\nAmara"
              : "Happy to refer you — let me send something over to the hiring manager and see what they think.\n\nBen",
          sentAt: repliedAt,
          createdAt: repliedAt,
          inReplyToId: outbound.id,
        },
      });

      await db.email.update({
        where: { id: outbound.id },
        data: { repliedAt },
      });

      await db.emailDelivery.create({
        data: {
          userId: user.id,
          emailId: inbound.id,
          attempt: 1,
          status: "SENT",
          provider: "seed",
          createdAt: repliedAt,
        },
      });
    }
  }

  // --- Tasks ---------------------------------------------------------------
  const tasks = [
    { title: "Technical screen with Amara (Northwind)", type: "INTERVIEW", due: at(1, 14), priority: "HIGH", job: "Staff Platform Engineer", status: "OPEN" },
    { title: "Onsite debrief — Fabrikam Logistics", type: "INTERVIEW", due: at(3, 9), priority: "HIGH", job: "Principal Software Engineer", status: "OPEN" },
    { title: "Send thank-you note after the onsite", type: "EMAIL", due: at(3, 17), priority: "MEDIUM", job: "Principal Software Engineer", status: "OPEN" },
    { title: "Decide on the Litware offer", type: "CALL", due: at(2, 12), priority: "URGENT", job: "Senior Engineer, Payments", status: "OPEN" },
    { title: "Follow up with Omar at Proseware", type: "FOLLOW_UP", due: at(-2, 9), priority: "MEDIUM", job: "Senior Backend Engineer", status: "OPEN" },
    { title: "Research Contoso interview loop", type: "RESEARCH", due: at(-4, 9), priority: "MEDIUM", job: "Engineering Manager, Platform", status: "OPEN" },
    { title: "Apply to Contoso — Senior Software Engineer", type: "APPLY", due: at(2, 9), priority: "HIGH", job: "Senior Software Engineer", status: "OPEN" },
    { title: "Ask Marcus for an internal introduction", type: "CALL", due: at(0, 16), priority: "HIGH", job: "Engineering Manager, Platform", status: "OPEN" },
    { title: "Draft referral ask for Ben", type: "EMAIL", due: at(-6, 9), priority: "LOW", job: "Principal Software Engineer", status: "DONE" },
    { title: "Update resume with the payments project", type: "RESEARCH", due: at(-9, 9), priority: "LOW", job: null, status: "DONE" },
  ] as const;

  for (const spec of tasks) {
    const job = spec.job ? jobByTitle.get(spec.job) : null;
    await db.task.create({
      data: {
        userId: user.id,
        title: spec.title,
        description: null,
        taskType: spec.type,
        status: spec.status,
        priority: spec.priority,
        dueAt: spec.due,
        completedAt: spec.status === "DONE" ? at(-1, 15) : null,
        jobId: job?.id ?? null,
        contactId: null,
        emailId: null,
      },
    });
  }

  // --- Notes ---------------------------------------------------------------
  const notes = [
    { body: "Northwind storage migration is the centrepiece of the role. Read the engineering blog post on their sharding approach before the second round.", type: "COMPANY_RESEARCH", job: "Staff Platform Engineer" },
    { body: "Screening call with Amara. She was clear the team cares about operational maturity more than raw algorithmic speed. Emphasise the on-call rotation I ran at my last job.", type: "SCREENING", job: "Staff Platform Engineer" },
    { body: "Onsite debrief covered system design (borderline), coding (strong) and values (strong). Tobias mentioned a possible offer but wants to sync with the Director first.", type: "INTERVIEW", job: "Principal Software Engineer" },
    { body: "Marcus says the Contoso EM role is likely to grow into a team of three. He is happy to make an introduction if I apply formally first.", type: "REFERRAL", job: "Engineering Manager, Platform" },
    { body: "Litware offer: 135k base, 8% bonus, 28 days holiday, hybrid London. Two weeks to decide. Worth comparing against Northwind before responding.", type: "GENERAL", job: "Senior Engineer, Payments" },
    { body: "Grace is on the platform team at Proseware and knows Marcus. Worth keeping warm even if the Infrastructure role was a stretch.", type: "GENERAL", job: null },
  ] as const;

  for (const spec of notes) {
    const job = spec.job ? jobByTitle.get(spec.job) : null;
    await db.note.create({
      data: {
        userId: user.id,
        body: spec.body,
        noteType: spec.type,
        jobId: job?.id ?? null,
        contactId: null,
        isPinned: spec.job === "Staff Platform Engineer",
      },
    });
  }

  // --- Activity log --------------------------------------------------------
  const activityEntries = [
    { action: "STATUS_CHANGED", entityType: "JOB", summary: "Staff Platform Engineer at Northwind Labs: INTERVIEW → ONSITE", job: "Staff Platform Engineer" },
    { action: "STATUS_CHANGED", entityType: "JOB", summary: "Senior Engineer, Payments at Litware: INTERVIEW → OFFER", job: "Senior Engineer, Payments" },
    { action: "EMAIL_SENT", entityType: "EMAIL", summary: "Sent \"Senior Backend Engineer at Proseware — quick question\" to omar@proseware.example.com", job: "Senior Backend Engineer" },
    { action: "EMAIL_REPLIED", entityType: "EMAIL", summary: "Reply from amara.osei@northwind.example.com", job: "Staff Platform Engineer" },
    { action: "CREATED", entityType: "JOB", summary: "Added Senior SRE at Northwind Labs", job: "Senior SRE" },
    { action: "TASK_COMPLETED", entityType: "TASK", summary: "Completed: Update resume with the payments project", job: null },
    { action: "NOTE_ADDED", entityType: "NOTE", summary: "Added an interview note", job: "Principal Software Engineer" },
  ] as const;

  let offset = 0;
  for (const spec of activityEntries) {
    const job = spec.job ? jobByTitle.get(spec.job) : null;
    await db.activityEvent.create({
      data: {
        userId: user.id,
        action: spec.action,
        entityType: spec.entityType,
        entityId: job?.id ?? user.id,
        summary: spec.summary,
        jobId: job?.id ?? null,
        createdAt: at(-(offset += 2), 11),
      },
    });
  }

  console.log(
    [
      "",
      "Demo data created.",
      "",
      `  Email:    ${DEMO_EMAIL}`,
      `  Password: ${DEMO_PASSWORD}`,
      "",
      `  ${companies.length} companies · ${contacts.length} contacts · ${jobs.length} applications`,
      "",
      "To regenerate this data later:",
      "  npm run db:seed -- --demo --reset",
      "",
    ].join("\n"),
  );
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
