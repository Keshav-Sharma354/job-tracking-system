/**
 * Button tests.
 *
 * `asChild` renders the caller's element (usually a `<Link>`) instead of a
 * `<button>`, merging the button styles and props onto it. That requires exactly
 * one child — a regression here renders fine in tests but throws at runtime, so
 * it is worth pinning down.
 */
import * as React from "react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders a button element with its text", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls the click handler", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled while loading and reports aria-busy", () => {
    render(<Button loading>Saving…</Button>);
    const button = screen.getByRole("button");

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("does not fire the handler while loading", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button loading onClick={onClick}>
        Saving…
      </Button>,
    );
    await user.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects the disabled prop", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("merges class names so a caller can override the variant", () => {
    render(<Button className="w-full">Save</Button>);
    const button = screen.getByRole("button");

    expect(button.className).toContain("w-full");
    expect(button.className).toContain("inline-flex");
  });

  describe("asChild", () => {
    it("renders the supplied element instead of a <button>", () => {
      render(
        <Button asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Dashboard" });
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/dashboard");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    // The regression that motivated this suite: Radix's Slot throws when it is
    // given more than one child, which is what a sibling spinner/icon would be.
    it("renders without throwing when the child carries its own icon", () => {
      expect(() =>
        render(
          <Button asChild>
            <Link href="/jobs">
              <span data-testid="icon">+</span>
              Add application
            </Link>
          </Button>,
        ),
      ).not.toThrow();

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByRole("link")).toHaveTextContent("Add application");
    });

    it("forwards click handlers to the child", async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button asChild onClick={onClick}>
          <Link href="/jobs">Add</Link>
        </Button>,
      );
      await user.click(screen.getByRole("link"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("applies the button styling to the child element", () => {
      render(
        <Button asChild variant="secondary">
          <Link href="/settings">Settings</Link>
        </Button>,
      );

      const link = screen.getByRole("link");
      expect(link.className).toContain("inline-flex");
      expect(link.className).toContain("bg-surface");
    });

    it("does not render the loading spinner, which would break Slot", () => {
      render(
        <Button asChild loading>
          <Link href="/jobs">Add</Link>
        </Button>,
      );

      // Only the caller's content is present.
      expect(screen.getByRole("link").childElementCount).toBe(0);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
