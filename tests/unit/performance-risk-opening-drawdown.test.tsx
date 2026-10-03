import { QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RiskDrawdownDetail from "@/apps/performance/components/risk/risk-drawdown-detail";
import { buildPerformanceRiskQueryContext } from "@/apps/performance/performance-risk-query-keys";
import { performanceRiskDrawdownQueryOptions } from "@/apps/performance/performance-risk-query-options";
import { isPerformanceRiskSourceCurrent } from "@/apps/performance/performance-risk-source-identity";
import {
  buildFixtureRiskDrawdown,
  buildPerformanceRiskViewModel,
} from "@/apps/performance/risk-workspace-view-model";
import type { WorkbenchRiskDrawdownResponse } from "@/features/workbench/types";

import { buildSupportedPerformanceScenario } from "../fixtures/performance-workspace-fixtures";
import gatewayCaptures from "../fixtures/risk-opening-drawdown-gateway-captures.json";

const { workspace } = buildSupportedPerformanceScenario();
const context = buildPerformanceRiskQueryContext(workspace, "YTD");

function buildOpeningDrawdown({ recovered = false, observedPeak = false } = {}) {
  const response = buildFixtureRiskDrawdown(workspace, "YTD", "NET");
  const period = response.payload!.periods[0];
  period.summary = {
    ...period.summary!,
    max_drawdown: -0.05,
    max_drawdown_peak_date: observedPeak ? "2026-01-01" : null,
    max_drawdown_trough_date: "2026-01-02",
    max_drawdown_recovery_date: recovered ? "2026-01-03" : null,
    days_to_trough: observedPeak ? 0 : null,
    days_to_recovery: recovered ? 1 : null,
    is_recovered: recovered,
  };
  period.relative_to_benchmark = {
    ...period.relative_to_benchmark!,
    max_drawdown_peak_date: null,
    max_drawdown_trough_date: "2026-01-02",
  };
  period.episodes = [{
    episode_id: "dd_opening",
    peak_date: observedPeak ? "2026-01-01" : null,
    trough_date: "2026-01-02",
    recovery_date: recovered ? "2026-01-03" : null,
    depth: -0.05,
    days_to_trough: observedPeak ? 0 : null,
    days_to_recovery: recovered ? 1 : null,
    total_days: observedPeak ? 0 : null,
    is_recovered: recovered,
  }];
  return response;
}

async function readDrawdown(
  response: WorkbenchRiskDrawdownResponse,
  requestContext = context,
  includeUnderwaterSeries = false,
) {
  const fetchSource = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchSource);
  const client = new QueryClient();
  try {
    const admitted = await client.fetchQuery({
      ...performanceRiskDrawdownQueryOptions(requestContext, "NET", includeUnderwaterSeries),
      retry: false,
    });
    expect(fetchSource).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(fetchSource.mock.calls[0][0], "http://localhost");
    expect(requestUrl.pathname).toContain(`/workbench/${requestContext.portfolioId}/risk/drawdown`);
    expect(requestUrl.searchParams.get("period")).toBe("YTD");
    expect(requestUrl.searchParams.get("detail_basis")).toBe("NET");
    expect(admitted).toEqual(response);
    return admitted;
  } finally {
    client.clear();
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("source-owned opening drawdown evidence", () => {
  it.each(gatewayCaptures.cases)("retains supplier-qualified $name through actual API/query/model/rendered detail", async (capture) => {
    // HTTP responses are retained unchanged; only surrounding Performance context is synthetic.
    const response = capture.response as WorkbenchRiskDrawdownResponse;
    expect(capture.status).toBe(200);
    const admitted = await readDrawdown(response, {
      portfolioId: response.portfolio_id,
      period: response.period,
      reportStartDate: response.requested_report_start_date ?? null,
      reportEndDate: response.requested_report_end_date ?? null,
      asOfDate: response.as_of_date,
      reportingCurrency: "USD",
      benchmark: response.benchmark_code ?? null,
    }, true);
    const period = admitted.payload!.periods[0];
    const model = buildPerformanceRiskViewModel({
      workspace: {
        ...workspace,
        portfolio: { ...workspace.portfolio, portfolio_id: response.portfolio_id },
        benchmark_code: response.benchmark_code ?? null,
        as_of_date: response.as_of_date,
        report_start_date: period.start_date,
        report_end_date: period.end_date,
      },
      period: "YTD", detailBasis: "NET", riskDrawdown: admitted,
    });
    expect(admitted).toEqual(capture.response);
    expect(model.drawdownEpisodes).toHaveLength(period.episodes.length);
    render(<RiskDrawdownDetail viewModel={model} />);
    if (period.episodes.length === 0) {
      expect(screen.queryByRole("table", { name: "Risk drawdown episode table" })).not.toBeInTheDocument();
      expect(model.drawdownEpisodeInterpretation).not.toBeNull();
      return;
    }
    const rows = within(screen.getByRole("table", { name: "Risk drawdown episode table" })).getAllByRole("row").slice(1);
    for (const [index, episode] of period.episodes.entries()) {
      expect(model.drawdownEpisodes[index].key).toBe(episode.episode_id);
      const cells = within(rows[index]).getAllByRole("cell").map((cell) => cell.textContent);
      expect(cells[0]).toBe(episode.episode_id.toUpperCase());
      expect(cells[1]).toBe(`${(episode.depth * 100).toFixed(2)}%`);
      if (episode.peak_date === null) expect(cells[2]).toBe("N/A");
      else expect(cells[2]).not.toBe("N/A");
      expect(cells[3]).not.toBe("N/A");
      if (episode.recovery_date) expect(cells[4]).not.toBe("Open");
      else expect(cells[4]).toBe("Open");
      expect(cells[5]).toBe(episode.total_days === null ? "N/A" : String(episode.total_days));
      expect(cells[6]).toBe(episode.is_recovered ? "Recovered" : "Open");
    }
  });

  it.each([false, true])("admits and renders an undated opening peak (recovered=%s)", async (recovered) => {
    const response = buildOpeningDrawdown({ recovered });
    const admitted = await readDrawdown(response);
    const model = buildPerformanceRiskViewModel({ workspace, period: "YTD", detailBasis: "NET", riskDrawdown: admitted });
    expect(model.drawdownEpisodes[0]).toMatchObject({
      key: "dd_opening", episode: "DD_OPENING", depth: "-5.00%",
      peakDate: "N/A", totalDays: "N/A", status: recovered ? "Recovered" : "Open",
      troughDate: "02 Jan 2026", recoveryDate: recovered ? "03 Jan 2026" : "Open",
    });
    expect(admitted.supportability).toEqual(response.supportability);
    render(<RiskDrawdownDetail viewModel={model} />);
    const row = within(screen.getByRole("table", { name: "Risk drawdown episode table" })).getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual([
      "DD_OPENING", "-5.00%", "N/A", model.drawdownEpisodes[0].troughDate,
      recovered ? model.drawdownEpisodes[0].recoveryDate : "Open", "N/A", recovered ? "Recovered" : "Open",
    ]);
    expect(model.drawdownEpisodes[0].troughDate).not.toBe("N/A");
    if (recovered) expect(model.drawdownEpisodes[0].recoveryDate).not.toBe("Open");
  });

  it("retains an observed peak and a real zero duration", async () => {
    const admitted = await readDrawdown(buildOpeningDrawdown({ observedPeak: true, recovered: true }));
    const model = buildPerformanceRiskViewModel({ workspace, period: "YTD", detailBasis: "NET", riskDrawdown: admitted });
    expect(model.drawdownEpisodes[0].peakDate).not.toBe("N/A");
    expect(model.drawdownEpisodes[0].totalDays).toBe("0");
    render(<RiskDrawdownDetail viewModel={model} />);
    expect(within(screen.getByRole("table", { name: "Risk drawdown episode table" })).getByText("0")).toBeInTheDocument();
  });

  it.each(["summary", "relative_to_benchmark", "episodes"] as const)("admits a null opening peak independently in %s", async (field) => {
    const response = buildFixtureRiskDrawdown(workspace, "YTD", "NET");
    const openingPeriod = buildOpeningDrawdown().payload!.periods[0];
    response.payload!.periods[0][field] = openingPeriod[field] as never;
    await readDrawdown(response);
  });

  it.each([
    ["malformed peak", { peak_date: "2026-02-30" }],
    ["missing peak", { peak_date: undefined }],
    ["foreign peak", { peak_date: "2025-12-31" }],
    ["reversed peak", { peak_date: "2026-01-03" }],
    ["unknown trough", { trough_date: null }],
    ["malformed trough", { trough_date: "2026-02-30" }],
    ["foreign trough", { trough_date: "2025-12-31" }],
    ["reversed recovery", { recovery_date: "2026-01-01" }],
    ["malformed recovery", { recovery_date: "2026-02-30" }],
    ["foreign recovery", { recovery_date: "2026-02-25" }],
  ])("refuses an opening episode with %s through actual query admission", async (_name, patch) => {
    const response = buildOpeningDrawdown();
    Object.assign(response.payload!.periods[0].episodes[0], patch);
    await expect(readDrawdown(response)).rejects.toThrow("Risk evidence does not confirm the requested source identity.");
  });

  it.each([
    ["portfolio", { portfolio_id: "FOREIGN" }],
    ["period", { period: "1Y" }],
    ["basis", { detail_basis: "GROSS" as const }],
    ["benchmark", { benchmark_code: "FOREIGN" }],
    ["as-of", { as_of_date: "2026-02-23" }],
  ])("refuses %s drift even with an unknown opening peak", async (_name, patch) => {
    await expect(readDrawdown({ ...buildOpeningDrawdown(), ...patch })).rejects.toThrow("Risk evidence does not confirm the requested source identity.");
  });

  it("refuses unknown summary trough and invalid period without weakening the date guard", () => {
    const identity = { portfolioId: context.portfolioId, period: "YTD", asOfDate: context.asOfDate, benchmark: context.benchmark };
    const response = buildOpeningDrawdown();
    response.payload!.periods[0].summary!.max_drawdown_trough_date = null;
    expect(isPerformanceRiskSourceCurrent(response, identity)).toBe(false);
    const reversedWindow = buildOpeningDrawdown();
    reversedWindow.payload!.periods[0].start_date = "2026-02-25";
    expect(isPerformanceRiskSourceCurrent(reversedWindow, identity)).toBe(false);
  });

  it("refuses a foreign explicit request window despite an undated peak", async () => {
    const response = {
      ...buildOpeningDrawdown(),
      requested_report_start_date: "2025-01-01",
      requested_report_end_date: "2026-02-24",
    };
    await expect(readDrawdown(response)).rejects.toThrow("Risk evidence does not confirm the requested source identity.");
  });

  it("preserves an admitted empty episode list without manufacturing an episode", async () => {
    const response = buildOpeningDrawdown();
    response.payload!.periods[0].episodes = [];
    const admitted = await readDrawdown(response);
    const model = buildPerformanceRiskViewModel({ workspace, period: "YTD", detailBasis: "NET", riskDrawdown: admitted });
    expect(model.drawdownEpisodes).toEqual([]);
    render(<RiskDrawdownDetail viewModel={model} />);
    expect(screen.queryByRole("table", { name: "Risk drawdown episode table" })).not.toBeInTheDocument();
    expect(screen.getByText("No retained drawdown episodes")).toBeInTheDocument();
  });

  it.each(["blocked", "unavailable"] as const)("does not reuse %s source evidence just because its opening peak is valid", async (state) => {
    await expect(readDrawdown({ ...buildOpeningDrawdown(), state })).rejects.toThrow("Risk source returned a non-reusable evidence state.");
  });

  it.each([
    ["unknown depth", { max_drawdown: null }],
    ["negative depth", { max_drawdown: -0.05 }],
    ["string zero", { max_drawdown: "0" }],
    ["missing peak", { max_drawdown_peak_date: undefined }],
    ["missing trough", { max_drawdown_trough_date: undefined }],
    ["missing recovery", { max_drawdown_recovery_date: undefined }],
    ["unrecovered", { is_recovered: false }],
    ["missing trough duration", { days_to_trough: undefined }],
    ["missing recovery duration", { days_to_recovery: undefined }],
    ["missing underwater duration", { time_under_water_days: undefined }],
    ["string duration", { days_to_trough: "0" }],
    ["nonzero duration", { time_under_water_days: 1 }],
  ])("refuses incomplete no-drawdown summary: %s", async (_name, patch) => {
    const response = buildOpeningDrawdown();
    const flatSummary = gatewayCaptures.cases.find((capture) => capture.name === "flat")!.response.payload.periods[0].summary;
    response.payload!.periods[0].episodes = [];
    response.payload!.periods[0].summary = { ...flatSummary, ...patch } as never;
    await expect(readDrawdown(response)).rejects.toThrow("Risk evidence does not confirm the requested source identity.");
  });

  it("refuses an absolute no-drawdown summary with retained loss episodes", async () => {
    const response = buildOpeningDrawdown();
    response.payload!.periods[0].summary = gatewayCaptures.cases.find((capture) => capture.name === "flat")!.response.payload.periods[0].summary;
    await expect(readDrawdown(response)).rejects.toThrow("Risk evidence does not confirm the requested source identity.");
  });

  it("does not apply the no-drawdown summary exception to an undated episode trough", async () => {
    const response = buildOpeningDrawdown();
    Object.assign(response.payload!.periods[0].episodes[0], {
      peak_date: null, trough_date: null, recovery_date: null, max_drawdown: 0,
      depth: 0, is_recovered: true, days_to_trough: 0, days_to_recovery: 0,
      total_days: 0, time_under_water_days: 0,
    });
    await expect(readDrawdown(response)).rejects.toThrow("Risk evidence does not confirm the requested source identity.");
  });
});
