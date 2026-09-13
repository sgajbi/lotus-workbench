import {
  AppPageShell,
  type ReviewContextStripModel,
  WorkbenchPageContainer,
  WorkbenchPageFrame,
  WorkbenchSectionStack,
} from "@/design-system";
import type { ReactNode } from "react";

import ReviewContextRecovery from "./review-context-recovery";
import { buildUnavailableReviewContextStrip } from "./review-context-strip-view-model";

export default function ReviewContextPageRecovery({
  pageKey,
  pageTitle,
  pageSubtitle,
  body,
  href,
  actionLabel,
  action,
  reviewContext = buildUnavailableReviewContextStrip(),
  className = "portfolio-page",
  containerClassName = "portfolio-page-container",
  frameClassName,
  bodyClassName,
  sectionClassName,
}: {
  pageKey: string;
  pageTitle: string;
  pageSubtitle: string;
  body: string;
  href: string;
  actionLabel: string;
  action?: ReactNode;
  reviewContext?: ReviewContextStripModel;
  className?: string;
  containerClassName?: string;
  frameClassName?: string;
  bodyClassName?: string;
  sectionClassName?: string;
}) {
  return (
    <AppPageShell
      pageKey={pageKey}
      className={className}
      reviewContext={reviewContext}
    >
      <WorkbenchPageContainer className={containerClassName}>
        <WorkbenchPageFrame
          className={frameClassName}
          bodyClassName={bodyClassName}
          title={pageTitle}
          subtitle={pageSubtitle}
        >
          <WorkbenchSectionStack className={sectionClassName}>
            <ReviewContextRecovery
              body={body}
              href={href}
              actionLabel={actionLabel}
              action={action}
            />
          </WorkbenchSectionStack>
        </WorkbenchPageFrame>
      </WorkbenchPageContainer>
    </AppPageShell>
  );
}
