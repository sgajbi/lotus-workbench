import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PerformanceWorkspaceView from "../../src/apps/performance/components/performance-workspace-view";
import {
  buildNormalizedControlsPerformanceScenario,
  buildSupportedEvidencePerformanceScenario,
  buildSupportedPerformanceScenario,
  buildUnavailableAttributionPerformanceScenario,
  buildUnavailableEvidencePerformanceScenario,
} from "../fixtures/performance-workspace-fixtures";
import type { PerformanceWorkspaceMode } from "../../src/apps/performance/performance-workspace-modes";

const summaryModeMock = vi.fn((_: unknown) => <div>Summary Mode Panel</div>);
const analysisModeMock = vi.fn((_: unknown) => <div>Analysis Mode Panel</div>);
const riskModeMock = vi.fn((_: unknown) => <div>Risk Mode Panel</div>);
const evidenceModeMock = vi.fn((_: unknown) => <div>Evidence Mode Panel</div>);

vi.mock("../../src/apps/performance/components/performance-summary-mode", () => ({
  default: (props: unknown) => summaryModeMock(props),
}));

vi.mock("../../src/apps/performance/components/performance-analysis-mode", () => ({
  default: (props: unknown) => analysisModeMock(props),
}));

vi.mock("../../src/apps/performance/components/performance-risk-mode", () => ({
  default: (props: unknown) => riskModeMock(props),
}));

vi.mock("../../src/apps/performance/components/performance-evidence-mode", () => ({
  default: (props: unknown) => evidenceModeMock(props),
}));

