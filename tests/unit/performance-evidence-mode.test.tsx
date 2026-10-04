import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PerformanceEvidenceMode from "../../src/apps/performance/components/performance-evidence-mode";
import PerformanceReturnPathSummary from "../../src/apps/performance/components/performance-return-path-summary";
import { getPerformanceReturnPathPresentation } from "../../src/apps/performance/components/performance-summary-context-helpers";
import { buildReturnDecisionItems } from "../../src/apps/performance/components/performance-chart-panel-helpers";
import {
  buildPartialEvidencePerformanceScenario,
  buildSupportedEvidencePerformanceScenario,
  buildUnavailableEvidencePerformanceScenario,
} from "../fixtures/performance-workspace-fixtures";

function publishCalculationInputRecord(
  scenario: ReturnType<typeof buildSupportedEvidencePerformanceScenario>,
) {
  if (!scenario.workspace.evidence_view) return;
  scenario.workspace.evidence_view.calculations[0].artifacts = [{
    artifact_name: "request.json",
    url: "/api/v1/workbench/PF_1001/performance/evidence/artifacts/calc-workspace-summary/request.json",
  }];
}

function renderEvidenceMode(
  scenario: ReturnType<typeof buildSupportedEvidencePerformanceScenario>
) {
  return render(
    <PerformanceEvidenceMode
      capability={scenario.capabilities.evidence}
      evidenceView={scenario.workspace.evidence_view}
      selection={{
        asOfDate: scenario.workspace.as_of_date,
        period: scenario.workspace.period,
        basis: scenario.workspace.detail_basis,
        benchmarkCode: scenario.workspace.benchmark_code,
        contributionDimension: scenario.workspace.contribution_dimension,
        attributionDimension: scenario.workspace.attribution_dimension,
      }}
    />
  );
}

