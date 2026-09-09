import { buildAnalyticsUiCorrelationHeaders } from "@/features/analytics-observability/correlation";
import {
  buildWorkbenchUrl,
  fetchWorkbenchJson,
  observeWorkbenchResource,
} from "@/features/workbench/api-client";

import {
  parseAdvisorBookResponse,
  type AdvisorBookResponse,
  type AdvisorBookSortBy,
  type AdvisorBookSortOrder,
} from "./contracts";

export type AdvisorBookQuery = {
  asOfDate: string;
  clientId?: string;
  mandateType?: "ADVISORY" | "DISCRETIONARY";
  sortBy?: AdvisorBookSortBy;
  sortOrder?: AdvisorBookSortOrder;
  offset?: number;
  limit?: number;
};

export async function getAdvisorBook(
  query: AdvisorBookQuery,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<AdvisorBookResponse> {
  const search = buildAdvisorBookSearchParams(query);

  return await observeWorkbenchResource("advisor-book.portfolios", async () => {
    const payload = await fetchWorkbenchJson<unknown>(
      buildWorkbenchUrl("client", "/advisor-book/portfolios", search),
      "advisor book",
      {
        headers: buildAnalyticsUiCorrelationHeaders(),
        signal: options.signal,
      },
    );
    const response = parseAdvisorBookResponse(payload);
    if (response.scope.as_of_date !== query.asOfDate) {
      throw new Error(
        "Advisor book response business date did not match the requested source scope",
      );
    }
    return response;
  });
}

export function buildAdvisorBookSearchParams(query: AdvisorBookQuery): URLSearchParams {
  const search = new URLSearchParams({ asOfDate: query.asOfDate });
  if (query.clientId?.trim()) {
    search.set("clientId", query.clientId.trim());
  }
  if (query.mandateType) {
    search.set("mandateType", query.mandateType);
  }
  if (query.sortBy) {
    search.set("sortBy", query.sortBy);
  }
  if (query.sortOrder) {
    search.set("sortOrder", query.sortOrder);
  }
  if (query.offset !== undefined) {
    search.set("offset", String(query.offset));
  }
  if (query.limit !== undefined) {
    search.set("limit", String(query.limit));
  }
  return search;
}
