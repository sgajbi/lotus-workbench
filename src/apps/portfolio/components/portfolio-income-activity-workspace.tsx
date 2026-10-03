import {
  AnalyticsModule,
  AnalyticsTable,
  SemanticBadge,
  WorkbenchSummaryMetricStrip,
} from "@/design-system";

import { formatCount, formatCurrency, formatDate, formatPct } from "../formatters";
import {
  buildPortfolioIncomeActivityReview,
  type PortfolioActivityDirection,
  type PortfolioActivityReview,
  type PortfolioIncomeReview,
} from "../portfolio-income-activity-view-model";
import type { PortfolioWorkspace } from "../types";
import PortfolioModuleState from "./portfolio-module-state";
import styles from "./portfolio-income-activity.module.css";

type PortfolioIncomeActivityWorkspaceProps = {
  workspace: PortfolioWorkspace;
};

export default function PortfolioIncomeActivityWorkspace({
  workspace,
}: PortfolioIncomeActivityWorkspaceProps) {
  const review = buildPortfolioIncomeActivityReview(workspace);

  return (
    <div className={styles.workspace} data-testid="income-activity-workspace">
      <div className={styles.scopeNote} role="note">
        <SemanticBadge tone="default">Booked records only</SemanticBadge>
        <span>
          Dividend and interest bookings are shown separately from subscriptions, withdrawals,
          fees, and taxes. Future income and projected cash are outside this review.
        </span>
      </div>

      <IncomeReviewModule income={review.income} />
      <ActivityReviewModule
        activity={review.activity}
        cashWeightPct={review.cashWeightPct}
        asOfDate={review.asOfDate}
      />
    </div>
  );
}

function IncomeReviewModule({ income }: { income: PortfolioIncomeReview | null }) {
  if (!income) {
    return (
      <AnalyticsModule
        title="Booked income"
        subtitle="Dividend and interest income recorded in the selected reporting window."
        compact
      >
        <PortfolioModuleState
          variant="status"
          state="empty"
          title="No booked income in this window"
          body="No dividend or interest bookings are available for the selected reporting window."
          hint="This booked-income view does not indicate future income or accrued entitlements."
        />
      </AnalyticsModule>
    );
  }

  const deductions =
    income.requestedWindow.withholdingTax + income.requestedWindow.otherDeductions;
  const windowLabel = formatWindowLabel(income.windowStartDate, income.windowEndDate);

  return (
    <AnalyticsModule
      title="Booked income"
      subtitle={`Gross-to-net dividend and interest income · ${windowLabel} · ${income.reportingCurrency}`}
      actions={<SemanticBadge tone="default">Reporting currency {income.reportingCurrency}</SemanticBadge>}
      compact
    >
      <WorkbenchSummaryMetricStrip
        ariaLabel="Booked income summary"
        items={[
          {
            key: "gross-income",
            label: "Gross income",
            value: formatCurrency(income.requestedWindow.gross, income.reportingCurrency),
            support: formatCount(income.requestedWindow.bookingCount, "booking"),
            definition: "Dividend and interest income before source-recorded deductions.",
          },
          {
            key: "income-deductions",
            label: "Tax & deductions",
            value: formatCurrency(deductions, income.reportingCurrency),
            support: "Withholding tax and other deductions",
            definition: "Withholding tax plus other deductions returned by the income summary.",
          },
          {
            key: "net-income",
            label: "Net income",
            value: formatCurrency(income.requestedWindow.net, income.reportingCurrency),
            support: "Selected reporting window",
            definition: "Net booked income after source-recorded taxes and deductions.",
          },
          {
            key: "ytd-net-income",
            label: "YTD net income",
            value: formatCurrency(income.yearToDate.net, income.reportingCurrency),
            support: `Through ${formatDate(income.windowEndDate)}`,
            definition: "Calendar-year net booked income through the selected window end date.",
          },
        ]}
      />

      <AnalyticsTable
        ariaLabel="Booked income by type"
        className={styles.table}
        density="compact"
        variant="portfolio"
        columns={[
          { key: "income-type", label: "Income type" },
          { key: "gross", label: "Gross", align: "right" },
          { key: "withholding", label: "Withholding tax", align: "right" },
          { key: "other-deductions", label: "Other deductions", align: "right" },
          { key: "net", label: "Net income", align: "right" },
          { key: "bookings", label: "Bookings", align: "right" },
          { key: "ytd-net", label: "YTD net", align: "right" },
        ]}
        rows={income.rows.map((row) => ({
          key: row.key,
          cells: [
            <strong key={`${row.key}-label`}>{row.label}</strong>,
            formatCurrency(row.requestedWindow.gross, income.reportingCurrency),
            formatCurrency(row.requestedWindow.withholdingTax, income.reportingCurrency),
            formatCurrency(row.requestedWindow.otherDeductions, income.reportingCurrency),
            <strong key={`${row.key}-net`}>{formatCurrency(row.requestedWindow.net, income.reportingCurrency)}</strong>,
            row.requestedWindow.bookingCount,
            formatCurrency(row.yearToDate.net, income.reportingCurrency),
          ],
        }))}
        footer={[
          "Portfolio total",
          formatCurrency(income.requestedWindow.gross, income.reportingCurrency),
          formatCurrency(income.requestedWindow.withholdingTax, income.reportingCurrency),
          formatCurrency(income.requestedWindow.otherDeductions, income.reportingCurrency),
          formatCurrency(income.requestedWindow.net, income.reportingCurrency),
          income.requestedWindow.bookingCount,
          formatCurrency(income.yearToDate.net, income.reportingCurrency),
        ]}
        emptyState={{
          title: "No income types in this window",
          body: "The income summary is available but contains no dividend or interest categories.",
        }}
      />
    </AnalyticsModule>
  );
}

