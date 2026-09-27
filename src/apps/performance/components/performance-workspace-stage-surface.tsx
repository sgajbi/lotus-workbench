import type { ReactNode } from "react";

import { Panel, Text } from "@/design-system";
import type { WorkbenchPerformanceWorkspace } from "@/features/workbench/types";

import type { PerformanceWorkspaceModeIntro } from "../performance-workspace-modes";
import { formatDate, formatLabel } from "../formatters";
import {
  getPerformanceFeeBasisLabel,
  PERFORMANCE_CONTEXT_LABELS,
} from "../performance-terminology";

import { getPerformanceBenchmarkLabel } from "./performance-summary-context-helpers";
import PerformanceModeIntro from "./performance-mode-intro";

type PerformanceWorkspaceContextItem = {
  label: string;
  value: string;
};

export function buildPerformanceWorkspaceContextItems({
  workspace,
  period,
  detailBasis,
  benchmark,
}: {
  workspace: WorkbenchPerformanceWorkspace;
  period: string;
  detailBasis: string;
  benchmark?: string;
}): PerformanceWorkspaceContextItem[] {
  return [
    {
      label: "Portfolio",
      value: workspace.portfolio.portfolio_id,
    },
    {
      label: "Benchmark",
      value: getPerformanceBenchmarkLabel(
        workspace.benchmark_code ?? benchmark,
        workspace.benchmark_options ?? []
      ),
    },
    {
      label: PERFORMANCE_CONTEXT_LABELS.reviewWindow,
      value: formatLabel(period),
    },
    {
      label: PERFORMANCE_CONTEXT_LABELS.feeBasis,
      value: getPerformanceFeeBasisLabel(detailBasis),
    },
    {
      label: PERFORMANCE_CONTEXT_LABELS.asOfDate,
      value: formatDate(workspace.as_of_date),
    },
  ];
}

export function PerformanceWorkspaceContextBar({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: PerformanceWorkspaceContextItem[];
}) {
  return (
    <div className="performance-workspace-context-grid" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.label} className="performance-workspace-context-item">
          <Text variant="dataLabel">{item.label}</Text>
          <Text variant="cardTitle">{item.value}</Text>
        </div>
      ))}
    </div>
  );
}

export default function PerformanceWorkspaceStageSurface({
  intro,
  contextAriaLabel,
  contextItems,
  shellClassName,
  shellHeader,
  shellAriaLabel,
  shellRole,
  children,
}: {
  intro?: PerformanceWorkspaceModeIntro | null;
  contextAriaLabel?: string;
  contextItems?: PerformanceWorkspaceContextItem[];
  shellClassName?: string;
  shellHeader?: ReactNode;
  shellAriaLabel?: string;
  shellRole?: "region" | "group";
  children: ReactNode;
}) {
  return (
    <section className="performance-workspace-stage">
      {intro ? (
        <PerformanceModeIntro
          ariaLabel={intro.ariaLabel}
          kicker={intro.kicker}
          title={intro.title}
          description={intro.description}
          compact
        />
      ) : null}
      {contextAriaLabel && contextItems?.length ? (
        <PerformanceWorkspaceContextBar ariaLabel={contextAriaLabel} items={contextItems} />
      ) : null}
      <Panel
        className={["performance-workspace-shell", shellClassName].filter(Boolean).join(" ")}
        aria-label={shellAriaLabel}
        role={shellRole}
      >
        {shellHeader ? (
          <div className="performance-workspace-shell-header">{shellHeader}</div>
        ) : null}
        {children}
      </Panel>
    </section>
  );
}
