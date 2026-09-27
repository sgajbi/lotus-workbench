import { Text } from "@/design-system";

import RiskTermLabel from "./risk-term-label";

export default function RiskMetricCard({
  label,
  value,
  support,
  metadata,
  definition,
  tone = "default",
  density = "default",
  className,
  ariaLabel,
  title,
  displaySupport = true,
  displayMetadata = false,
}: {
  label: string;
  value: string;
  support: string;
  metadata?: string;
  definition?: string;
  tone?: "default" | "success" | "warn" | "danger";
  density?: "default" | "compact";
  className?: string;
  ariaLabel?: string;
  title?: string;
  displaySupport?: boolean;
  displayMetadata?: boolean;
}) {
  return (
    <article
      className={[
        "performance-risk-metric-card",
        density === "compact" ? "performance-risk-metric-card-compact" : "",
        tone === "success"
          ? "performance-risk-metric-card-success"
          : tone === "warn"
          ? "performance-risk-metric-card-warn"
          : tone === "danger"
            ? "performance-risk-metric-card-danger"
            : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel ?? `${label}: ${value}. ${support}`}
      title={title}
    >
      <div className="performance-risk-metric-card-copy">
        {definition ? (
          <RiskTermLabel label={label} definition={definition} />
        ) : (
          <Text variant="dataLabel" className="workbench-summary-metric-label">
            {label}
          </Text>
        )}
        {displaySupport ? (
          <Text variant="metadata" className="performance-risk-metric-card-support">
            {support}
          </Text>
        ) : null}
        {displayMetadata && metadata ? (
          <Text variant="metadata" className="performance-risk-metric-card-metadata">
            {metadata}
          </Text>
        ) : null}
      </div>
      <Text
        variant="metricValueCompact"
        className="performance-risk-metric-card-value workbench-summary-metric-value"
      >
        {value}
      </Text>
    </article>
  );
}
