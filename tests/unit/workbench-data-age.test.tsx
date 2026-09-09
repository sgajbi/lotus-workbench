import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkbenchDataAge, {
  formatWorkbenchDataAge,
  getOldestWorkbenchReceiptTime,
} from "@/design-system/components/workbench-data-age";

describe("WorkbenchDataAge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the oldest contributing receipt and fails closed when one is missing", () => {
    expect(getOldestWorkbenchReceiptTime(300, 100, 200)).toBe(100);
    expect(getOldestWorkbenchReceiptTime(300, null, 200)).toBeNull();
    expect(getOldestWorkbenchReceiptTime(300, 0, 200)).toBeNull();
    expect(getOldestWorkbenchReceiptTime()).toBeNull();
  });

  it("keeps receipt time distinct from source business date", () => {
    const now = Date.parse("2026-09-09T02:00:00.000Z");
    const updatedAt = now - 2 * 60_000;

    render(
      <WorkbenchDataAge
        updatedAt={updatedAt}
        now={now}
        subject="Portfolio evidence"
      />,
    );

    const time = screen.getByText("Checked 2 min ago");
    expect(time).toHaveAttribute(
      "datetime",
      "2026-09-09T01:58:00.000Z",
    );
    expect(time).toHaveAttribute(
      "title",
      "Exact check time: 09 Sept 2026, 01:58 UTC",
    );
    expect(time).toHaveAccessibleName(
      "Portfolio evidence checked 2 minutes ago. Exact check time 09 Sept 2026, 01:58 UTC.",
    );
    expect(screen.queryByText(/as of/i)).not.toBeInTheDocument();
  });

  it("fails closed for missing, invalid, and materially future receipt times", () => {
    const now = Date.parse("2026-09-09T02:00:00.000Z");
    const { rerender } = render(
      <WorkbenchDataAge updatedAt={null} now={now} subject="Portfolio evidence" />,
    );

    expect(screen.getByText("Check time unavailable")).toHaveAccessibleName(
      "Portfolio evidence check time unavailable.",
    );
    expect(screen.queryByRole("time")).not.toBeInTheDocument();

    rerender(
      <WorkbenchDataAge updatedAt={Number.NaN} now={now} subject="Portfolio evidence" />,
    );
    expect(screen.getByText("Check time unavailable")).toBeInTheDocument();

    rerender(
      <WorkbenchDataAge
        updatedAt={now + 61_000}
        now={now}
        subject="Portfolio evidence"
      />,
    );
    expect(screen.getByText("Check time unavailable")).toBeInTheDocument();
  });

  it("updates relative text without contacting any source", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-09T02:00:00.000Z");
    const updatedAt = Date.now() - 59_000;

    render(
      <WorkbenchDataAge
        updatedAt={updatedAt}
        subject="Portfolio evidence"
      />,
    );

    expect(screen.getByText("Checked just now")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("Checked 1 min ago")).toBeInTheDocument();
  });

  it.each([
    [0, "Checked just now"],
    [60_000, "Checked 1 min ago"],
    [2 * 60_000, "Checked 2 min ago"],
    [60 * 60_000, "Checked 1 hr ago"],
    [3 * 60 * 60_000, "Checked 3 hrs ago"],
    [24 * 60 * 60_000, "Checked 08 Sept 2026, 02:00 UTC"],
  ])("formats an age of %i ms as %s", (ageMs, expected) => {
    const now = Date.parse("2026-09-09T02:00:00.000Z");
    expect(formatWorkbenchDataAge(now - ageMs, now)?.visibleLabel).toBe(
      expected,
    );
  });
});
