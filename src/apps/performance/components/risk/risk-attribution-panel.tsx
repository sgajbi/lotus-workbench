import {
  ScreenStatePanel,
  WorkbenchContextNotice,
  WorkbenchChoiceGroup,
  WorkbenchStatusRow,
} from "@/design-system";

import type { PerformanceRiskViewModel } from "../../risk-workspace-view-model";
import RiskDetailSection from "./risk-detail-section";
import RiskAnalyticalTable from "./risk-analytical-table";
import RiskModuleShell from "./risk-module-shell";
import RiskPanelUtilityRow from "./risk-panel-utility-row";
import { riskAttributionPanelCopy } from "./risk-secondary-copy";
import choiceStyles from "../performance-choice-groups.module.css";
import RiskShareBar from "./risk-share-bar";
import RiskTableText from "./risk-table-text";

type RiskAttributionPanelProps = {
  viewModel: PerformanceRiskViewModel;
  onSelectAttribution: (attributionType: string, groupingDimension: string) => void;
};

export default function RiskAttributionPanel({
  viewModel,
  onSelectAttribution,
}: RiskAttributionPanelProps) {
  const controls = viewModel.attributionControls;

  return (
    <RiskModuleShell
      title={riskAttributionPanelCopy.title}
      priority="secondary"
      density="compact"
      className="performance-risk-attribution-panel"
      actions={
        <RiskPanelUtilityRow
          panelTitle={riskAttributionPanelCopy.methodologyPanelTitle}
          methodologyRows={viewModel.attributionMethodologyRows}
        />
      }
      detail={
        <RiskDetailSection
          title={riskAttributionPanelCopy.detailTitle}
          ariaLabel={riskAttributionPanelCopy.detailAriaLabel}
          density="compact"
          toolbar={
            controls ? (
              <div className="performance-risk-attribution-toolbar">
                <WorkbenchChoiceGroup
                  value={controls.selectedAttributionType}
                  onChange={(nextValue) =>
                    onSelectAttribution(nextValue, controls.selectedGroupingDimension)
                  }
                  options={controls.attributionTypes.map((option) => ({
                    key: option.key,
                    label: option.label,
                    disabled: option.disabled,
                    title: option.reason ?? undefined,
                  }))}
                  ariaLabel={riskAttributionPanelCopy.attributionTypeAriaLabel}
                  className={choiceStyles.riskCompact}
                  density="compact"
                />
                <WorkbenchChoiceGroup
                  value={controls.selectedGroupingDimension}
                  onChange={(nextValue) =>
                    onSelectAttribution(controls.selectedAttributionType, nextValue)
                  }
                  options={controls.groupingDimensions.map((option) => ({
                    key: option.key,
                    label: option.label,
                    disabled: option.disabled,
                    title: option.reason ?? undefined,
                  }))}
                  ariaLabel={riskAttributionPanelCopy.groupingAriaLabel}
                  className={choiceStyles.riskCompact}
                  density="compact"
                />
              </div>
            ) : null
          }
        >
          {viewModel.attributionState === "partial" ? (
            <WorkbenchContextNotice
              eyebrow={riskAttributionPanelCopy.partialEyebrow}
              title={riskAttributionPanelCopy.partialTitle}
              body={riskAttributionPanelCopy.partialBody}
            />
          ) : null}
          {viewModel.attributionState === "loading" ? (
            <ScreenStatePanel
              kind="loading"
              title={riskAttributionPanelCopy.loadingTitle}
              body={riskAttributionPanelCopy.loadingBody}
              surface="analysis"
              rows={2}
            />
          ) : viewModel.attributionState === "blocked" ? (
            <ScreenStatePanel
              kind="partial"
              title={riskAttributionPanelCopy.blockedTitle}
              body={riskAttributionPanelCopy.blockedBody}
              hint={riskAttributionPanelCopy.blockedHint}
              surface="analysis"
            />
          ) : viewModel.attributionState === "unavailable" ? (
            <ScreenStatePanel
              kind="unavailable"
              title={riskAttributionPanelCopy.unavailableTitle}
              body={riskAttributionPanelCopy.unavailableBody}
              surface="analysis"
            />
          ) : (
            <RiskAnalyticalTable
              ariaLabel={riskAttributionPanelCopy.tableAriaLabel}
              density="compact"
              className="performance-risk-attribution-detail-table"
              columns={[
                { key: "group", label: "Group" },
                { key: "avgWeight", label: "Average weight", align: "right" },
                { key: "marginalContribution", label: "Marginal", align: "right" },
                { key: "componentContribution", label: "Component", align: "right" },
                { key: "contributionShare", label: "Share", align: "right" },
              ]}
              rows={viewModel.attributionRows.map((row) => ({
                key: row.key,
                cells: [
                  <RiskTableText key={`${row.key}-group`} value={row.group} truncate />,
                  row.avgWeight,
                  row.marginalContribution,
                  row.componentContribution,
                  <RiskShareBar
                    key={`${row.key}-share`}
                    value={row.contributionShare}
                    absValue={row.contributionShareAbsPct}
                    maxAbsValue={viewModel.attributionMaxContributionShareAbsPct}
                  />,
                ],
              }))}
              emptyState={riskAttributionPanelCopy.tableEmptyState}
            />
          )}

          {viewModel.attributionWarnings.length ? (
            <WorkbenchStatusRow
              label={riskAttributionPanelCopy.warningsLabel}
              className="performance-risk-quality-flags performance-risk-attribution-warnings-row"
              items={viewModel.attributionWarnings.map((warning) => ({
                value: warning,
                tone: "warn" as const,
              }))}
            />
          ) : null}
        </RiskDetailSection>
      }
    />
  );
}
