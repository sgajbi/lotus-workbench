"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isWorkbenchPermissionBlockedError } from "@/features/workbench/api-client";

import type { AdvisorBookQuery } from "./api";
import {
  advisorBookQueryOptions,
  type AdvisorBookQueryResult,
} from "./advisor-book-query-options";

export function useAdvisorBook(
  query: AdvisorBookQuery,
  options: { recoverOutOfRange?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const queryDefinition = advisorBookQueryOptions(
    query,
    options.recoverOutOfRange ?? false,
  );
  const sourceQuery = useQuery(queryDefinition);
  const permissionBlocked = isWorkbenchPermissionBlockedError(sourceQuery.error);
  const rowsWithheld = permissionBlocked || sourceQuery.data?.accessWithheld === true;
  const response = rowsWithheld ? null : (sourceQuery.data?.response ?? null);
  const hasAdmittedResponse = response !== null;
  const sourceError = sourceQuery.error ?? sourceQuery.data?.refusal ?? null;

  return {
    response,
    loading: sourceQuery.isPending || (!hasAdmittedResponse && sourceQuery.isFetching),
    error: hasAdmittedResponse ? null : sourceError,
    recheckError:
      hasAdmittedResponse && !sourceQuery.isFetching ? sourceQuery.error : null,
    rechecking: hasAdmittedResponse && sourceQuery.isFetching,
    checkedAt: hasAdmittedResponse ? sourceQuery.dataUpdatedAt : null,
    reload: async () => {
      const activeQuery = queryClient
        .getQueryCache()
        .find({ queryKey: queryDefinition.queryKey, exact: true });
      const previousReceipt =
        queryClient.getQueryState(queryDefinition.queryKey)?.dataUpdatedAt ?? 0;
      try {
        const result = await sourceQuery.refetch({
          cancelRefetch: true,
          throwOnError: true,
        });
        const currentQuery = queryClient
          .getQueryCache()
          .find({ queryKey: queryDefinition.queryKey, exact: true });
        if (
          currentQuery === activeQuery &&
          result.isSuccess &&
          result.data !== undefined
        ) {
          queryClient.setQueryData(queryDefinition.queryKey, result.data, {
            updatedAt: Math.max(Date.now(), previousReceipt + 1),
          });
        }
      } catch (error) {
        if (isWorkbenchPermissionBlockedError(error)) {
          queryClient.setQueryData<AdvisorBookQueryResult>(
            queryDefinition.queryKey,
            {
              response: null,
              accessWithheld: true,
              refusal: error,
            },
            { updatedAt: previousReceipt },
          );
        }
        // Query state owns the user-visible failure; cancellation must not restore cleared data.
      }
    },
  };
}
