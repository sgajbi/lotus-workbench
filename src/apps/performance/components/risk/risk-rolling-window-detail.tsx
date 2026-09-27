import {
  Text,
  WorkbenchChoiceGroup,
} from "@/design-system";

import type { PerformanceRiskRollingWindow, PerformanceRiskViewModel } from "../../risk-workspace-view-model";
import RiskAnalyticalTable from "./risk-analytical-table";
import RiskDetailSection from "./risk-detail-section";
import RiskRangeIndicator from "./risk-range-indicator";
import { riskRollingPanelCopy } from "./risk-secondary-copy";
import choiceStyles from "../performance-choice-groups.module.css";
import RiskTableText from "./risk-table-text";

const PRIMARY_ROLLING_MEASURES = new Set(["Volatility", "Tracking error", "Beta", "Max drawdown"]);

export default function RiskRollingWindowDetail({
  viewModel,
  selectedWindow,
  selectedWindowKey,
  onWindowChange,
}: {
  viewModel: PerformanceRiskViewModel;
  selectedWindow: PerformanceRiskRollingWindow | null;
  selectedWindowKey: string;
  onWindowChange: (value: string) => void;
}) {
  const detailRows = (selectedWindow?.detailRowInterpretations ?? []).filter(
    (row) => !PRIMARY_ROLLING_MEASURES.has(row.metric)
  );
  const fallbackDetail = resolveRollingFallbackDetail(viewModel);
  const emptyDetail = selectedWindow ? riskRollingPanelCopy.detailTableEmptyState : fallbackDetail;

  return (
    <RiskDetailSection
      ariaLabel="Rolling risk detail"
      density="compact"
      toolbar={
        viewModel.rollingWindows.length > 1 ? (
          <div className="performance-risk-rolling-window-selector">
            <div className="performance-risk-rolling-window-selector-copy">
              <Text variant="dataLabel">{riskRollingPanelCopy.reviewWindowLabel}</Text>
              <Text variant="metadata">{riskRollingPanelCopy.reviewWindowSupport}</Text>
            </div>
            <WorkbenchChoiceGroup
              value={selectedWindow?.key ?? selectedWindowKey}
              onChange={onWindowChange}
              options={viewModel.rollingWindows.map((window) => ({
                key: window.key,
                label: window.label,
                title: `${window.label} rolling window`,
              }))}
              ariaLabel="Rolling risk windows"
              className={choiceStyles.riskWindow}
              density="compact"
            />
          </div>
        ) : null
      }
    >
      {detailRows.length === 0 ? (
        <div className="performance-risk-note-card performance-risk-note-card-compact">
          <div className="performance-risk-note-copy">
            <Text variant="cardTitle">{emptyDetail.title}</Text>
            <Text variant="secondary">{emptyDetail.body}</Text>
          </div>
        </div>
      ) : null}
      {detailRows.length > 0 ? (
        <RiskAnalyticalTable
          ariaLabel={riskRollingPanelCopy.detailTableAriaLabel}
          density="compact"
          className="performance-risk-rolling-detail-table"
          columns={[
            { key: "metric", label: "Measure" },
            { key: "current", label: "Current", align: "right" },
            { key: "typical", label: "Typical", align: "right" },
            { key: "range", label: "Range", align: "right" },
            { key: "interpretation", label: "Review note" },
          ]}
          rows={detailRows.map((row) => ({
            key: row.key,
            cells: [
              <RiskTableText key={`${row.key}-metric`} value={row.metric} />,
              <RiskRangeIndicator
                key={`${row.key}-current`}
                current={row.current}
                currentPositionPct={row.currentPositionPct}
                typicalPositionPct={row.typicalPositionPct}
              />,
              row.typical,
              row.range,
              <RiskTableText
                key={`${row.key}-interpretation`}
                value={row.interpretation}
                clamp
              />,
            ],
          }))}
          emptyState={riskRollingPanelCopy.detailTableEmptyState}
        />
      ) : null}
    </RiskDetailSection>
  );
}

function resolveRollingFallbackDetail(viewModel: PerformanceRiskViewModel) {
  const failureDetail = viewModel.partialFailures[0];

  if (failureDetail) {
    return {
      title: "Rolling stability review is partially available",
      body: `${failureDetail} Historical attribution remains available, but rolling-window review is incomplete for this selection.`,
    };
  }

  return {
    title: "Rolling stability review is unavailable",
    body:
      "Rolling risk windows were not returned for the selected portfolio context. Historical attribution remains available, but stability review is not currently supported.",
  };
}
