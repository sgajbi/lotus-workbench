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

export function assertClientContextMandateProof(proof: {
  sourceValue: string;
  renderedValue: string;
}): { sourceMandate: string; renderedMandate: string };

export function resolveCanonicalIdeaRestartPlan(
  lifecycleStatus: "ready_for_review" | "reviewed_by_advisor" | "approved",
): {
  mutationsAllowed: boolean;
  reviewRequired: boolean;
  actions: string[];
};

export function createBrowserValidationHelpers(args: {
  outputDir: string;
  summary: {
    uiChecks: unknown[];
    screenshots: unknown[];
  };
  portfolioId: string;
  benchmarkCode: string;
  canonicalAsOfDate: string;
  timeoutMs: number;
  panelRegistryById: Map<
    string,
    {
      screenshotName?: string;
      route: string;
    }
  >;
}): {
  assertListHasItems: (...args: unknown[]) => Promise<void>;
  assertTableHasRows: (...args: unknown[]) => Promise<void>;
  screenshotRegisteredPanel: (...args: unknown[]) => Promise<void>;
  resolveRegistryRoute: (routeTemplate: string) => string;
};

export function validateReportCentrePanel(
  page: unknown,
  options: Record<string, unknown>,
): Promise<void>;

export function validateAdvisorBookPanel(
  page: unknown,
  options: Record<string, unknown>,
): Promise<void>;
