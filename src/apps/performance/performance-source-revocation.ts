import type { QueryClient } from "@tanstack/react-query";

type PerformanceSourceConfirmationState = {
  deniedPortfolioIds: Set<string>;
  confirmedAuthorityRevisionByPortfolio: Map<string, number>;
};

const sourceConfirmationByQueryClient = new WeakMap<
  QueryClient,
  PerformanceSourceConfirmationState
>();

export function capturePerformancePortfoliosRequiringConfirmation(
  queryClient: QueryClient,
  portfolioId: string | undefined,
  authorityBoundaryRevision: number,
): ReadonlySet<string> {
  const state = sourceConfirmationByQueryClient.get(queryClient);
  const portfolioIds = new Set(state?.deniedPortfolioIds ?? []);
  if (
    portfolioId &&
    authorityBoundaryRevision > 0 &&
    state?.confirmedAuthorityRevisionByPortfolio.get(portfolioId) !==
      authorityBoundaryRevision
  ) {
    portfolioIds.add(portfolioId);
  }
  return portfolioIds;
}

export function revokePerformancePortfolio(
  queryClient: QueryClient,
  portfolioId: string,
) {
  const state = getOrCreateSourceConfirmationState(queryClient);
  state.deniedPortfolioIds.add(portfolioId);
}

export function confirmPerformancePortfolio(
  queryClient: QueryClient,
  portfolioId: string,
  authorityBoundaryRevision: number,
) {
  const state = getOrCreateSourceConfirmationState(queryClient);
  state.deniedPortfolioIds.delete(portfolioId);
  state.confirmedAuthorityRevisionByPortfolio.set(
    portfolioId,
    authorityBoundaryRevision,
  );
}

function getOrCreateSourceConfirmationState(
  queryClient: QueryClient,
): PerformanceSourceConfirmationState {
  const existingState = sourceConfirmationByQueryClient.get(queryClient);
  if (existingState) {
    return existingState;
  }
  const newState: PerformanceSourceConfirmationState = {
    deniedPortfolioIds: new Set(),
    confirmedAuthorityRevisionByPortfolio: new Map(),
  };
  sourceConfirmationByQueryClient.set(queryClient, newState);
  return newState;
}
