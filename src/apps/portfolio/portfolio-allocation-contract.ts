import { z } from "zod";

const count = z.number().int().nonnegative();
const decimal = z.union([z.number().finite(), z.string().regex(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/)]).nullable();
const coverageSchema = z.object({
  coverage_state: z.enum(["COMPLETE", "MEASURED_ZERO", "CARRY_FORWARD", "LOADED_EMPTY", "PARTIAL", "UNAVAILABLE"]),
  coverage_reason: z.string().min(1).max(128).regex(/\S/),
  snapshot_row_count: count,
  expected_open_position_count: count,
  valued_position_count: count,
  unvalued_position_count: count,
});
const contributor = z.object({
  contributor_type: z.enum(["direct_position", "look_through_component"]),
  portfolio_id: z.string().min(1), security_id: z.string().min(1), booked_security_id: z.string().min(1),
  source_snapshot_id: count, component_record_id: count.nullable().optional(),
  market_value_reporting_currency: decimal, bucket_weight: decimal.optional(),
}).passthrough();
const schema = z.object({
  portfolio_id: z.string().min(1), as_of_date: z.iso.date(),
  reporting_currency: z.string().nullable(), total_market_value_reporting_currency: decimal,
  valuation_coverage: coverageSchema,
  look_through: z.object({
    requested_mode: z.enum(["direct_only", "prefer_look_through"]),
    effective_mode: z.enum(["direct_only", "prefer_look_through"]), applied: z.boolean(),
  }).passthrough().nullable().optional(),
  views: z.array(z.object({
    dimension: z.string().min(1), total_market_value_reporting_currency: decimal,
    buckets: z.array(z.object({
      bucket: z.string().min(1), position_count: count,
      market_value_base: z.number().finite().nullable(), weight_pct: z.number().finite().nullable(),
      market_value_reporting_currency: decimal,
      contributor_count: count, contributors_truncated: z.boolean(),
      omitted_market_value_reporting_currency: decimal,
      contributors: z.array(contributor),
    }).passthrough()),
  }).passthrough()),
}).passthrough();

export type PortfolioAllocationResponse = z.infer<typeof schema>;

export function parsePortfolioAllocationResponse(value: unknown, expected: {
  portfolioId: string; asOfDate?: string; reportingCurrency?: string;
}): PortfolioAllocationResponse | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;
  const response = parsed.data;
  if (response.portfolio_id !== expected.portfolioId ||
    (expected.asOfDate && response.as_of_date !== expected.asOfDate) ||
    (expected.reportingCurrency && response.reporting_currency !== expected.reportingCurrency)) return null;
  const c = response.valuation_coverage;
  if (c.valued_position_count + c.unvalued_position_count !== c.snapshot_row_count) return null;
  const degraded = ["PARTIAL", "UNAVAILABLE"].includes(c.coverage_state);
  const trusted = ["COMPLETE", "CARRY_FORWARD", "MEASURED_ZERO"].includes(c.coverage_state);
  if ((degraded && response.total_market_value_reporting_currency !== null) ||
    (trusted && (c.unvalued_position_count !== 0 || c.valued_position_count < c.expected_open_position_count || c.snapshot_row_count === 0 ||
      response.total_market_value_reporting_currency === null))) return null;
  if (c.coverage_state === "LOADED_EMPTY" && (c.expected_open_position_count || c.snapshot_row_count ||
    Number(response.total_market_value_reporting_currency) !== 0 || response.total_market_value_reporting_currency === null)) return null;
  if (c.coverage_state === "UNAVAILABLE" && c.snapshot_row_count) return null;
  if (c.coverage_state === "MEASURED_ZERO" && Number(response.total_market_value_reporting_currency) !== 0) return null;
  if (c.coverage_state === "PARTIAL" && !c.unvalued_position_count && c.snapshot_row_count >= c.expected_open_position_count) return null;
  const buckets = response.views.flatMap((view) => view.buckets);
  if (["LOADED_EMPTY", "UNAVAILABLE"].includes(c.coverage_state) && buckets.length) return null;
  if (c.snapshot_row_count > 0 && response.views.some((view) => !view.buckets.length)) return null;
  if (new Set(response.views.map((v) => v.dimension)).size !== response.views.length) return null;
  for (const view of response.views) {
    if (degraded && view.total_market_value_reporting_currency !== null) return null;
    if (new Set(view.buckets.map((b) => b.bucket)).size !== view.buckets.length) return null;
    for (const bucket of view.buckets) {
      if (degraded && bucket.weight_pct !== null) return null;
      if (trusted && bucket.market_value_reporting_currency === null) return null;
      if (trusted && ((bucket.weight_pct !== null) !== (Number(response.total_market_value_reporting_currency) !== 0))) return null;
      if (bucket.market_value_reporting_currency === null &&
        (bucket.market_value_base !== null || bucket.omitted_market_value_reporting_currency !== null)) return null;
      if (bucket.contributors.some((item) => item.portfolio_id !== expected.portfolioId)) return null;
      if (bucket.contributor_count < bucket.contributors.length) return null;
      if (c.coverage_state === "MEASURED_ZERO" && [bucket.market_value_reporting_currency,
        bucket.omitted_market_value_reporting_currency, ...bucket.contributors.map((i) => i.market_value_reporting_currency)]
        .some((n) => n === null || Number(n) !== 0)) return null;
    }
  }
  return response;
}
