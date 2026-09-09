"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import {
  PageToolbar,
  SourceRefreshAction,
  WorkbenchDataAge,
  WorkbenchChoiceGroup,
  WorkbenchToolbarGroup,
} from "@/design-system";
import { PORTFOLIO_REVIEW_COPY } from "@/copy/portfolio-review-copy";

import type {
  PortfolioWorkspaceContext,
  PortfolioWorkspaceControls,
} from "../view-model";
import { PORTFOLIO_CURRENCY_LABELS } from "../portfolio-terminology";
import { PORTFOLIO_TIME_WINDOW_OPTIONS } from "../view-model";
import choiceStyles from "./portfolio-choice-groups.module.css";
import styles from "./portfolio-workspace-toolbar.module.css";

type PortfolioSourceReceipt = {
  checkedAt: number | null;
  refreshScope: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<unknown>;
  announcement?: string;
};

export default function PortfolioWorkspaceToolbar({
  controls,
  context,
  onControlsChange,
  onExport,
  quickActions,
  sourceReceipt,
  contextChangePending = false,
}: {
  controls: PortfolioWorkspaceControls;
  context: PortfolioWorkspaceContext;
  onControlsChange: (patch: Partial<PortfolioWorkspaceControls>) => void;
  onExport: () => void;
  quickActions: Array<{ key: string; label: string; href: string }>;
  sourceReceipt?: PortfolioSourceReceipt;
  contextChangePending?: boolean;
}) {
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);

  const historicalContextCopy = useMemo(() => {
    if (context.historicalSnapshotState === "unsupported") {
      return "Historical review is not available for this book yet.";
    }

    if (context.historicalSnapshotState === "partial") {
      return "Historical review is not available across the portfolio record.";
    }

    if (!context.hasHistoricalGap) {
      return "Portfolio records use the confirmed business date.";
    }

    return "Some work areas use the latest available book state.";
  }, [
    context.hasHistoricalGap,
    context.historicalSnapshotState,
  ]);
  const historicalControlTitle = !context.supportsHistoricalSnapshots
    ? context.historicalSnapshotReason
    : undefined;
  const reportingCurrencyControlTitle = !context.supportsReportingCurrencyRestatement
    ? context.reportingCurrencyRestatementReason
    : undefined;
  const contextSegments = useMemo(() => {
    const segments = [historicalContextCopy];

    if (context.reportingCurrencyRestatementState !== "supported") {
      segments.push("Some workflow views keep book currency until full restatement is available.");
    }

    segments.push(`Period ${context.periodLabel}.`);

    return segments;
  }, [context.periodLabel, context.reportingCurrencyRestatementState, historicalContextCopy]);

  return (
    <PageToolbar className="portfolio-workspace-toolbar">
      <div className="portfolio-workspace-toolbar-row">
        <div className="portfolio-workspace-toolbar-groups">
          <WorkbenchToolbarGroup
            title="Context"
            className="portfolio-workspace-toolbar-group portfolio-workspace-toolbar-group-context"
            ariaLabel="Context controls"
          >
              <div className="portfolio-workspace-toolbar-field">
                <label htmlFor="portfolio-as-of-date">As of</label>
                <TextField
                  id="portfolio-as-of-date"
                  type="date"
                  size="small"
                  value={controls.asOfDate}
                  onChange={(event) => onControlsChange({ asOfDate: event.target.value })}
                  inputProps={{
                    min: context.historicalDateRange?.earliest,
                    max: context.historicalDateRange?.latest,
                  }}
                  title={historicalControlTitle}
                  disabled={!context.supportsHistoricalSnapshots || contextChangePending}
                />
              </div>

              <div className="portfolio-workspace-toolbar-field">
                <label htmlFor="portfolio-reporting-currency">
                  {PORTFOLIO_CURRENCY_LABELS.reporting}
                </label>
                <TextField
                  id="portfolio-reporting-currency"
                  select
                  size="small"
                  value={controls.reportingCurrency}
                  onChange={(event) =>
                    onControlsChange({ reportingCurrency: event.target.value })
                  }
                  SelectProps={{ native: true }}
                  title={reportingCurrencyControlTitle}
                  disabled={!context.supportsReportingCurrencyRestatement || contextChangePending}
                >
                  {context.currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </TextField>
              </div>
          </WorkbenchToolbarGroup>

        </div>

        <div className="portfolio-workspace-toolbar-sidecar">
          <div className="portfolio-workspace-toolbar-actions">
            {sourceReceipt ? (
              <div className={styles.sourceReceipt}>
                <WorkbenchDataAge
                  updatedAt={sourceReceipt.checkedAt}
                />
                <SourceRefreshAction
                  refreshScope={sourceReceipt.refreshScope}
                  idleLabel={PORTFOLIO_REVIEW_COPY.recheckAction}
                  busyLabel="Rechecking…"
                  isRefreshing={sourceReceipt.isRefreshing}
                  onRefresh={sourceReceipt.onRefresh}
                />
                {sourceReceipt.announcement ? (
                  <span className="sr-only" role="status" aria-live="polite">
                    {sourceReceipt.announcement}
                  </span>
                ) : null}
              </div>
            ) : null}
            <Button
              variant="outlined"
              size="small"
              className="portfolio-workspace-toolbar-action"
              aria-label="Export portfolio data"
              onClick={onExport}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              size="small"
              className="portfolio-workspace-toolbar-action"
              aria-haspopup="menu"
              aria-expanded={Boolean(actionsAnchor)}
              aria-label="More actions"
              onClick={(e) => setActionsAnchor(e.currentTarget)}
            >
              More
            </Button>
          </div>

          <WorkbenchToolbarGroup
            title="Period"
            className="portfolio-workspace-toolbar-group portfolio-workspace-toolbar-group-period"
            ariaLabel="Period controls"
          >
              <div className="portfolio-workspace-toolbar-field portfolio-workspace-toolbar-field-grow portfolio-workspace-toolbar-field-presets">
                <WorkbenchChoiceGroup
                  value={controls.timeWindow}
                  onChange={(timeWindow) => onControlsChange({ timeWindow })}
                  options={PORTFOLIO_TIME_WINDOW_OPTIONS.map((option) => ({
                    key: option,
                    label: option,
                    disabled: contextChangePending,
                  }))}
                  ariaLabel="Portfolio period presets"
                  className={choiceStyles.period}
                />
              </div>

          </WorkbenchToolbarGroup>
        </div>
      </div>

      <div className="portfolio-workspace-toolbar-context">
        {contextSegments.map((segment) => (
          <span key={segment}>{segment}</span>
        ))}
      </div>

      <Menu
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={() => setActionsAnchor(null)}
      >
        <Box sx={{ px: 1.5, py: 1 }}>
          <Stack spacing={1}>
            {quickActions.map((action, index) => (
              <Box key={action.key}>
                {index ? <Divider sx={{ mb: 1 }} /> : null}
                <Button
                  component={Link}
                  href={action.href}
                  size="small"
                  variant="text"
                  sx={{ justifyContent: "flex-start", width: "100%" }}
                >
                  {action.label}
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      </Menu>
    </PageToolbar>
  );
}
