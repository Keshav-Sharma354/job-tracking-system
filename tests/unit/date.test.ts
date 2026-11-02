import { describe, expect, it } from "vitest";
import {
  buildQuery,
  dueState,
  formatRelativeDue,
  isDueOnDateInZone,
  startOfDayInZone,
  toDateInputValue,
  toDateTimeInputValue,
} from "@/lib/utils/date";

describe("startOfDayInZone", () => {
  it("returns midnight UTC of the calendar day in the given zone", () => {
    // 23:30 UTC on 4 May is already 5 May in Auckland (UTC+12).
    const instant = new Date("2026-05-04T23:30:00.000Z");
    expect(startOfDayInZone(instant, "Pacific/Auckland").toISOString()).toBe(
      "2026-05-05T00:00:00.000Z",
    );
  });

  it("agrees with UTC for a zone with no offset", () => {
    const instant = new Date("2026-05-04T10:00:00.000Z");
    expect(startOfDayInZone(instant, "UTC").toISOString()).toBe(
      "2026-05-04T00:00:00.000Z",
    );
  });
});

describe("isDueOnDateInZone", () => {
  it("treats instants on the same local day as due today", () => {
    const due = new Date("2026-05-04T22:00:00.000Z");
    const reference = new Date("2026-05-04T09:00:00.000Z");
    expect(isDueOnDateInZone(due, reference, "UTC")).toBe(true);
  });

  it("correctly splits an instant across midnight in the user's zone", () => {
    const due = new Date("2026-05-04T23:30:00.000Z");
    const reference = new Date("2026-05-04T10:00:00.000Z");

    // Still the 4th in UTC and in Accra (GMT all year), but already the 5th in
    // Auckland (UTC+12) and in London (BST, UTC+1 in May).
    expect(isDueOnDateInZone(due, reference, "UTC")).toBe(true);
    expect(isDueOnDateInZone(due, reference, "Africa/Accra")).toBe(true);
    expect(isDueOnDateInZone(due, reference, "Pacific/Auckland")).toBe(false);
    expect(isDueOnDateInZone(due, reference, "Europe/London")).toBe(false);
  });

  it("is symmetric: swapping the arguments gives the same answer", () => {
    const a = new Date("2026-05-04T23:30:00.000Z");
    const b = new Date("2026-05-04T10:00:00.000Z");
    expect(isDueOnDateInZone(a, b, "Pacific/Auckland")).toBe(
      isDueOnDateInZone(b, a, "Pacific/Auckland"),
    );
  });
});

describe("dueState", () => {
  const now = new Date("2026-05-04T12:00:00.000Z");

  it.each([
    ["2026-05-01T12:00:00.000Z", "overdue"],
    ["2026-05-04T08:00:00.000Z", "today"],
    ["2026-05-05T08:00:00.000Z", "tomorrow"],
    ["2026-05-08T08:00:00.000Z", "upcoming"],
    ["2026-06-30T08:00:00.000Z", "later"],
  ] as const)("classifies %s as %s", (iso, expected) => {
    expect(dueState(new Date(iso), now)).toBe(expected);
  });
});

describe("formatRelativeDue", () => {
  const now = new Date("2026-05-04T12:00:00.000Z");

  it("uses words for today, tomorrow and yesterday", () => {
    expect(formatRelativeDue(new Date("2026-05-04T18:00:00.000Z"), now)).toBe("today");
    expect(formatRelativeDue(new Date("2026-05-05T09:00:00.000Z"), now)).toBe("tomorrow");
    expect(formatRelativeDue(new Date("2026-05-03T09:00:00.000Z"), now)).toBe("yesterday");
  });

  it("labels past dates as overdue", () => {
    expect(formatRelativeDue(new Date("2026-05-01T09:00:00.000Z"), now)).toBe("3d overdue");
  });

  it("counts forward for near dates", () => {
    expect(formatRelativeDue(new Date("2026-05-07T09:00:00.000Z"), now)).toBe("in 3d");
  });

  it("falls back to an absolute date beyond a month", () => {
    expect(formatRelativeDue(new Date("2026-08-20T09:00:00.000Z"), now)).toBe(
      "Aug 20, 2026",
    );
  });

  it("honours the supplied timezone instead of the server's", () => {
    // 02:00Z is 14:00 on the 4th in Auckland; 12:00Z is already the 5th.
    const now = new Date("2026-05-04T02:00:00.000Z");
    const due = new Date("2026-05-04T12:00:00.000Z");

    expect(formatRelativeDue(due, now, "UTC")).toBe("today");
    expect(formatRelativeDue(due, now, "Pacific/Auckland")).toBe("tomorrow");
  });

  it("renders an em dash for a missing date", () => {
    expect(formatRelativeDue(null, now)).toBe("—");
  });
});

describe("input value formatting", () => {
  it("formats a Date for <input type='date'>", () => {
    expect(toDateInputValue(new Date("2026-05-04T13:45:00.000Z"))).toBe("2026-05-04");
  });

  it("formats a Date for <input type='datetime-local'>", () => {
    expect(toDateTimeInputValue(new Date("2026-05-04T13:45:00.000Z"))).toBe(
      "2026-05-04T13:45",
    );
  });

  it("returns an empty string for null", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateTimeInputValue(undefined)).toBe("");
  });

  it("returns an empty string for an unparsable string", () => {
    expect(toDateInputValue("not-a-date")).toBe("");
  });
});

describe("buildQuery", () => {
  it("drops empty values so URLs stay clean", () => {
    expect(
      buildQuery({ q: "engineer", status: "", page: 2, archived: null }),
    ).toBe("?q=engineer&page=2");
  });

  it("returns an empty string when nothing survives", () => {
    expect(buildQuery({ a: "", b: undefined, c: null })).toBe("");
  });

  it("encodes reserved characters", () => {
    expect(buildQuery({ q: "c++ & rust" })).toBe("?q=c%2B%2B+%26+rust");
  });

  it("keeps false, which is meaningful", () => {
    expect(buildQuery({ archived: false })).toBe("?archived=false");
  });
});
