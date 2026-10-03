import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortfolioAllocationPanel from "../../src/apps/portfolio/components/portfolio-allocation-panel";
import { getPortfolioAllocationViews } from "../../src/apps/portfolio/api";
import { qualifiedAllocation } from "../fixtures/qualified-allocation";

afterEach(() => vi.unstubAllGlobals());
function source(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  })));
}
function panel(state = "PARTIAL") {
  const payload = qualifiedAllocation(state);
  source(payload);
  const onSelectionChange = vi.fn();
  render(<PortfolioAllocationPanel portfolioId={payload.portfolio_id}
    allocationViews={payload.views} baseCurrency="USD" asOfDate={payload.as_of_date}
    reportingCurrency="USD" selectedAllocation={null} onSelectionChange={onSelectionChange} />);
  return onSelectionChange;
}
describe("qualified allocation source facts", () => {
  it("keeps partial identity and source qualification without zero geometry", async () => {
    const select = panel();
    await screen.findByText("Allocation valuation is partial");
    expect(screen.getByText(/1 of 2 expected positions valued/)).toBeInTheDocument();
    expect(screen.getByText(/market_value_missing/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Allocation donut chart")).not.toBeInTheDocument();
    const row = screen.getByRole("button", { name: /Unpriced bond: Unavailable, Unavailable, 1 positions/ });
    expect(row).not.toHaveTextContent("0.00%");
    fireEvent.click(row);
    expect(select).toHaveBeenCalledWith({ dimension: "asset_class", bucket: "Unpriced bond" });
    fireEvent.click(screen.getByRole("radio", { name: "Comparison" }));
    expect(document.querySelectorAll(".portfolio-allocation-bar-fill")).toHaveLength(0);
  });
  it("shows actual measured zero amounts with undefined weights", async () => {
    panel("MEASURED_ZERO");
    await screen.findByText("Allocation values are measured zero");
    expect(screen.getAllByText("0 USD")).toHaveLength(2);
    expect(screen.queryByLabelText("Allocation donut chart")).not.toBeInTheDocument();
  });
  it("retains signed values and uses comparison instead of unsigned composition", async () => {
    panel("COMPLETE");
    await screen.findByText("Allocation valuation is complete");
    expect(screen.getAllByText("-20.00%").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Allocation donut chart")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Allocation bar chart")).toBeInTheDocument();
  });
  it.each(["UNAVAILABLE", "CARRY_FORWARD", "LOADED_EMPTY"])("retains %s qualification", async (state) => {
    panel(state);
    await waitFor(() => expect(screen.getByLabelText("Allocation valuation coverage")).toHaveTextContent(
      state === "UNAVAILABLE" ? "unavailable" : state === "CARRY_FORWARD" ? "carried forward" : "empty",
    ));
  });
  it.each([
    ["missing coverage", (p: ReturnType<typeof qualifiedAllocation>) => { Reflect.deleteProperty(p, "valuation_coverage"); }],
    ["unknown state", (p: ReturnType<typeof qualifiedAllocation>) => { p.valuation_coverage.coverage_state = "READY"; }],
    ["bad counts", (p: ReturnType<typeof qualifiedAllocation>) => { p.valuation_coverage.valued_position_count = 3; }],
    ["wrong portfolio", (p: ReturnType<typeof qualifiedAllocation>) => { p.portfolio_id = "OTHER"; }],
    ["wrong date", (p: ReturnType<typeof qualifiedAllocation>) => { p.as_of_date = "2026-03-27"; }],
    ["wrong currency", (p: ReturnType<typeof qualifiedAllocation>) => { p.reporting_currency = "SGD"; }],
    ["foreign contributor", (p: ReturnType<typeof qualifiedAllocation>) => { p.views[0].buckets[0].contributors[0].portfolio_id = "OTHER"; }],
    ["unqualified total", (p: ReturnType<typeof qualifiedAllocation>) => { p.total_market_value_reporting_currency = "120"; }],
    ["duplicate bucket", (p: ReturnType<typeof qualifiedAllocation>) => { p.views[0].buckets[1].bucket = p.views[0].buckets[0].bucket; }],
    ["degraded zero weight", (p: ReturnType<typeof qualifiedAllocation>) => { p.views[0].buckets[1].weight_pct = 0; }],
  ])("refuses %s", async (_name, corrupt) => {
    const payload = qualifiedAllocation(); corrupt(payload); source(payload);
    expect(await getPortfolioAllocationViews("MANUAL_PB_USD_001", {
      asOfDate: "2026-03-28", reportingCurrency: "USD", lookThroughMode: "prefer_look_through",
    })).toBeNull();
  });
  it("preserves source decimals, contributor identities and lineage without recalculation", async () => {
    const payload = { ...qualifiedAllocation(), calculation_lineage: { input_hash: "fixture-source-hash" } };
    source(payload);
    const admitted = await getPortfolioAllocationViews(payload.portfolio_id, { asOfDate: payload.as_of_date, reportingCurrency: "USD" });
    expect(admitted?.views).toEqual(payload.views);
    expect(admitted?.valuation_coverage).toEqual(payload.valuation_coverage);
    expect(admitted?.calculation_lineage).toEqual(payload.calculation_lineage);
  });
  it("keeps observed all-missing rows distinct from no snapshot and never shows measured zero", async () => {
    const payload = qualifiedAllocation();
    payload.valuation_coverage.valued_position_count = 0;
    payload.valuation_coverage.unvalued_position_count = 2;
    for (const bucket of payload.views[0].buckets) {
      bucket.market_value_base = null; bucket.market_value_reporting_currency = null;
      bucket.omitted_market_value_reporting_currency = null;
      bucket.contributors[0].market_value_reporting_currency = null;
      bucket.contributors[0].bucket_weight = null;
    }
    source(payload);
    expect((await getPortfolioAllocationViews(payload.portfolio_id))?.valuation_coverage).toEqual(payload.valuation_coverage);
  });
});
