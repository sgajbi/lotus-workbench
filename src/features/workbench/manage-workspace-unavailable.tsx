import ReviewContextPageRecovery from "@/shell/review-context-page-recovery";
import type { ReactNode } from "react";

export function ManageWorkspaceUnavailable({ detail, action }: { detail: string; action?: ReactNode }) {
  return (
    <ReviewContextPageRecovery
      pageKey="manage"
      pageTitle="Manage Workspace"
      pageSubtitle="Confirm the portfolio before using mandate and implementation controls."
      body={detail}
      href="/book"
      actionLabel="Select a portfolio from My book"
      action={action}
    />
  );
}