function ActivityReviewModule({
  activity,
  cashWeightPct,
  asOfDate,
}: {
  activity: PortfolioActivityReview | null;
  cashWeightPct: number | null;
  asOfDate: string;
}) {
  if (!activity) {
    return (
      <AnalyticsModule
        title="Booked cash movements"
        subtitle="Subscriptions, withdrawals, fees, and taxes in the selected reporting window."
        compact
      >
        <PortfolioModuleState
          variant="status"
          state="empty"
          title="No booked cash movements in this window"
          body="No subscription, withdrawal, fee, or tax activity is available for the selected reporting window."
          hint="Expected settlements and other projected cash movements are reviewed separately in Cashflow."
        />
      </AnalyticsModule>
    );
  }

  const windowLabel = formatWindowLabel(activity.windowStartDate, activity.windowEndDate);

  return (
    <AnalyticsModule
      title="Booked cash movements"
      subtitle={`Subscriptions, withdrawals, fees, and taxes · ${windowLabel} · ${activity.reportingCurrency}`}
      actions={<SemanticBadge tone="default">Reporting currency {activity.reportingCurrency}</SemanticBadge>}
      compact
    >
      <WorkbenchSummaryMetricStrip
        ariaLabel="Booked cash movement summary"
        items={[
          {
            key: "gross-inflows",
            label: "Gross inflows",
            value: formatCurrency(activity.requestedWindow.grossInflows, activity.reportingCurrency),
            support: "Subscriptions and transfers in",
            definition: "Positive cash funding returned in the canonical inflows bucket.",
          },
          {
            key: "gross-outflows",
            label: "Gross outflows",
            value: formatCurrency(activity.requestedWindow.grossOutflows, activity.reportingCurrency),
            support: "Withdrawals, fees, and taxes",
            definition: "Cash uses returned in canonical outflow, fee, and tax buckets.",
          },
          {
            key: "net-cash-movement",
            label: "Net cash movement",
            value: formatCurrency(activity.requestedWindow.netMovement, activity.reportingCurrency),
            support: "Inflows less classified outflows",
            definition: "Gross inflows less withdrawals, fees, and taxes for the selected window.",
          },
          {
            key: "cash-weight",
            label: "Current cash weight",
            value: formatPct(cashWeightPct),
            support: `Portfolio snapshot as of ${formatDate(asOfDate)}`,
            definition: "Current portfolio cash allocation; it is not included in the window cash-movement calculation.",
          },
        ]}
      />

      {activity.requestedWindow.unclassifiedMovement > 0 ? (
        <div className={styles.classificationNote} role="note">
          <SemanticBadge tone="warn">Classification review</SemanticBadge>
          <span>
            {formatCurrency(
              activity.requestedWindow.unclassifiedMovement,
              activity.reportingCurrency,
            )} across {formatCount(
              activity.requestedWindow.unclassifiedBookingCount,
              "booking",
            )} is shown below and excluded from net cash movement because its cash direction is not defined by the Gateway contract.
          </span>
        </div>
      ) : null}

      <AnalyticsTable
        ariaLabel="Booked cash movements by type"
        className={styles.table}
        density="compact"
        variant="portfolio"
        columns={[
          { key: "activity-type", label: "Activity type" },
          { key: "direction", label: "Cash direction" },
          { key: "window-movement", label: "Window movement", align: "right" },
          { key: "bookings", label: "Bookings", align: "right" },
          { key: "share", label: "Share of activity", align: "right" },
          { key: "ytd-movement", label: "YTD movement", align: "right" },
        ]}
        rows={activity.rows.map((row) => ({
          key: row.key,
          cells: [
            <strong key={`${row.key}-label`}>{row.label}</strong>,
            <ActivityDirectionBadge key={`${row.key}-direction`} direction={row.direction} />,
            <span
              key={`${row.key}-window`}
              className={getMovementClassName(row.direction)}
            >
              {formatCurrency(row.requestedWindowAmount, activity.reportingCurrency)}
            </span>,
            row.requestedWindowBookingCount,
            formatPct(row.shareOfWindowActivityPct),
            <span key={`${row.key}-ytd`} className={getMovementClassName(row.direction)}>
              {formatCurrency(row.yearToDateAmount, activity.reportingCurrency)}
            </span>,
          ],
        }))}
        footer={[
          "Classified net movement",
          "Inflows less outflows",
          formatCurrency(activity.requestedWindow.netMovement, activity.reportingCurrency),
          activity.requestedWindow.classifiedBookingCount,
          "100%",
          formatCurrency(activity.yearToDate.netMovement, activity.reportingCurrency),
        ]}
        emptyState={{
          title: "No activity categories in this window",
          body: "The activity summary is available but contains no classified cash-movement categories.",
        }}
      />
    </AnalyticsModule>
  );
}

function ActivityDirectionBadge({ direction }: { direction: PortfolioActivityDirection }) {
  if (direction === "inflow") {
    return <SemanticBadge tone="success">Inflow</SemanticBadge>;
  }
  if (direction === "outflow") {
    return <SemanticBadge tone="warn">Outflow</SemanticBadge>;
  }
  return <SemanticBadge tone="default">Excluded from net</SemanticBadge>;
}

function getMovementClassName(direction: PortfolioActivityDirection): string | undefined {
  if (direction === "inflow") {
    return styles.amountPositive;
  }
  if (direction === "outflow") {
    return styles.amountNegative;
  }
  return undefined;
}

function formatWindowLabel(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}
