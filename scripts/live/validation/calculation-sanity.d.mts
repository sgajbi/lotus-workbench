import type { ValidationPanelState, ValidationSummary } from "./shared-types";

export function summarizePayloadSourceSupportability(
  ...payloads: unknown[]
): {
  itemCount: number;
  services: string[];
  staleCount: number;
  partialCount: number;
  actionRequiredCount: number;
  unconfirmedCount: number;
  state: "ready" | "partial" | "action_required" | "unknown";
};

export function assertRiskAttributionReconciliation(attributionSet: {
  total_value?: number;
  reconciled_sum?: number;
  residual?: number;
  quality_flags?: unknown[];
}): {
  totalValue: number;
  reconciledSum: number;
  residual: number;
  residualAbs: number;
  residualShareOfTotal: number | null;
  reconciliationError: number;
  comparisonTolerance: number;
  qualityFlags: unknown[];
};

export function assertPerformanceCalculationSanity(input: {
  summary: ValidationSummary;
  performanceSummary: Record<string, unknown>;
  performanceDetails: Record<string, unknown>;
  recordPanelClassification(
    panel: string,
    state: ValidationPanelState,
    owner: string,
    evidence: Record<string, unknown>
  ): void;
}): void;

export function assertRiskCalculationSanity(input: {
  summary: ValidationSummary;
  riskSummary: Record<string, unknown>;
  concentration: Record<string, unknown>;
  drawdown: Record<string, unknown>;
  rolling: Record<string, unknown>;
  attribution: Record<string, unknown>;
  recordPanelClassification(
    panel: string,
    state: ValidationPanelState,
    owner: string,
    evidence: Record<string, unknown>
  ): void;
}): void;
