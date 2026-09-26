import type {
  BrowserValidationHelpers,
  BrowserValidationPage,
  PanelRegistryEntry,
  ValidationSummary,
} from "./shared-types";

export function createBrowserValidationHelpers(input: {
  outputDir: string;
  summary: ValidationSummary;
  portfolioId: string;
  benchmarkCode: string;
  canonicalAsOfDate: string;
  timeoutMs: number;
  panelRegistryById: Map<string, Pick<PanelRegistryEntry, "screenshotName" | "route">>;
}): BrowserValidationHelpers;

export function assertClientContextMandateProof(proof: {
  sourceValue: string;
  renderedValue: string;
}): { sourceMandate: string; renderedMandate: string };

export function waitForClientInteractivity(
  page: {
    waitForFunction(
      predicate: (selector: string) => boolean,
      selector: string,
      options: { timeout: number },
    ): Promise<unknown>;
  },
  selector: string,
  timeoutMs: number,
): Promise<void>;

export function waitForWorkspaceNavigationSettlement(
  page: {
    waitForFunction(
      predicate: (selector: string) => boolean,
      selector: string,
      options: { timeout: number },
    ): Promise<unknown>;
  },
  timeoutMs: number,
): Promise<void>;

export function navigateForInteractiveBusinessProof(
  page: Parameters<typeof waitForClientInteractivity>[0] & {
    goto(url: string, options?: Record<string, unknown>): Promise<{
      ok(): boolean;
      status(): number;
    } | null>;
  },
  route: string,
  interactiveSelector: string,
  options: { timeout: number } & Record<string, unknown>,
): Promise<{ ok(): boolean; status(): number }>;

export function resolveCanonicalIdeaRestartPlan(
  lifecycleStatus:
    | "ready_for_review"
    | "reviewed_by_advisor"
    | "approved"
    | "converted_to_proposal",
): {
  mutationsAllowed: boolean;
  reviewRequired: boolean;
  actions: string[];
};

export type AdvisorBriefReviewEvidence = {
  rowCount: number;
  reviewState: string | null;
  supportability: string | null;
  reviewer: string | null;
  recordedAt: string | null;
};

export function readAdvisorBriefReviewEvidence(supportabilityRegion: {
  getByTestId(testId: string): {
    count(): Promise<number>;
    first(): {
      getAttribute(name: string): Promise<string | null>;
    };
  };
}): Promise<AdvisorBriefReviewEvidence>;
export function hasAcceptedAdvisorBriefReviewPosture(
  evidence: AdvisorBriefReviewEvidence,
): boolean;
export function hasRecordedAdvisorBriefAcceptProof(
  evidence: AdvisorBriefReviewEvidence,
  expectedReviewer: string,
): boolean;
export function classifyAdvisorBriefAcceptProofPosture(
  evidence: AdvisorBriefReviewEvidence,
  expectedReviewer: string,
):
  | "source-confirmed-existing-action"
  | "accepted-by-another-reviewer"
  | "review-action-available"
  | "review-action-unavailable";
export function waitForAdvisorBriefReviewConfirmation(
  reviewRegion: {
    getByRole(role: "alert" | "status"): {
      count(): Promise<number>;
      isVisible(): Promise<boolean>;
      textContent(): Promise<string | null>;
    };
  },
  options: {
    timeoutMs: number;
    pollIntervalMs?: number;
    wait?: (delayMs: number) => Promise<void>;
  },
): Promise<void>;

export function validatePortfolioPanels(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<void>;
export function validateReportCentrePanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<{
  panelState: "partial";
  outputFormat: "json" | "pdf";
  pdfOutputState: "ready" | "unavailable";
  reason: string;
  reportJobId: string;
  reportRequestId: string;
  statusUrl: string;
  terminalStatus: "completed" | "archived";
}>;
export function waitForReportJobTerminalProof(options: {
  receipt: Record<string, unknown>;
  outputFormat: "json" | "pdf";
  portfolioId: string;
  timeoutMs: number;
  readHistory: (requestTimeoutMs: number) => Promise<unknown>;
  pollIntervalMs?: number;
  now?: () => number;
  wait?: (delayMs: number) => Promise<void>;
}): Promise<{
  reportJobId: string;
  reportRequestId: string;
  statusUrl: string;
  terminalStatus: "completed" | "archived";
}>;
export function readReportJobHistoryThroughWorkbench(
  page: BrowserValidationPage,
  portfolioId: string,
  requestTimeoutMs: number,
): Promise<unknown>;
export function readReportSubmissionReceiptWithinDeadline(
  response: { json: () => Promise<unknown> },
  remainingMs: number,
): Promise<unknown>;
export function validateAdvisorBookPanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<void>;
export function validatePerformanceSummaryPanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<void>;
export function validatePerformanceAnalysisPanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<void>;
export function validateAdvisorBriefPanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<{ detailBasis: string; chartFrequency: string } | null>;
export function validateRiskPanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<void>;
export function validateEvidencePanel(
  page: BrowserValidationPage,
  options: Record<string, unknown>
): Promise<void>;
