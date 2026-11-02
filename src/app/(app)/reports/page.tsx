import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import * as analytics from "@/server/services/analytics";
import { outboundVolumeByMonth } from "@/server/repo/emails";
import { Card, CardBody, CardHeader, PageHeader, EmptyState } from "@/components/ui/layout";
import { FunnelChart, MonthlyBars } from "@/components/features/reports/charts";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await requireSession();
  const userId = session.userId;

  const [stats, funnel, monthly, performance, timeToDecision, sources, outreach, contactTypes] =
    await Promise.all([
      analytics.getDashboardStats(userId),
      analytics.getFunnel(userId),
      analytics.getMonthlyPipeline(userId, 6),
      analytics.getCompanyPerformance(userId, 8),
      analytics.getTimeToDecision(userId),
      analytics.getSourceBreakdown(userId),
      outboundVolumeByMonth(userId, 6),
      import("@/server/repo/contacts").then((m) => m.countByContactType(userId)),
    ]);

  const hasData = stats.totalApplications > 0;

  if (!hasData) {
    return (
      <div className="space-y-5">
        <PageHeader title="Reports" />
        <Card>
          <EmptyState
            title="Nothing to report yet"
            description="Once you have tracked a few applications and sent some outreach, this page fills in with conversion rates, response rates and where your pipeline is stalling."
          />
        </Card>
      </div>
    );
  }

  const replyRate = Math.round(stats.emailReplyRate * 100);
  const interviewRate = Math.round(stats.interviewRate * 100);

  const rates = [
    {
      label: "Applications → interview",
      value: interviewRate,
      detail: `${stats.activeApplications} active of ${stats.totalApplications} submitted`,
    },
    {
      label: "Outreach → reply",
      value: replyRate,
      detail: "Share of sent emails that received a reply",
    },
    {
      label: "Interviews → offer",
      value:
        funnel.interviewed > 0
          ? Math.round((funnel.offered / funnel.interviewed) * 100)
          : 0,
      detail: `${funnel.offered} offer(s) from ${funnel.interviewed} interviewed`,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Where your search is working, and where it is stalling."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {rates.map((rate) => (
          <Card key={rate.label}>
            <CardBody>
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-subtle">
                {rate.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {rate.value}%
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, rate.value)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">{rate.detail}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Funnel"
            description="How far your applications get"
          />
          <CardBody>
            <FunnelChart stages={funnel} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Monthly activity"
            description="Applications, interviews and offers"
          />
          <CardBody>
            <MonthlyBars data={monthly} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Outreach volume"
            description="Emails sent and replies received"
          />
          <CardBody>
            <MonthlyBars
              data={outreach.map((point) => ({
                month: point.month,
                applied: point.sent,
                interviews: point.replied,
                offers: 0,
              }))}
              labels={{ applied: "Sent", interviews: "Replied", offers: "" }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Time to decision"
            description="From applying to a final outcome"
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Metric
                label="Median"
                value={
                  timeToDecision.medianDays !== null
                    ? `${timeToDecision.medianDays} days`
                    : "—"
                }
              />
              <Metric
                label="Average"
                value={
                  timeToDecision.averageDays !== null
                    ? `${timeToDecision.averageDays} days`
                    : "—"
                }
              />
            </div>
            <p className="text-xs text-subtle">
              Based on {timeToDecision.decided} application
              {timeToDecision.decided === 1 ? "" : "s"} that reached a decision
              (offer, rejection or withdrawal).
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Companies"
            description="Where you have applied the most"
          />
          <CardBody className="p-0">
            {performance.length === 0 ? (
              <EmptyState title="No applications yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                        Company
                      </th>
                      <th className="px-4 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                        Applied
                      </th>
                      <th className="px-4 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                        Active
                      </th>
                      <th className="px-4 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                        Offers
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((row) => (
                      <tr key={row.companyId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-sm text-foreground">
                          {row.companyName}
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-muted">
                          {row.applications}
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-muted">
                          {row.active}
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-foreground">
                          {row.offers}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sources"
            description="Derived from your application tags"
          />
          <CardBody className="space-y-2.5">
            {sources.length === 0 ? (
              <EmptyState title="No sources recorded" />
            ) : (
              sources.map((source) => (
                <div key={source.source} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-sm text-foreground">
                    {source.source}
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${(source.interviews / Math.max(1, source.total)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                    {source.interviews}/{source.total}
                  </span>
                </div>
              ))
            )}
            <p className="pt-1 text-xs text-subtle">
              Interview rate per source. Tag applications with how you found the
              role (referral, jobboard, recruiter…) to make this useful.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Your network"
          description="Contacts by role"
        />
        <CardBody className="flex flex-wrap gap-2">
          {Object.entries(contactTypes).length === 0 ? (
            <EmptyState title="No contacts yet" />
          ) : (
            Object.entries(contactTypes).map(([type, count]) => (
              <span
                key={type}
                className="rounded-full bg-surface-sunken px-2.5 py-1 text-sm text-muted ring-1 ring-inset ring-border"
              >
                {type.toLowerCase().replace(/_/g, " ")}{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {count}
                </span>
              </span>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-subtle">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
