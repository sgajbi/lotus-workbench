"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Fragment, useEffect, useState } from "react";

import { createLotusMuiTheme } from "@/design-system/theme/mui-theme";
import {
  WORKBENCH_QUERY_GC_TIME_MS,
  WORKBENCH_QUERY_STALE_TIME_MS,
} from "@/features/platform-runtime/query-policy";
import { subscribeToAuthorityChanges } from "@/features/workbench/client-authority-context";

const theme = createLotusMuiTheme();

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: WORKBENCH_QUERY_STALE_TIME_MS,
            gcTime: WORKBENCH_QUERY_GC_TIME_MS,
          },
        },
      })
  );
  const [authorityBoundaryRevision, setAuthorityBoundaryRevision] = useState(0);

  useEffect(
    () =>
      subscribeToAuthorityChanges(() => {
        void queryClient.cancelQueries();
        queryClient.clear();
        setAuthorityBoundaryRevision((revision) => revision + 1);
      }),
    [queryClient],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <Fragment key={authorityBoundaryRevision}>{children}</Fragment>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

