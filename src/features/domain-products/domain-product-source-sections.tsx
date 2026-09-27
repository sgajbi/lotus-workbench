import {
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  SourceRefreshAction,
  Text,
  WorkbenchSummaryMetricStrip,
} from "@/design-system";

import type {
  DomainProductGraphData,
  DomainProductTrustCertificationData,
} from "./api";
import styles from "./domain-product-discovery.module.css";
import {
  formatDateTime,
  formatIdentifier,
  formatStateLabel,
  getTrustTone,
} from "./presentation";

export function TrustSection({
  data,
  hasError,
  isLoading,
  isRefreshing,
  onRefresh,
}: {
  data: DomainProductTrustCertificationData | undefined;
  hasError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const actionLabel = hasError && !data ? "Retry assurance" : "Refresh assurance";

  return (
    <SectionBlock
      title="Data assurance"
      subtitle="Live certification, freshness, completeness and lineage evidence."
      actions={
        <SourceRefreshAction
          refreshScope="domain-product-assurance"
          idleLabel={actionLabel}
          busyLabel="Checking assurance"
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          priority="quiet"
        />
      }
    >
      <div className={styles.sourceStatus} role="status" aria-live="polite">
        {getTrustStatusMessage({ data, hasError, isLoading, isRefreshing })}
      </div>
      {isLoading && !data ? (
        <ScreenStatePanel
          kind="loading"
          title="Checking live assurance"
          body="Confirming current certification and data quality evidence."
          rows={2}
        />
      ) : hasError && !data ? (
        <ScreenStatePanel
          kind="partial"
          title="Live assurance is temporarily unavailable"
          body="The product catalogue remains usable. Certification, freshness, completeness and lineage have not been substituted."
          hint="Use Retry assurance to check the source again."
        />
      ) : data ? (
        <TrustEvidence data={data} hasRefreshFailure={hasError} />
      ) : null}
    </SectionBlock>
  );
}

function TrustEvidence({
  data,
  hasRefreshFailure,
}: {
  data: DomainProductTrustCertificationData;
  hasRefreshFailure: boolean;
}) {
  if (hasRefreshFailure) {
    return (
      <ScreenStatePanel
        kind="partial"
        title="The latest assurance refresh did not complete"
        body={
          data.trustAvailable
            ? "Previously confirmed assurance remains visible and is clearly retained as earlier evidence."
            : "The earlier source response reported assurance unavailable; no certified posture has been substituted."
        }
        hint={`Last confirmed ${formatDateTime(data.generatedAtUtc)}.`}
      />
    );
  }

  if (!data.trustAvailable) {
    return (
      <ScreenStatePanel
        kind="partial"
        title="Live assurance has not been confirmed"
        body={data.unavailableReason ?? "The source did not provide current certification evidence."}
        hint="The catalogue remains available, but assurance fields are shown as unavailable."
      />
    );
  }

  if (data.issues.length === 0) {
    return (
      <div className={styles.assuranceConfirmation}>
        <SemanticBadge tone={getTrustTone(data.trustPosture)} emphasis="strong">
          {formatStateLabel(data.trustPosture)}
        </SemanticBadge>
        <Text variant="secondary">
          {data.summary?.certifiedSnapshotCount ?? 0} products confirmed · Updated {formatDateTime(data.generatedAtUtc)}
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.issueList}>
      {data.issues.map((issue) => (
        <div key={`${issue.productId}:${issue.code}:${issue.detail}`} className={styles.issueRow}>
          <div>
            <Text variant="dataLabel">{formatStateLabel(issue.code)}</Text>
            <Text variant="secondary">{formatIdentifier(issue.productId)}</Text>
          </div>
          <Text variant="secondary">{issue.detail}</Text>
        </div>
      ))}
    </div>
  );
}

export function DependencyGraphSection({
  data,
  hasError,
  isLoading,
  isRefreshing,
  onRefresh,
}: {
  data: DomainProductGraphData | undefined;
  hasError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const actionLabel = hasError && !data ? "Retry impact evidence" : "Refresh impact evidence";

  return (
    <SectionBlock
      title="Dependency impact"
      subtitle="Understand downstream reliance and fail-closed relationships before changing a product."
      actions={
        <SourceRefreshAction
          refreshScope="domain-product-impact"
          idleLabel={actionLabel}
          busyLabel="Checking impact evidence"
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          priority="quiet"
        />
      }
    >
      <div className={styles.sourceStatus} role="status" aria-live="polite">
        {getDependencyStatusMessage({ data, hasError, isLoading, isRefreshing })}
      </div>
      {isLoading && !data ? (
        <ScreenStatePanel
          kind="loading"
          title="Checking dependency impact"
          body="Confirming downstream relationships and failure posture."
          rows={2}
        />
      ) : hasError && !data ? (
        <ScreenStatePanel
          kind="partial"
          title="Dependency impact is temporarily unavailable"
          body="The product catalogue remains usable. Downstream relationship totals have not been estimated or substituted."
          hint="Use Retry impact evidence to check the source again."
        />
      ) : data ? (
        <WorkbenchSummaryMetricStrip
          ariaLabel="Dependency impact summary"
          items={[
            {
              key: "nodes",
              label: "Products and consumers",
              value: data.nodeCount,
              support: hasError ? "Earlier confirmed evidence" : "Current source evidence",
            },
            {
              key: "edges",
              label: "Relationships",
              value: data.edgeCount,
              support: hasError ? "Earlier confirmed evidence" : "Current source evidence",
            },
            {
              key: "fail-closed",
              label: "Fail-closed relationships",
              value: data.edges.filter((edge) => edge.failurePosture === "fail_closed").length,
              support: hasError ? "Earlier confirmed evidence" : "Current source evidence",
            },
          ]}
        />
      ) : null}
    </SectionBlock>
  );
}

function getTrustStatusMessage({
  data,
  hasError,
  isLoading,
  isRefreshing,
}: {
  data: DomainProductTrustCertificationData | undefined;
  hasError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
}) {
  if (isRefreshing || (isLoading && !data)) return "Checking the latest assurance evidence.";
  if (hasError && data) return "The latest refresh failed. Earlier confirmed assurance remains visible.";
  if (hasError) return "Live assurance is unavailable. The catalogue remains available.";
  if (!data?.trustAvailable) return "The assurance source has not confirmed current evidence.";
  return `Live assurance confirmed ${formatDateTime(data.generatedAtUtc)}.`;
}

function getDependencyStatusMessage({
  data,
  hasError,
  isLoading,
  isRefreshing,
}: {
  data: DomainProductGraphData | undefined;
  hasError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
}) {
  if (isRefreshing || (isLoading && !data)) return "Checking the latest dependency evidence.";
  if (hasError && data) return "The latest refresh failed. Earlier confirmed dependency evidence remains visible.";
  if (hasError) return "Dependency impact is unavailable. The catalogue remains available.";
  return `Dependency impact confirmed ${formatDateTime(data?.generatedAtUtc)}.`;
}
