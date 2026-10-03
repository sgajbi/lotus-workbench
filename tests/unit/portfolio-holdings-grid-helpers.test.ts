import { describe, expect, it } from "vitest";

import {
  buildDefaultHoldingsColumnVisibility,
  buildExpandedHoldingsColumnVisibility,
  buildHoldingsExportRows,
  buildHoldingsRows,
  countUnpricedHoldings,
  sumHoldingsMarketValue,
} from "../../src/apps/portfolio/components/portfolio-holdings-grid-helpers";
import type { PortfolioPositionView } from "../../src/apps/portfolio/types";

const positions: PortfolioPositionView[] = [
  {
    security_id: "EQ_1",
    instrument_name: "Apple Inc.",
    asset_class: "EQUITY",
    quantity: 700,
    market_price: 210,
    market_value_base: 147000,
    cost_basis_base: 135000,
    unrealized_gain_loss_base: 12000,
    weight_pct: 14.67,
    currency: "USD",
    sector: "TECHNOLOGY",
    held_since_date: "2026-03-10",
    reprocessing_status: "STALE_PRICE",
    isin: "US0378331005",
  },
  {
    security_id: "FI_1",
    instrument_name: "United States Treasury 3.875% 2030",
    asset_class: "FIXED_INCOME",
    quantity: 100,
    market_price: null,
    market_value_base: null,
    cost_basis_base: 98000,
    unrealized_gain_loss_base: null,
    weight_pct: null,
    currency: null,
    sector: null,
    held_since_date: null,
    reprocessing_status: null,
    isin: null,
  },
];

describe("portfolio holdings grid helpers", () => {
  it("builds holdings rows with front-office display values and base-currency fallback", () => {
    const rows = buildHoldingsRows(positions, "USD");

    expect(rows[0]).toMatchObject({
      securityId: "EQ_1",
      instrument: "Apple Inc.",
      assetClass: "Equity",
      marketValue: 147000,
      sector: "Technology",
      status: "Review required",
      statusKind: "review_required",
      statusTone: "warn",
      isin: "US0378331005",
    });
    expect(rows[1]).toMatchObject({
      securityId: "FI_1",
      assetClass: "Fixed Income",
      currency: "USD",
      marketValue: null,
      sector: "N/A",
      status: "Not reported",
      statusKind: "not_reported",
      statusTone: "warn",
    });
  });

  it("keeps valuation totals and incomplete pricing posture in pure helpers", () => {
    const rows = buildHoldingsRows(positions, "USD");
    const sourceValuedCashBalance: PortfolioPositionView = {
      source_record_type: "cash_balance",
      security_id: "CASH_USD_1",
      instrument_name: "USD Operating Cash",
      asset_class: "Cash",
      currency: "USD",
      quantity: 100,
      market_value_base: 100,
      weight_pct: 0.01,
    };

    expect(sumHoldingsMarketValue(rows)).toBeNull();
    expect(countUnpricedHoldings(positions)).toBe(1);
    expect(countUnpricedHoldings([...positions, sourceValuedCashBalance])).toBe(1);
  });

  it("distinguishes unknown totals from genuine zero and signed value", () => {
    const rows = buildHoldingsRows(positions, "USD");
    expect(sumHoldingsMarketValue([rows[1]])).toBeNull();
    expect(sumHoldingsMarketValue([{ ...rows[0], marketValue: 0 }])).toBe(0);
    expect(sumHoldingsMarketValue([{ ...rows[0], marketValue: -20 }, { ...rows[0], marketValue: 120 }])).toBe(100);
    expect(sumHoldingsMarketValue([])).toBe(0);
  });

  it("builds holdings export rows from visible column policy", () => {
    const rows = buildHoldingsRows(positions, "USD");
    const visibility = {
      ...buildExpandedHoldingsColumnVisibility(),
      costBasis: false,
      isin: false,
    };

    expect(buildHoldingsExportRows(rows, visibility, "USD")[0]).toEqual({
      Instrument: "Apple Inc.",
      "Asset class": "Equity",
      Quantity: 700,
      Price: 210,
      "Market value (USD)": 147000,
      "Weight %": 14.67,
      "Unrealised P&L (USD)": 12000,
      "Instrument currency": "USD",
      Status: "Review required",
      Sector: "Technology",
      "Held since": "2026-03-10",
    });
  });

  it("uses one business status projection for the grid and export", () => {
    const cashBalance: PortfolioPositionView = {
      source_record_type: "cash_balance",
      security_id: "CASH_USD_1",
      instrument_name: "USD Operating Cash",
      asset_class: "Cash",
      currency: "USD",
      quantity: 100,
      market_value_base: 100,
      weight_pct: 0.01,
    };
    const currentPosition: PortfolioPositionView = {
      ...positions[0],
      security_id: "EQ_CURRENT",
      reprocessing_status: "CURRENT",
    };
    const rows = buildHoldingsRows([currentPosition, positions[0], positions[1], cashBalance], "USD");
    const exportRows = buildHoldingsExportRows(
      rows,
      {
        ...buildDefaultHoldingsColumnVisibility("essential"),
        instrument: false,
        assetClass: false,
        quantity: false,
        price: false,
        marketValue: false,
        costBasis: false,
        weight: false,
        upl: false,
        currency: false,
      },
      "USD",
    );

    expect(rows.map((row) => row.status)).toEqual([
      "Current",
      "Review required",
      "Not reported",
      "Not applicable",
    ]);
    expect(exportRows).toEqual([
      { Status: "Current" },
      { Status: "Review required" },
      { Status: "Not reported" },
      { Status: "Not applicable" },
    ]);
  });

  it("separates essential and expanded column defaults", () => {
    expect(buildDefaultHoldingsColumnVisibility("essential")).toMatchObject({
      sector: false,
      heldSince: false,
      isin: false,
    });
    expect(buildDefaultHoldingsColumnVisibility("expanded")).toMatchObject({
      sector: true,
      heldSince: true,
      isin: false,
    });
    expect(buildExpandedHoldingsColumnVisibility()).toMatchObject({
      sector: true,
      heldSince: true,
      isin: true,
    });
  });
});
