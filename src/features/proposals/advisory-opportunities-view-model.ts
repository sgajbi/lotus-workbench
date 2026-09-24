import type { AdvisorIdeaQueueItem, AdvisorIdeaReviewQueueData } from "./types";

export type AdvisoryOpportunityRow = {
  candidateId: string;
  title: string;
  rank: number | null;
  score: string;
  priority: string;
  reviewPosture: string;
  sourceSignals: string;
  reasonCodes: string;
  nextAction: string;
  href: string;
};

export type AdvisoryOpportunitiesModel = {
  portfolioId: string;
  candidateCount: number;
  excludedCount: number;
  policyVersion: string;
  evaluatedAtUtc: string;
  durableStorageBacked: boolean;
  supportedFeaturePromoted: boolean;
  primaryDecision: string;
  recommendedAction: string;
  rows: AdvisoryOpportunityRow[];
};

export function buildAdvisoryOpportunitiesModel({
  portfolioId,
  queue,
}: {
  portfolioId: string;
  queue?: AdvisorIdeaReviewQueueData | null;
  selectedCandidateId?: string;
}): AdvisoryOpportunitiesModel {
  const candidateItems = (queue?.items ?? []).filter(
    (item) => item.candidate?.candidateId,
  );
  const rows = candidateItems.map((item) =>
    buildOpportunityRow(portfolioId, item),
  );

  return {
    portfolioId,
    candidateCount: rows.length,
    excludedCount: queue?.exclusions?.length ?? 0,
    policyVersion: queue?.policyVersion ?? "Policy pending",
    evaluatedAtUtc: queue?.evaluatedAtUtc ?? "Evaluation pending",
    durableStorageBacked: queue?.durableStorageBacked === true,
    supportedFeaturePromoted: queue?.supportedFeaturePromoted === true,
    primaryDecision:
      "Which Idea candidate should be reviewed before advisory conversion?",
    recommendedAction:
      rows.length > 0
        ? "Review source evidence and decide whether the candidate is suitable for advisor follow-up."
        : "No Idea-owned candidates are currently ready for advisor review in this portfolio.",
    rows,
  };
}

function buildOpportunityRow(
  portfolioId: string,
  item: AdvisorIdeaQueueItem,
): AdvisoryOpportunityRow {
  const candidate = item.candidate!;
  const candidateId = candidate.candidateId;
  const reasonCodes = candidate.reasonCodes ?? item.reasonCodes ?? [];
  const sourceSignals = candidate.sourceSignalIds ?? [];
  return {
    candidateId,
    title: formatCandidateTitle(candidate.family, candidateId),
    rank: item.rank ?? null,
    score: candidate.score ?? item.score ?? "Score pending",
    priority: formatCode(item.priorityBucket ?? "priority_pending"),
    reviewPosture: formatCode(
      candidate.reviewPosture ?? "review_posture_pending",
    ),
    sourceSignals:
      sourceSignals.length > 0
        ? sourceSignals.join(", ")
        : "Source signal pending",
    reasonCodes:
      reasonCodes.length > 0
        ? reasonCodes.map(formatCode).join(", ")
        : "Reason pending",
    nextAction: "Review the evidence and record the next advisory decision.",
    href:
      `/recommendations?mode=opportunities&portfolioId=${encodeURIComponent(portfolioId)}` +
      `&candidateId=${encodeURIComponent(candidateId)}`,
  };
}

function formatCandidateTitle(
  family: string | undefined,
  candidateId: string,
): string {
  const familyLabels: Readonly<Record<string, string>> = {
    high_cash: "Excess Cash",
    low_income: "Projected Cash Shortfall",
  };
  const label = family
    ? familyLabels[family] ?? formatCode(family)
    : "Idea Candidate";
  return `${label} - ${candidateId}`;
}

function formatCode(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
