import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import { ReportRequestHistory } from "../../src/features/report-ordering/components/report-request-history";
import type { ReportRequestRow } from "../../src/features/report-ordering/view-model";

const readyRow: ReportRequestRow = {
  key: "rjob_1",
  reportLabel: "Portfolio review",
  reportDate: "14 Aug 2026",
  requestedAt: "14 Aug 2026, 09:30",
  statusLabel: "In progress",
  statusDetail: "Approved report creation is in progress.",
  tone: "warn",
  supportReference: "rjob_1",
};

describe("ReportRequestHistory", () => {
  it("renders the same source-backed lifecycle fields in workstation and compact presentations", () => {
    renderHistory({ rows: [readyRow], currentReportJobId: "rjob_1", state: "ready" });

    const table = screen.getByRole("table", { name: "Recent portfolio report requests" });
    expect(within(table).getByText("Portfolio review")).toBeInTheDocument();
    expect(within(table).getByText("14 Aug 2026")).toBeInTheDocument();
    expect(within(table).getByText("14 Aug 2026, 09:30")).toBeInTheDocument();
    expect(within(table).getByText("In progress")).toBeInTheDocument();
    expect(within(table).getByText("Approved report creation is in progress.")).toBeInTheDocument();
    expect(within(table).getByText("rjob_1")).toBeInTheDocument();
    expect(within(table).getByText("Current request")).toBeInTheDocument();

    const compactList = screen.getByRole("list", {
      name: "Recent portfolio report request details",
    });
    expect(
      within(compactList).getByText("Current request — Portfolio review"),
    ).toBeInTheDocument();
    expect(within(compactList).getByText("14 Aug 2026")).toBeInTheDocument();
    expect(within(compactList).getByText("14 Aug 2026, 09:30")).toBeInTheDocument();
    expect(within(compactList).getByText("In progress")).toBeInTheDocument();
    expect(
      within(compactList).getByText("Approved report creation is in progress."),
    ).toBeInTheDocument();
    expect(within(compactList).getByText("rjob_1")).toBeInTheDocument();
    expect(
      within(compactList).getByRole("article", {
        name: "Current request — Portfolio review",
      }),
    ).toBeInTheDocument();
    expect(
      within(compactList).getByText("Support reference").closest("summary"),
    ).toBeInTheDocument();
  });

  it("keeps loading and empty states explicit for both responsive presentations", () => {
    const { rerender } = renderHistory({ rows: [], state: "loading" });
    expect(screen.getAllByText("Loading recent requests")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();

    rerender(
      <ReportRequestHistory
        rows={[]}
        currentReportJobId={null}
        state="ready"
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByText("No report requests yet")).toHaveLength(2);
  });

  it("keeps compact history bounded while retaining every source record", () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      ...readyRow,
      key: `rjob_${index + 1}`,
      supportReference: `rjob_${index + 1}`,
      requestedAt: `14 Aug 2026, 09:${30 - index}`,
    }));

    renderHistory({
      rows,
      currentReportJobId: "rjob_6",
      state: "ready",
    });

    const recent = screen.getByRole("list", {
      name: "Recent portfolio report request details",
    });
    expect(within(recent).getAllByRole("article")).toHaveLength(3);
    expect(
      within(recent).getByRole("article", {
        name: "Current request — Portfolio review",
      }),
    ).toHaveTextContent("rjob_6");
    expect(within(recent).getByText("rjob_1")).toBeInTheDocument();
    expect(within(recent).getByText("rjob_2")).toBeInTheDocument();

    expect(screen.getByText("Show 3 more retained requests")).toBeInTheDocument();
    const retained = screen.getByRole("list", {
      name: "Additional retained portfolio report request details",
    });
    expect(within(retained).getAllByRole("article")).toHaveLength(3);
    expect(within(retained).getByText("rjob_3")).toBeInTheDocument();
    expect(within(retained).getByText("rjob_5")).toBeInTheDocument();
  });

  it("keeps previously confirmed records visible with one shared refresh status", () => {
    renderHistory({ rows: [readyRow], state: "loading" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Refreshing recent requests. Previously confirmed lifecycle evidence remains visible.",
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(
      within(screen.getByRole("table", { name: "Recent portfolio report requests" })).getByText(
        "Portfolio review",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("list", { name: "Recent portfolio report request details" }),
      ).getByText("Portfolio review"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading recent requests")).not.toBeInTheDocument();
  });

  it.each([
    {
      state: "permission_blocked" as const,
      title: "Recent requests are restricted",
      error: "Your business role cannot review report request history.",
    },
    {
      state: "error" as const,
      title: "Recent requests unavailable",
      error: "Report request history could not be refreshed.",
    },
  ])("renders the $state state with an explicit recovery action", ({ state, title, error }) => {
    const onRefresh = vi.fn();
    renderHistory({ rows: [], state, error, onRefresh });

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(error)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

function renderHistory({
  rows,
  currentReportJobId = null,
  state,
  error = null,
  onRefresh = vi.fn(),
}: {
  rows: ReportRequestRow[];
  currentReportJobId?: string | null;
  state: "loading" | "ready" | "permission_blocked" | "error";
  error?: string | null;
  onRefresh?: () => void;
}) {
  return render(
    <ReportRequestHistory
      rows={rows}
      currentReportJobId={currentReportJobId}
      state={state}
      error={error}
      onRefresh={onRefresh}
    />,
  );
}
