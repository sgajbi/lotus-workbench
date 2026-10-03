import type { PortfolioAllocationView } from "../../src/apps/portfolio/types";

// Upgrade historical synthetic happy-path controls to the current Gateway envelope.
// This helper is fixture construction, never production coverage derivation.
export function qualifyAllocationControl(payload: {
  views: PortfolioAllocationView[];
  portfolio_id?: string;
  reporting_currency?: string;
  look_through?: unknown;
  as_of_date?: string;
}) {
  const rows = payload.views[0]?.buckets.reduce((n, b) => n + b.position_count, 0) ?? 0;
  const total = payload.views[0]?.buckets.reduce((n, b) => n + (b.market_value_base ?? 0), 0) ?? 0;
  return {
    ...payload,
    portfolio_id: payload.portfolio_id ?? "MANUAL_PB_USD_001", as_of_date: payload.as_of_date ?? "2026-03-28",
    reporting_currency: payload.reporting_currency ?? "USD", total_market_value_reporting_currency: String(total),
    valuation_coverage: { coverage_state: rows ? "COMPLETE" : "LOADED_EMPTY", coverage_reason: rows ? "all_positions_valued" : "no_open_positions",
      snapshot_row_count: rows, expected_open_position_count: rows, valued_position_count: rows, unvalued_position_count: 0 },
    views: payload.views.map((v) => ({ ...v, total_market_value_reporting_currency: String(total),
      buckets: v.buckets.map((b) => ({ ...b, market_value_reporting_currency: String(b.market_value_base),
        contributor_count: 0, contributors: [], contributors_truncated: false, omitted_market_value_reporting_currency: String(b.market_value_base) })),
    })),
  };
}
