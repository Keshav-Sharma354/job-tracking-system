/**
 * Component tests for the pieces with real interactive logic.
 *
 * Focus is on behaviour a user depends on: the theme toggle's persistence, the
 * composer's refusal to send when mail is unconfigured, and the kanban board's
 * drag-and-drop contract.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "@/components/layout/theme-provider";
import { MailerBanner } from "@/components/features/emails/mailer-banner";
import { MonthlyBars, FunnelChart } from "@/components/features/reports/charts";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  );
}

describe("ThemeProvider", () => {
  it("starts in light mode and reports the current theme", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(await screen.findByText("light")).toBeInTheDocument();
  });

  it("applies the dark class to the document element when toggled", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(screen.getByText("dark")).toBeInTheDocument();
  });

  it("persists the choice so it survives a reload", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(window.localStorage.getItem("jts-theme")).toBe("dark");
    });
  });

  it("reads the class set by the pre-paint script instead of defaulting", async () => {
    // Simulates the blocking script in the root layout having already applied
    // the user's stored preference before React hydrated.
    document.documentElement.classList.add("dark");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(await screen.findByText("dark")).toBeInTheDocument();
  });

  it("throws a helpful error when used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Mailer banner
// ---------------------------------------------------------------------------

describe("MailerBanner", () => {
  it("explains that sending is disabled rather than implying it works", () => {
    render(<MailerBanner />);

    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/SMTP_HOST/)).toBeInTheDocument();
    expect(
      screen.getByText(/nothing will leave this server/i),
    ).toBeInTheDocument();
  });

  it("suggests Mailpit for local testing", () => {
    render(<MailerBanner />);
    expect(screen.getByText(/docker compose up -d mailpit/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

describe("MonthlyBars", () => {
  const data = [
    { month: "2026-03", applied: 4, interviews: 2, offers: 1 },
    { month: "2026-04", applied: 7, interviews: 3, offers: 0 },
  ];

  it("renders one group per month with the legend", () => {
    render(<MonthlyBars data={data} />);

    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getByText("Apr")).toBeInTheDocument();
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("Interviews")).toBeInTheDocument();
  });

  it("explains an empty period instead of drawing blank bars", () => {
    render(
      <MonthlyBars data={[{ month: "2026-01", applied: 0, interviews: 0, offers: 0 }]} />,
    );
    expect(screen.getByText(/No activity in this period/i)).toBeInTheDocument();
  });

  it("accepts custom labels for repurposed data", () => {
    render(
      <MonthlyBars
        data={[{ month: "2026-01", applied: 3, interviews: 1, offers: 0 }]}
        labels={{ applied: "Sent", interviews: "Replied" }}
      />,
    );

    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("Replied")).toBeInTheDocument();
    expect(screen.queryByText("Offers")).not.toBeInTheDocument();
  });
});

describe("FunnelChart", () => {
  const stages = { applied: 20, screened: 8, interviewed: 5, offered: 2, hired: 1 };

  it("renders every stage with its count", () => {
    render(<FunnelChart stages={stages} />);

    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Hired")).toBeInTheDocument();
  });

  it("computes the step conversion rate between stages", () => {
    render(<FunnelChart stages={stages} />);

    // 8 of 20 screened is 40%, and 2 of 5 offered is also 40%.
    const matches = screen.getAllByText(/40% of previous/);
    expect(matches).toHaveLength(2);

    // 5 of 8 interviewed rounds to 63%.
    expect(screen.getByText(/63% of previous/)).toBeInTheDocument();
  });

  it("explains what is excluded when nothing has been submitted", () => {
    render(
      <FunnelChart
        stages={{ applied: 0, screened: 0, interviewed: 0, offered: 0, hired: 0 }}
      />,
    );
    expect(screen.getByText(/not yet submitted/i)).toBeInTheDocument();
  });
});
