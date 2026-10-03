// Deterministic Gateway-contract double; no live Core valuation or IAM proof.
export function qualifiedAllocation(state = "PARTIAL") {
  const trusted = ["COMPLETE", "CARRY_FORWARD"].includes(state);
  const zero = state === "MEASURED_ZERO";
  const empty = ["UNAVAILABLE", "LOADED_EMPTY"].includes(state);
  const values = trusted ? [120, -20] : zero ? [0, 0] : [120, null];
  return {
    portfolio_id: "MANUAL_PB_USD_001",
    as_of_date: "2026-03-28",
    reporting_currency: "USD",
    total_market_value_reporting_currency: trusted ? "100" : zero || state === "LOADED_EMPTY" ? "0" : null,
    valuation_coverage: {
      coverage_state: state,
      coverage_reason: trusted ? "all_positions_valued" : zero ? "all_positions_measured_zero" : "market_value_missing",
      snapshot_row_count: empty ? 0 : 2,
      expected_open_position_count: state === "LOADED_EMPTY" ? 0 : 2,
      valued_position_count: empty ? 0 : trusted || zero ? 2 : 1,
      unvalued_position_count: empty || trusted || zero ? 0 : 1,
    },
    look_through: { requested_mode: "prefer_look_through", effective_mode: "direct_only", applied: false },
    views: [{
      dimension: "asset_class",
      total_market_value_reporting_currency: trusted ? "100" : zero || state === "LOADED_EMPTY" ? "0" : null,
      buckets: empty ? [] : values.map((value, index) => ({
        bucket: index === 0 ? "Known equity" : "Unpriced bond",
        position_count: 1,
        market_value_base: value,
        market_value_reporting_currency: value === null ? null : String(value),
        weight_pct: trusted ? value : null,
        contributor_count: 1,
        contributors_truncated: false,
        omitted_market_value_reporting_currency: value === null ? null : "0",
        contributors: [{
          contributor_type: "direct_position" as const, portfolio_id: "MANUAL_PB_USD_001",
          security_id: `SEC_${index}`, booked_security_id: `SEC_${index}`,
          source_snapshot_id: index + 1, component_record_id: null,
          market_value_reporting_currency: value === null ? null : String(value),
          bucket_weight: value === null || value === 0 ? null : "1",
        }],
      })),
    }],
  };
}