describe("PerformanceEvidenceMode", () => {
  it("renders calculation-bound partial history and accessible source support details", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    const source = scenario.workspace.evidence_view!;
    const calculation = source.calculations[0];
    scenario.workspace.net_performance.portfolio_return_pct = 5.0;
    source.source_supportability = [{
      key: "source_calculation", state: "partial", freshness_bucket: "fresh", source_service: "lotus-performance",
      calculation_role: calculation.calculation_role, calculation_id: calculation.calculation_id,
      period_keys: ["1Y"], metric_basis: source.basis,
      history_coverage: {
        status: "partial", calculation_basis: "available_window",
        requested_start_date: "2025-01-10", requested_end_date: "2026-01-09",
        covered_start_date: "2026-01-05", covered_end_date: "2026-01-09",
        effective_start_date: "2026-01-05", effective_end_date: "2026-01-09",
        calendar_basis: "natural_days", missing_required_observation_count: 360,
        missing_required_observation_dates_sample: ["2025-01-10"], reason_codes: ["leading_history_missing"],
      },
    } as NonNullable<typeof source.source_supportability>[number]];
    renderEvidenceMode(scenario);
    const presentation = getPerformanceReturnPathPresentation({
      summary: scenario.workspace.net_performance, capabilities: scenario.capabilities, reportingCurrency: "USD",
    });
    render(<PerformanceReturnPathSummary items={buildReturnDecisionItems(presentation, true).summaryItems} />);
    expect(screen.getByRole("region", { name: "Return decision readout" })).toHaveTextContent("5.00%");
    const region = screen.getByRole("region", { name: "Performance history" });
    expect(within(region).getByText("Partial history")).toBeInTheDocument();
    expect(region).toHaveTextContent("10 Jan 2025 – 09 Jan 2026");
    expect(region).toHaveTextContent("05 Jan 2026 – 09 Jan 2026");
    expect(region).toHaveTextContent("Missing observations360");
    expect(region).toHaveTextContent("Available observations");
    expect(region).not.toHaveTextContent(calculation.calculation_id);
    const disclosure = screen.getByText("Technical support details").closest("details")!;
    expect(disclosure).not.toHaveAttribute("open");
    expect(within(disclosure).getByText("History reason codes")).toBeInTheDocument();
    expect(disclosure).toHaveTextContent("leading_history_missing");
    expect(disclosure).toHaveTextContent("Natural days; venue calendar not attested");
    expect(disclosure.querySelector("summary")).toBeInTheDocument();
    fireEvent.click(disclosure.querySelector("summary")!);
    expect(disclosure).toHaveAttribute("open");
  });

  it.each([
    ["complete", "Complete history", "requested_window", 0],
    ["unknown", "History unknown", "available_window", 360],
    ["unexpected", "History not confirmed", "available_window", 360],
  ])("renders %s history independently of completed execution", (status, label, basis, missing) => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    const source = scenario.workspace.evidence_view!;
    source.source_supportability = [{
      key: "source_calculation", state: "supported", freshness_bucket: "fresh", source_service: "lotus-performance",
      calculation_role: source.calculations[0].calculation_role, calculation_id: source.calculations[0].calculation_id,
      metric_basis: source.basis, period_keys: ["1Y"],
      history_coverage: {
        status, calculation_basis: basis, requested_start_date: "2025-01-10", requested_end_date: "2026-01-09",
        covered_start_date: status === "unknown" ? null : "2025-01-10", covered_end_date: status === "unknown" ? null : "2026-01-09",
        effective_start_date: status === "unknown" ? null : "2025-01-10", effective_end_date: status === "unknown" ? null : "2026-01-09",
        calendar_basis: "natural_days", missing_required_observation_count: missing,
        missing_required_observation_dates_sample: [], reason_codes: [],
      },
    } as NonNullable<typeof source.source_supportability>[number]];
    renderEvidenceMode(scenario);
    expect(within(screen.getByRole("region", { name: "Performance history" })).getByText(label)).toBeInTheDocument();
    if (status !== "complete") expect(screen.queryByText("Complete history")).not.toBeInTheDocument();
  });

  it("renders distinct qualification for divergent calculations without sharing dates", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    const source = scenario.workspace.evidence_view!;
    source.calculations.push({ ...source.calculations[0], calculation_id: "calc-detail", calculation_role: "workspace_details" });
    source.source_supportability = source.calculations.map((calculation, index) => ({
      key: "source_calculation", state: "partial", freshness_bucket: "fresh", source_service: "lotus-performance",
      calculation_role: calculation.calculation_role, calculation_id: calculation.calculation_id,
      metric_basis: source.basis, period_keys: ["1Y"],
      history_coverage: {
        status: index ? "unknown" : "partial", calculation_basis: "available_window",
        requested_start_date: "2025-01-10", requested_end_date: "2026-01-09",
        covered_start_date: index ? null : "2026-01-05", covered_end_date: index ? null : "2026-01-09",
        effective_start_date: index ? null : "2026-01-05", effective_end_date: index ? null : "2026-01-09",
        calendar_basis: "natural_days", missing_required_observation_count: 360,
        missing_required_observation_dates_sample: [], reason_codes: ["leading_history_missing"],
      },
    }));
    renderEvidenceMode(scenario);
    const items = within(screen.getByRole("region", { name: "Performance history" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Portfolio performance summary history");
    expect(items[0]).toHaveTextContent("05 Jan 2026 – 09 Jan 2026");
    expect(items[1]).toHaveTextContent("Performance analysis detail history");
    expect(items[1]).toHaveTextContent("History unknown");
    expect(items[1]).not.toHaveTextContent("05 Jan 2026");
  });

  it("renders legacy history explicitly without a complete-history badge", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    scenario.workspace.evidence_view!.source_supportability = [{
      key: "source_calculation", state: "supported", freshness_bucket: "fresh", source_service: "lotus-performance",
    }];
    renderEvidenceMode(scenario);
    expect(screen.getByText("History not reported")).toBeInTheDocument();
    expect(screen.queryByText("Complete history")).not.toBeInTheDocument();
  });

  it.each([
    { covered_start_date: "2020-01-01", covered_end_date: "2020-01-02", effective_start_date: "2020-01-01", effective_end_date: "2020-01-02" },
    { reason_codes: ["no_observations_in_requested_window"] },
  ])("renders contradictory complete history %# as unconfirmed", (contradiction) => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    const source = scenario.workspace.evidence_view!;
    source.source_supportability = [{
      key: "source_calculation", state: "supported", freshness_bucket: "fresh", source_service: "lotus-performance",
      calculation_role: source.calculations[0].calculation_role, calculation_id: source.calculations[0].calculation_id,
      metric_basis: source.basis, period_keys: ["1Y"],
      history_coverage: {
        status: "complete", calculation_basis: "requested_window",
        requested_start_date: "2025-01-10", requested_end_date: "2026-01-09",
        covered_start_date: "2025-01-10", covered_end_date: "2026-01-09",
        effective_start_date: "2025-01-10", effective_end_date: "2026-01-09",
        calendar_basis: "natural_days", missing_required_observation_count: 0,
        missing_required_observation_dates_sample: [], reason_codes: ["covered_window_matches_requested_window"],
        ...contradiction,
      },
    } as NonNullable<typeof source.source_supportability>[number]];
    renderEvidenceMode(scenario);
    const region = screen.getByRole("region", { name: "Performance history" });
    expect(within(region).getByText("History not confirmed")).toBeInTheDocument();
    expect(within(region).queryByText("Complete history")).not.toBeInTheDocument();
    expect(region).not.toHaveTextContent("2020");
    expect(screen.getByText("Performance history needs qualification")).toBeInTheDocument();
  });

  it("renders business-facing unavailable posture without a technical contract dump", () => {
    const scenario = buildUnavailableEvidencePerformanceScenario();
    renderEvidenceMode(scenario);

    expect(document.querySelector("#performance-evidence.workbench-data-grid-frame")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Calculation assurance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assurance unavailable" })).toBeInTheDocument();
    expect(screen.getByText("The source has not provided a usable calculation-assurance package for this performance selection.")).toBeInTheDocument();
    expect(screen.queryByText("Evidence and Calculation Context")).not.toBeInTheDocument();
    expect(screen.queryByText(/backend contract/i)).not.toBeInTheDocument();
  });

  it("makes partial calculation and lineage posture decision-ready", () => {
    const scenario = buildPartialEvidencePerformanceScenario();
    renderEvidenceMode(scenario);

    const workspace = screen.getByTestId("performance-evidence-assurance");
    expect(workspace).toHaveAttribute("data-assurance-state", "incomplete");
    expect(within(workspace).getByText("Review status")).toBeInTheDocument();
    expect(within(workspace).queryByText("Assurance posture")).not.toBeInTheDocument();
    expect(within(workspace).getByText("Incomplete evidence")).toBeInTheDocument();
    expect(within(workspace).getByRole("heading", { name: "Control exceptions" })).toBeInTheDocument();
    expect(within(workspace).getByText("Evidence package incomplete")).toBeInTheDocument();
    expect(within(workspace).getByText("Portfolio performance summary evidence still being prepared")).toBeInTheDocument();
    expect(within(workspace).getByText("Portfolio performance summary")).toBeInTheDocument();
    expect(within(workspace).getByText("No supporting record is published for this calculation.")).toBeInTheDocument();
  });

  it("renders concise assurance, context, coverage, and evidence access", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    publishCalculationInputRecord(scenario);
    renderEvidenceMode(scenario);

    const workspace = screen.getByTestId("performance-evidence-assurance");
    expect(workspace).toHaveAttribute("data-assurance-state", "incomplete");
    expect(within(workspace).getByRole("heading", { name: "Calculation coverage" })).toBeInTheDocument();
    const context = within(workspace).getByLabelText("Performance assurance context");
    expect(context).toHaveTextContent("As of2026-02-24");
    expect(context).toHaveTextContent("Review periodYTD");
    expect(context).toHaveTextContent("Return basisNet of fees");
    expect(within(workspace).getByText("Evidence coverage is limited")).toBeInTheDocument();
    expect(within(workspace).getByText(/Issuer is outside the published evidence coverage/)).toBeInTheDocument();
    expect(within(workspace).getByText("Portfolio performance summary")).toBeInTheDocument();
    expect(within(workspace).getByRole("link", { name: "Calculation input record" })).toHaveAttribute(
      "href",
      "/api/bff/api/v1/workbench/PF_1001/performance/evidence/artifacts/calc-workspace-summary/request.json"
    );
    expect(within(workspace).getByRole("heading", { name: "Evidence access" })).toBeInTheDocument();
    expect(within(workspace).getByText(/1 methodology reference is recorded/)).toBeInTheDocument();
  });

  it("keeps raw identifiers and technical vocabulary in one collapsed support disclosure", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    publishCalculationInputRecord(scenario);
    if (scenario.workspace.evidence_view) {
      scenario.workspace.evidence_view.source_supportability = [{
        key: "performance_summary",
        state: "supported",
        freshness_bucket: "fresh",
        source_service: "lotus-performance",
      }];
    }
    renderEvidenceMode(scenario);

    const workspace = screen.getByTestId("performance-evidence-assurance");
    const disclosure = within(workspace).getByText("Technical support details").closest("details");
    expect(disclosure).toBeTruthy();
    expect(disclosure).not.toHaveAttribute("open");
    expect(within(disclosure!).getAllByText("lotus-performance")).toHaveLength(2);
    expect(within(disclosure!).getByText("calc-workspace-summary")).toBeInTheDocument();
    expect(within(disclosure!).getAllByText("WORKSPACE_SUMMARY")).toHaveLength(2);
    expect(within(disclosure!).getByText("v1")).toBeInTheDocument();
    expect(within(disclosure!).getByText(/request\.json · \/api\/v1\/workbench/)).toBeInTheDocument();
    expect(within(disclosure!).getByText("Evidence availability state")).toBeInTheDocument();
    expect(within(disclosure!).getByText("Screen capability state")).toBeInTheDocument();
    expect(within(disclosure!).getByRole("heading", { name: "Source availability checks" })).toBeInTheDocument();

    const primaryRegions = [
      within(workspace).getByRole("region", { name: "Incomplete evidence" }),
      within(workspace).getByRole("region", { name: "Control exceptions" }),
      within(workspace).getByRole("region", { name: "Calculation coverage" }),
    ];
    primaryRegions.forEach((region) => {
      expect(region).not.toHaveTextContent("lotus-performance");
      expect(region).not.toHaveTextContent("calc-workspace-summary");
      expect(region).not.toHaveTextContent("WORKSPACE_SUMMARY");
      expect(region).not.toHaveTextContent("gateway_contract");
      expect(region).not.toHaveTextContent(/supportability|governed|posture/i);
    });
  });

  it("preserves an archived artifact through the Workbench BFF route", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    if (scenario.workspace.evidence_view) {
      scenario.workspace.evidence_view.calculations[0].artifacts = [{
        artifact_name: "portfolio-review.pdf",
        url: "/api/v1/documents/doc_1/download",
        content_type: "application/pdf",
        archive_document_id: "doc_1",
        archive_document_metadata_url: "/api/bff/api/v1/documents/doc_1?current=true",
        archive_document_download_url: "/api/bff/api/v1/documents/doc_1/download",
      }];
    }
    renderEvidenceMode(scenario);

    expect(screen.getByRole("link", { name: "Archived evidence document" })).toHaveAttribute("href", "/api/bff/api/v1/documents/doc_1/download");
    expect(screen.getByText("Open the governed archived document through the Workbench evidence boundary.")).toBeInTheDocument();
  });

  it("does not render an unsafe source route as an actionable link", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    if (scenario.workspace.evidence_view) {
      scenario.workspace.evidence_view.calculations[0].artifacts = [{
        artifact_name: "request.json",
        url: "https://performance.internal/evidence/request.json",
      }];
    }
    renderEvidenceMode(scenario);

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(
      screen.getByText("Portfolio performance summary supporting record 1 route unavailable")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Calculation input record" })).not.toBeInTheDocument();
    expect(screen.getByText("This source-published route is not available through the Workbench evidence boundary.")).toBeInTheDocument();
  });

  it("renders limitations as a business exception and preserves exact support detail", () => {
    const scenario = buildPartialEvidencePerformanceScenario();
    renderEvidenceMode(scenario);

    expect(screen.getByText("Source limitation applies")).toBeInTheDocument();
    const disclosure = screen.getByText("Technical support details").closest("details");
    expect(within(disclosure!).getByText("One or more performance calculations still have pending lineage evidence.")).toBeInTheDocument();
  });

  it("renders a truthful empty calculation state", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    if (scenario.workspace.evidence_view) scenario.workspace.evidence_view.calculations = [];
    renderEvidenceMode(scenario);

    expect(screen.getByTestId("performance-evidence-assurance")).toHaveAttribute("data-assurance-state", "incomplete");
    expect(screen.getByText("No calculation evidence reported")).toBeInTheDocument();
    expect(screen.getByText(/cannot be treated as assured/)).toBeInTheDocument();
  });

  it("keeps an unfamiliar review period out of an internal-review-ready posture", () => {
    const scenario = buildSupportedEvidencePerformanceScenario();
    scenario.workspace.period = "FUTURE";
    if (scenario.workspace.evidence_view) scenario.workspace.evidence_view.period = "FUTURE";
    renderEvidenceMode(scenario);

    const workspace = screen.getByTestId("performance-evidence-assurance");
    expect(workspace).toHaveAttribute("data-assurance-state", "attention");
    expect(within(workspace).getByText("Review period not supported")).toBeInTheDocument();
    expect(within(workspace).getByText("Selected review period not supported")).toBeInTheDocument();
    expect(within(workspace).queryByText("Ready for internal review")).not.toBeInTheDocument();
  });
});
