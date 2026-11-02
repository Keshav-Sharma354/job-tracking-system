/**
 * Lightweight SVG charts.
 *
 * Hand-rolled rather than pulled from a charting library: these are three
 * specific visualisations, and a dependency would add far more weight than the
 * ~100 lines needed here. All values are formatted server-side and passed in as
 * plain numbers, so no chart code runs in the browser bundle.
 */

const BAR_COLORS = {
  applied: "bg-sky-500",
  interviews: "bg-amber-500",
  offers: "bg-emerald-500",
} as const;

const BAR_LABELS = {
  applied: "Applied",
  interviews: "Interviews",
  offers: "Offers",
} as const;

export interface MonthlyPoint {
  month: string;
  applied: number;
  interviews: number;
  offers: number;
}

export type BarLabels = Partial<Record<keyof typeof BAR_COLORS, string>>;

export function MonthlyBars({
  data,
  labels = BAR_LABELS,
}: {
  data: MonthlyPoint[];
  labels?: BarLabels;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.applied, d.interviews, d.offers]));

  if (data.every((d) => d.applied + d.interviews + d.offers === 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted">No activity in this period.</p>
    );
  }

  return (
    <div>
      <div className="flex h-40 items-end gap-3">
        {data.map((point) => (
          <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-1">
              {(["applied", "interviews", "offers"] as const).map((key) =>
                labels[key] ? (
                  <div
                    key={key}
                    title={`${labels[key]}: ${point[key]}`}
                    className={`w-full max-w-6 rounded-t ${BAR_COLORS[key]}`}
                    style={{
                      height: `${Math.max(point[key] > 0 ? 4 : 0, (point[key] / max) * 100)}%`,
                    }}
                  />
                ) : null,
              )}
            </div>
            <span className="truncate text-[0.625rem] text-subtle">
              {monthLabel(point.month)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {(["applied", "interviews", "offers"] as const).map((key) =>
          labels[key] ? (
            <span key={key} className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-2.5 rounded-sm ${BAR_COLORS[key]}`} aria-hidden />
              {labels[key]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

const FUNNEL_STAGES = [
  { key: "applied", label: "Submitted", color: "bg-sky-500" },
  { key: "screened", label: "Screened", color: "bg-violet-500" },
  { key: "interviewed", label: "Interviewed", color: "bg-amber-500" },
  { key: "offered", label: "Offered", color: "bg-emerald-500" },
  { key: "hired", label: "Hired", color: "bg-green-600" },
] as const;

export function FunnelChart({
  stages,
}: {
  stages: {
    applied: number;
    screened: number;
    interviewed: number;
    offered: number;
    hired: number;
  };
}) {
  const top = Math.max(1, stages.applied);

  return (
    <div className="space-y-3">
      {FUNNEL_STAGES.map((stage, index) => {
        const value = stages[stage.key];
        const width = (value / top) * 100;
        const previous = index === 0 ? null : stages[FUNNEL_STAGES[index - 1]!.key];
        const conversion =
          previous && previous > 0 ? Math.round((value / previous) * 100) : null;

        return (
          <div key={stage.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-foreground">{stage.label}</span>
              <span className="text-muted">
                <span className="font-medium tabular-nums text-foreground">
                  {value}
                </span>
                {conversion !== null ? (
                  <span className="ml-1.5 text-xs text-subtle">
                    {conversion}% of previous
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={`h-full rounded-full ${stage.color}`}
                style={{ width: `${Math.max(value > 0 ? 2 : 0, width)}%` }}
              />
            </div>
          </div>
        );
      })}

      {stages.applied === 0 ? (
        <p className="pt-1 text-xs text-subtle">
          Applications you have not yet submitted are not counted here.
        </p>
      ) : null}
    </div>
  );
}

/** `2026-05` → `May` */
function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}
