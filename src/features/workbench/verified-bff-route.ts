import {
  resolveAdvisoryCopilotAuthorityMode,
  resolveAdvisoryCopilotCapability,
} from "@/features/advisory-copilot/caller-context";
import {
  resolveAdvisorBookAuthorityMode,
  resolveAdvisorBookRouteCapability,
} from "@/features/advisor-book/caller-context";
import {
  resolveAdvisorCockpitAuthorityMode,
  resolveAdvisorCockpitCapability,
} from "@/features/advisor-cockpit/caller-context";
import {
  resolveIdeaAuthorityMode,
  resolveIdeaRouteCapability,
  resolveReportingAuthorityMode,
  resolveReportingRequestedPortfolioIds,
  resolveReportingRouteCapability,
} from "./caller-context";
import type { BffRouteAuthorityRequirement } from "./bff-principal-authority";

type BffRouteRequest = {
  method: string;
  upstreamPath: string;
  searchParams: URLSearchParams;
  bodyText?: string;
};

export function resolveVerifiedBffRouteRequirement(
  request: BffRouteRequest,
): BffRouteAuthorityRequirement | null {
  const ideaCapability =
    resolveIdeaAuthorityMode() === "authenticated_session"
      ? resolveIdeaRouteCapability(request)
      : undefined;
  const advisorBookCapability =
    resolveAdvisorBookAuthorityMode() === "authenticated_session"
      ? resolveAdvisorBookRouteCapability(request)
      : undefined;
  const advisorCockpitCapability =
    resolveAdvisorCockpitAuthorityMode() === "authenticated_session"
      ? resolveAdvisorCockpitCapability(request)
      : undefined;
  const reportingCapability =
    resolveReportingAuthorityMode() === "authenticated_session"
      ? resolveReportingRouteCapability(request)
      : undefined;
  const advisoryCopilotCapability =
    resolveAdvisoryCopilotAuthorityMode() === "authenticated_session"
      ? resolveAdvisoryCopilotCapability(request)
      : undefined;
  const requiredCapability =
    ideaCapability ??
    advisorBookCapability ??
    advisorCockpitCapability ??
    reportingCapability ??
    advisoryCopilotCapability;
  if (!requiredCapability) return null;

  const requestedPortfolioIds = reportingCapability
    ? resolveReportingRequestedPortfolioIds(request)
    : advisorCockpitCapability
      ? request.searchParams
          .getAll("portfolio_id")
          .map((portfolioId) => portfolioId.trim())
          .filter(Boolean)
      : [];
  return {
    requiredCapabilities: [requiredCapability],
    requestedPortfolioIds,
  };
}