describe("PerformanceWorkspaceView", () => {
  beforeEach(() => {
    summaryModeMock.mockClear();
    analysisModeMock.mockClear();
    riskModeMock.mockClear();
    evidenceModeMock.mockClear();
  });

  function renderWorkspaceView({
    mode = "summary",
    workspace = buildSupportedPerformanceScenario().workspace,
    isDetailsPending = false,
    refreshStatus = null,
    onRetryRefresh,
    sourceReceipt,
  }: {
    mode?: PerformanceWorkspaceMode;
    workspace?: ReturnType<typeof buildSupportedPerformanceScenario>["workspace"] | null;
    isDetailsPending?: boolean;
    refreshStatus?: React.ComponentProps<typeof PerformanceWorkspaceView>["refreshStatus"];
    onRetryRefresh?: () => void;
    sourceReceipt?: React.ComponentProps<typeof PerformanceWorkspaceView>["sourceReceipt"];
  }) {
    function Harness() {
      const [selectedMode, setSelectedMode] = React.useState<PerformanceWorkspaceMode>(mode);

      return (
        <PerformanceWorkspaceView
          workspace={workspace}
          mode={selectedMode}
          period="YTD"
          detailBasis="NET"
          contributionDimension="asset_class"
          attributionDimension="asset_class"
          chartFrequency="monthly"
          onModeChange={setSelectedMode}
          isDetailsPending={isDetailsPending}
          refreshStatus={refreshStatus}
          onRetryRefresh={onRetryRefresh}
          sourceReceipt={sourceReceipt}
        />
      );
    }

    return render(<Harness />);
  }

  function getWorkflowControl(name: string | RegExp) {
    const visibleControl = screen.queryByRole("button", { name });
    if (visibleControl) {
      return visibleControl;
    }

    const changeStep = screen.getByRole("button", {
      name: /Change workflow step/i,
    });
    if (changeStep.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(changeStep);
    }
    return screen.getByRole("button", { name });
  }

  it("keeps summary mode as the only mounted mode on initial render", async () => {
    const scenario = buildSupportedPerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace });

    expect(screen.getByRole("button", { name: "Performance overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await waitFor(() => {
      expect(screen.getByText("Summary Mode Panel")).toBeInTheDocument();
    });

    expect(summaryModeMock).toHaveBeenCalledTimes(1);
    expect(analysisModeMock).not.toHaveBeenCalled();
    expect(riskModeMock).not.toHaveBeenCalled();
    expect(evidenceModeMock).not.toHaveBeenCalled();
    expect(document.querySelector(".workbench-deferred-placeholder")).toBeFalsy();
    expect(screen.queryByText("Analysis Mode Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence Mode Panel")).not.toBeInTheDocument();
  });

  it("passes contract-backed evidence capability into evidence mode from the shared scenario", async () => {
    const scenario = buildUnavailableEvidencePerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace });

    expect(getWorkflowControl(/^Evidence/i)).toBeDisabled();
    expect(screen.queryByRole("group", { name: "Performance mode readiness" })).not.toBeInTheDocument();
  });

  it("passes the complete source-confirmed review window into evidence assurance", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();

    renderWorkspaceView({ mode: "evidence", workspace: scenario.workspace });

    expect(screen.getByText("Evidence Mode Panel")).toBeInTheDocument();
    expect(evidenceModeMock.mock.calls.at(-1)?.[0]).toMatchObject({
      selection: {
        asOfDate: scenario.workspace.as_of_date,
        period: scenario.workspace.period,
        reportStartDate: scenario.workspace.report_start_date,
        reportEndDate: scenario.workspace.report_end_date,
        basis: scenario.workspace.detail_basis,
        benchmarkCode: scenario.workspace.benchmark_code,
        contributionDimension: scenario.workspace.contribution_dimension,
        attributionDimension: scenario.workspace.attribution_dimension,
      },
    });
  });

  it("disables unavailable evidence mode instead of mounting a dead panel", async () => {
    const scenario = buildUnavailableEvidencePerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace });

    fireEvent.click(getWorkflowControl("Performance overview"));
    expect(getWorkflowControl(/^Evidence/i)).toBeDisabled();
    expect(screen.queryByText("Evidence Mode Panel")).not.toBeInTheDocument();
    expect(evidenceModeMock).not.toHaveBeenCalled();
  });

  it("keeps analysis available when there is at least partial analytical coverage", async () => {
    const scenario = buildSupportedPerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace });

    expect(getWorkflowControl(/^Performance analysis/i)).not.toBeDisabled();
    fireEvent.click(getWorkflowControl(/^Performance analysis/i));
    await waitFor(() => {
      expect(screen.getByText("Analysis Mode Panel")).toBeInTheDocument();
    });
  });

  it("keeps analysis navigable while detail availability is still hydrating", async () => {
    const scenario = buildUnavailableAttributionPerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace, isDetailsPending: true });

    const analysisButton = getWorkflowControl(/^Performance analysis/i);
    expect(analysisButton).not.toBeDisabled();
    expect(analysisButton).toHaveAttribute("title", "Analysis availability is loading.");
    expect(screen.getByText("Loading")).toBeInTheDocument();

    fireEvent.click(analysisButton);
    await waitFor(() => {
      expect(screen.getByText("Analysis Mode Panel")).toBeInTheDocument();
    });
  });

  it("shows a backend-backed control normalization notice when unsupported deep-link controls were adjusted", async () => {
    const scenario = buildNormalizedControlsPerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace });

    const normalizationNotice = screen.getByRole("status", {
      name: "Performance control normalization",
    });
    expect(normalizationNotice).toHaveTextContent("Selection adjusted");
    expect(normalizationNotice).toHaveTextContent("frequency reset to Monthly");
    expect(normalizationNotice).toHaveTextContent(
      "contribution view reset to Asset Class"
    );
    expect(normalizationNotice).toHaveTextContent(
      "attribution view reset to Asset Class"
    );
  });

  it("keeps a pending selection separate from the source-confirmed performance context", () => {
    renderWorkspaceView({
      refreshStatus: {
        kind: "pending",
        scope: "summary",
        requestedContext: "3Y",
        confirmedContext: "YTD · NET returns · Monthly observations",
      },
    });

    const status = screen.getByRole("status", {
      name: "",
    });
    expect(status).toHaveTextContent("Confirming the selected performance view");
    expect(status).toHaveTextContent("Requested3Y");
    expect(status).toHaveTextContent(
      "Source-confirmedYTD · NET returns · Monthly observations"
    );
    expect(screen.getByText("Summary Mode Panel")).toBeInTheDocument();
  });

  it("keeps receipt age and one exact recovery action available across summary-detail modes", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const checkedAt = Date.parse("2026-09-09T01:00:00Z");
    renderWorkspaceView({
      sourceReceipt: {
        checkedAt,
        refreshScope: "PF_1001:performance:YTD",
        isRefreshing: false,
        canRecheck: true,
        onRefresh,
      },
    });

    expect(screen.getByText(/^Checked /)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recheck performance" }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));

    fireEvent.click(getWorkflowControl(/^Performance analysis/i));
    expect(screen.getAllByRole("button", { name: "Recheck performance" })).toHaveLength(1);
  });

  it("uses explicit recheck copy without relabelling source business freshness", () => {
    const onRetryRefresh = vi.fn();
    renderWorkspaceView({
      refreshStatus: {
        kind: "failed",
        intent: "recheck",
        scope: "details",
        requestedContext: "YTD · NET returns · Monthly observations",
        confirmedContext: "YTD · NET returns · Monthly observations",
        status: 502,
      },
      onRetryRefresh,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Performance evidence could not be rechecked");
    expect(alert).toHaveTextContent("previously confirmed view remains in place");
    expect(alert).not.toHaveTextContent(/fresh|current/i);
    expect(
      screen.getByRole("button", { name: "Recheck performance evidence" }),
    ).toBeInTheDocument();
  });

  it("keeps explicit recheck recovery available when source evidence is withheld", () => {
    const onRetryRefresh = vi.fn();
    renderWorkspaceView({
      workspace: null,
      refreshStatus: {
        kind: "failed",
        intent: "recheck",
        scope: "summary",
        requestedContext: "YTD · NET returns · Monthly observations",
        confirmedContext: "YTD · NET returns · Monthly observations",
        status: 403,
      },
      onRetryRefresh,
    });

    expect(
      screen.getByText("Workspace navigation and route context remain available."),
    ).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Performance evidence could not be rechecked");
    const retry = screen.getByRole("button", { name: "Recheck performance evidence" });
    fireEvent.click(retry);
    expect(onRetryRefresh).toHaveBeenCalledTimes(1);
  });

  it("presents a failed detail selection as a recoverable business exception", () => {
    const onRetryRefresh = vi.fn();
    renderWorkspaceView({
      refreshStatus: {
        kind: "failed",
        scope: "details",
        requestedContext: "Sector contribution",
        confirmedContext: "YTD · NET returns · Monthly observations",
        status: 502,
      },
      onRetryRefresh,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Contribution and attribution detail could not be confirmed");
    expect(alert).toHaveTextContent("Source request returned HTTP 502");
    const retry = screen.getByRole("button", { name: "Retry performance selection" });
    fireEvent.click(retry);
    expect(onRetryRefresh).toHaveBeenCalledTimes(1);
  });

  it("announces compact source-confirmed context without repeating settled transaction detail", () => {
    renderWorkspaceView({
      refreshStatus: {
        kind: "confirmed",
        scope: "summary",
        requestedContext: "3Y",
        confirmedContext: "3Y · NET returns · Monthly observations",
      },
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Performance selection confirmed");
    expect(status).toHaveTextContent("3Y · NET returns · Monthly observations");
    expect(status).not.toHaveTextContent("now source-confirmed");
    expect(status).not.toHaveTextContent("Requested");
    expect(status).not.toHaveTextContent("Source-confirmed");
    expect(screen.queryByRole("button", { name: "Retry performance selection" }))
      .not.toBeInTheDocument();
  });

  it("switches between summary, analysis, risk, and evidence modes", async () => {
    const scenario = buildSupportedPerformanceScenario();

    renderWorkspaceView({ workspace: scenario.workspace });

    expect(document.querySelector(".main-with-side-rail-layout.workstation-shell-both")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-rail.performance-rail-shell")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-main")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-side.performance-side")).toBeTruthy();
    expect(document.querySelector(".workspace-layout")).toBeFalsy();
    expect(document.querySelector(".lotus-workstation-header")).toBeFalsy();
    expect(document.querySelector(".workbench-page-frame.performance-page-frame")).toBeTruthy();
    expect(document.querySelector(".workbench-page-frame-header.workbench-page-header")).toBeTruthy();
    expect(document.querySelector(".workbench-page-frame-body.performance-page-frame-body")).toBeTruthy();
    expect(document.querySelector(".workbench-section-stack.performance-page-sections")).toBeTruthy();
    expect(screen.queryByText("Selected portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("Performance Surface")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /All workspaces/i }));
    expect(screen.getByRole("link", { name: /^Positions\b/i })).toHaveAttribute(
      "href",
      "/positions?portfolioId=PF_1001"
    );
    expect(screen.getByRole("link", { name: /Performance/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(document.querySelectorAll(".performance-surface-switcher")).toHaveLength(0);
    expect(screen.getByLabelText("Performance surface navigation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Change workflow step/i }));
    expect(
      screen.queryByText(
        "Review benchmark-aware outcome, horizon comparisons, and contributor leadership in one governed performance surface before moving into deeper analysis."
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Current review horizon")).not.toBeInTheDocument();
    expect(screen.queryByText("Supportability")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Move between summary, diagnostics, advisory narrative, and risk review without losing context."
      )
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Performance" })).toBeInTheDocument();
    expect(document.querySelector(".workbench-page-header-subtitle")).toBeFalsy();
    expect(document.querySelector(".workbench-page-header-actions [role='radiogroup']"))
      .toBeFalsy();
    expect(screen.queryByRole("group", { name: "Performance mode readiness" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Performance overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await waitFor(() => {
      expect(screen.getByText("Summary Mode Panel")).toBeInTheDocument();
    });
    expect(summaryModeMock).toHaveBeenCalled();
    expect(summaryModeMock.mock.calls.at(-1)?.[0]).toMatchObject({
      workspace: scenario.workspace,
      selectedBenchmarkCode: scenario.workspace.benchmark_code,
    });
    expect(screen.queryByText("Analysis Mode Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Risk Mode Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence Mode Panel")).not.toBeInTheDocument();

    fireEvent.click(getWorkflowControl(/^Performance analysis/i));
    expect(screen.getByText("Analysis Mode Panel")).toBeInTheDocument();
    expect(analysisModeMock).toHaveBeenCalled();
    expect(analysisModeMock.mock.calls.at(-1)?.[0]).toMatchObject({
      workspace: scenario.workspace,
      chartFrequency: "monthly",
      contributionDimension: "asset_class",
      attributionDimension: "asset_class",
    });
    expect(screen.queryByText("Summary Mode Panel")).not.toBeInTheDocument();

    fireEvent.click(getWorkflowControl(/^Risk review/i));
    await waitFor(() => {
      expect(screen.getByText("Risk Mode Panel")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Risk/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("heading", { name: "Risk" }).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector(".workbench-page-header-subtitle")).toBeFalsy();
    expect(riskModeMock).toHaveBeenCalled();
    expect(riskModeMock.mock.calls.at(-1)?.[0]).toMatchObject({
      workspace: scenario.workspace,
      chartFrequency: "monthly",
      contributionDimension: "asset_class",
      attributionDimension: "asset_class",
    });
    expect(screen.queryByText("Analysis Mode Panel")).not.toBeInTheDocument();

    fireEvent.click(getWorkflowControl(/^Evidence/i));
    expect(getWorkflowControl(/^Evidence/i)).toBeDisabled();
    expect(screen.queryByText("Evidence Mode Panel")).not.toBeInTheDocument();
    expect(evidenceModeMock).not.toHaveBeenCalled();
    expect(screen.getByText("Risk Mode Panel")).toBeInTheDocument();
  });
});
