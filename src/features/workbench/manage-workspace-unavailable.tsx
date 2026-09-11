import ReviewContextPageRecovery from "@/shell/review-context-page-recovery";

export function ManageWorkspaceUnavailable({ detail }: { detail: string }) {
  return (
    <ReviewContextPageRecovery
      pageKey="manage"
      pageTitle="Manage Workspace"
      pageSubtitle="Confirm the portfolio before using mandate and implementation controls."
      body={detail}
      href="/book"
      actionLabel="Select a portfolio from My book"
    />
  );
}
