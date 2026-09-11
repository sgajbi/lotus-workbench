import { queryOptions } from "@tanstack/react-query";

import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";

import { getAdvisorBook, type AdvisorBookQuery } from "./api";
import type { AdvisorBookResponse } from "./contracts";

export type AdvisorBookQueryResult = Readonly<{
  response: AdvisorBookResponse | null;
  accessWithheld: boolean;
  refusal: unknown | null;
}>;

const advisorBookQueryRoot = ["advisor-book"] as const;

export const advisorBookQueryKeys = {
  all: advisorBookQueryRoot,
  portfolios(
    query: AdvisorBookQuery,
    recoverOutOfRange: boolean,
  ) {
    return [
      ...advisorBookQueryRoot,
      "portfolios",
      {
        asOfDate: query.asOfDate,
        clientId: query.clientId ?? null,
        mandateType: query.mandateType ?? null,
        sortBy: query.sortBy ?? null,
        sortOrder: query.sortOrder ?? null,
        offset: query.offset ?? null,
        limit: query.limit ?? null,
        recoverOutOfRange,
      },
    ] as const;
  },
};

export function advisorBookQueryOptions(
  query: AdvisorBookQuery,
  recoverOutOfRange: boolean,
) {
  return queryOptions({
    ...workbenchStrictQueryDefaults,
    queryKey: advisorBookQueryKeys.portfolios(query, recoverOutOfRange),
    queryFn: async ({ signal }) => {
      let response = await getAdvisorBook(query, { signal });
      if (
        recoverOutOfRange &&
        response.items.length === 0 &&
        response.page.total_count > 0 &&
        response.page.offset >= response.page.total_count
      ) {
        response = await getAdvisorBook(
          {
            ...query,
            offset:
              Math.floor((response.page.total_count - 1) / response.page.limit) *
              response.page.limit,
            limit: response.page.limit,
          },
          { signal },
        );
      }
      const result: AdvisorBookQueryResult = {
        response,
        accessWithheld: false,
        refusal: null,
      };
      return result;
    },
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: false,
  });
}
