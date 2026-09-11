import type { ReactNode } from "react";

import PortfolioScreenRail from "@/apps/portfolio/components/portfolio-screen-rail";
import type { PortfolioReviewContext } from "@/apps/portfolio/portfolio-screen-navigation";
import {
  AppPageShell,
  buildWorkbenchSourceContextNotice,
  buildWorkbenchUnsupportedReviewContextNotice,
  combineWorkbenchContextNotices,
  MainWithSideRailLayout,
  SemanticBadge,
  WorkbenchPageContainer,
  WorkbenchPageFrame,
  WorkbenchSectionStack,
} from "@/design-system";
import ManageEvidenceRail from "@/features/workbench/components/manage-evidence-rail";
import { ManageProofPackStateProvider } from "@/features/workbench/manage-proof-pack-state";
import type { ManageWorkspaceData } from "@/features/workbench/manage-workspace-data";
import {
  buildManageModeItems,
  getManageModeDefinition,
  type ManageMode,
} from "@/features/workbench/manage-workspace-navigation";
import {
  buildManageReviewContextStrip,
  isManageExceptionEvidenceAvailable,
} from "@/features/workbench/manage-workspace-view-model";

import styles from "./manage-workspace.module.css";

export default function ManageWorkspaceShell({
  data,
  mode,
  reviewContext,
  actions,
  children,
}: {
  data: ManageWorkspaceData;
  mode: ManageMode;
  reviewContext: PortfolioReviewContext;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const portfolio = data.portfolio.portfolio;
  const modeDefinition = getManageModeDefinition(mode);
  const hasMandateEvidenceGap = Boolean(
    data.commandCenterError ||
      data.commandCenterExceptionsError ||
      !isManageExceptionEvidenceAvailable(data) ||
      data.mandateHealthError ||
      !data.mandateHealth,
  );
  const contextNotice = combineWorkbenchContextNotices({
    title: "Mandate source context",
    notices: [
      buildWorkbenchSourceContextNotice({
        title: "Mandate source context",
        subject: "Mandate management",
        requestedAsOfDate: reviewContext.asOfDate,
        requestedReportingCurrency: reviewContext.reportingCurrency,
        sourceAsOfDate: data.portfolio.as_of_date,
        sourceCurrency: portfolio.base_currency,
      }),
      buildWorkbenchUnsupportedReviewContextNotice({
        title: "Mandate source context",
        subject: "Mandate evidence",
        destination: "mandate management workspace",
        requestedPeriod: reviewContext.period,
      }),
    ],
  });

  return (
    <ManageProofPackStateProvider
      key={portfolio.portfolio_id}
      initialProofPack={data.proofPack}
    >
      <AppPageShell
        pageKey="manage"
        className={`portfolio-page manage-page ${styles.manageScope}`}
        reviewContext={buildManageReviewContextStrip(
          data,
          contextNotice
            ? {
                label: contextNotice.title,
                message: contextNotice.body,
                tone: "attention",
              }
            : null,
        )}
      >
        <WorkbenchPageContainer className="portfolio-page-container manage-page-container">
          <MainWithSideRailLayout
            className="manage-layout portfolio-page"
            railClassName="manage-rail-shell"
            mainClassName="manage-main"
            sideClassName="manage-side"
            sideDensity="comfortable"
            rail={
              <PortfolioScreenRail
                portfolioId={portfolio.portfolio_id}
                activeScreen="manage"
                relationshipIdBase="manage-workspace-rail"
                modeItems={buildManageModeItems(reviewContext, mode)}
                modeNavigationLabel="Manage workspace navigation"
              />
            }
            main={
              <WorkbenchPageFrame
                className={`manage-page-frame manage-page-frame-${mode}`}
                bodyClassName="manage-page-frame-body"
                title={modeDefinition.title}
                subtitle={modeDefinition.description}
                actions={actions ?? (
                  <SemanticBadge
                    tone={hasMandateEvidenceGap ? "warn" : "success"}
                  >
                    {hasMandateEvidenceGap
                      ? "Needs attention"
                      : "Evidence available"}
                  </SemanticBadge>
                )}
              >
                <WorkbenchSectionStack className="manage-page-sections">
                  {children}
                </WorkbenchSectionStack>
              </WorkbenchPageFrame>
            }
            side={<ManageEvidenceRail data={data} />}
          />
        </WorkbenchPageContainer>
      </AppPageShell>
    </ManageProofPackStateProvider>
  );
}
