"use client";

import { useMemo, useState } from "react";
import { Alert, CircularProgress, Stack } from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ADVISORY_COPILOT_COPY } from "@/copy/advisory-copilot-copy";
import {
  ActionButton,
  AiAssistanceDisclosure,
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  Text,
} from "@/design-system";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";

import {
  createAdvisoryCopilotEvidencePacketFromProposalVersion,
  getAdvisoryCopilotSupportability,
  listProposals,
  reviewAdvisoryCopilotRun,
  runAdvisoryCopilotAction,
} from "../api";
import {
  buildAdvisoryCopilotWorkspaceModel,
  formatCode,
  type AdvisoryCopilotActionOption,
} from "../advisory-copilot-view-model";
import type {
  AdvisoryCopilotEvidencePacketData,
  AdvisoryCopilotReviewData,
  AdvisoryCopilotRunData,
} from "../types";
import styles from "./advisory-copilot-workspace.module.css";

const ADVISOR_ID = "advisor_sg_001";

export default function AdvisoryCopilotWorkspace({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const [latestPacket, setLatestPacket] = useState<
    AdvisoryCopilotEvidencePacketData | undefined
  >();
  const [latestRun, setLatestRun] = useState<
    AdvisoryCopilotRunData | AdvisoryCopilotReviewData | undefined
  >();
  const proposalQuery = useQuery({
    queryKey: ["advisory-copilot-proposals", portfolioId],
    queryFn: async () =>
      await listProposals({
        portfolioId,
        limit: 5,
      }),
    ...workbenchStrictQueryDefaults,
  });
  const supportabilityQuery = useQuery({
    queryKey: ["advisory-copilot-supportability"],
    queryFn: async () => await getAdvisoryCopilotSupportability(),
    ...workbenchStrictQueryDefaults,
  });
  const model = useMemo(
    () =>
      buildAdvisoryCopilotWorkspaceModel({
        proposals: proposalQuery.data?.items ?? [],
        supportability: supportabilityQuery.data,
        packet: latestPacket,
        run: latestRun,
      }),
    [proposalQuery.data, supportabilityQuery.data, latestPacket, latestRun],
  );
  const runMutation = useMutation({
    mutationFn: async (option: AdvisoryCopilotActionOption) => {
      const proposal = model.proposal;
      if (!proposal?.proposal_id || !proposal.current_version_no) {
        throw new Error("No proposal version is available for copilot review.");
      }
      const packet = await createAdvisoryCopilotEvidencePacketFromProposalVersion({
        proposal_id: proposal.proposal_id,
        proposal_version_no: proposal.current_version_no,
        action_family: option.family,
        audience: option.audience,
        created_by: ADVISOR_ID,
        reason: {
          business_reason: "Prepare advisor-use copilot review.",
        },
      });
      const evidencePacketId = packet.evidence_packet?.evidence_packet_id;
      const packetProposalId = packet.evidence_packet?.proposal_id;
      const packetPortfolioId = packet.evidence_packet?.portfolio_id;
      if (
        !evidencePacketId ||
        packetProposalId !== proposal.proposal_id ||
        packetPortfolioId !== portfolioId
      ) {
        throw new Error(
          "Copilot evidence packet did not match the selected proposal and portfolio.",
        );
      }
      const run = await runAdvisoryCopilotAction(
        {
          evidence_packet_id: evidencePacketId,
          audience: option.audience,
          requested_outputs: [option.outputKey],
          requested_by: ADVISOR_ID,
          requested_intents: [option.intent],
          user_instruction: "",
          reason: {
            business_reason: "Prepare advisor-use copilot review.",
          },
        },
        `ui-copilot-run-${option.family}-${proposal.proposal_id}-${proposal.current_version_no}-${evidencePacketId}`,
        {
          proposal_id: packetProposalId,
          portfolio_id: packetPortfolioId,
        },
      );
      return { packet, run };
    },
    onSuccess: ({ packet, run }) => {
      setLatestPacket(packet);
      setLatestRun(run);
    },
  });
  const reviewMutation = useMutation({
    mutationFn: async () => {
      const runId = latestRun?.run?.run_id;
      if (!runId) {
        throw new Error("No copilot run is available for review.");
      }
      const proposalId = latestPacket?.evidence_packet?.proposal_id;
      const packetPortfolioId = latestPacket?.evidence_packet?.portfolio_id;
      if (!proposalId || packetPortfolioId !== portfolioId) {
        throw new Error(
          "Copilot review scope did not match the selected portfolio.",
        );
      }
      return await reviewAdvisoryCopilotRun(
        runId,
        {
          action: "APPROVE_FOR_INTERNAL_USE",
          reason: {
            decision: "Reviewed against source evidence for internal advisor use.",
          },
        },
        `ui-copilot-review-${runId}`,
        { proposal_id: proposalId, portfolio_id: packetPortfolioId },
      );
    },
    onSuccess: (review) => {
      setLatestRun(review);
    },
  });
  const isLoading = proposalQuery.isLoading || supportabilityQuery.isLoading;
  const hasError = Boolean(proposalQuery.error || supportabilityQuery.error);
  const canRecordInternalReview =
    Boolean(latestRun?.run?.run_id) &&
    latestRun?.run?.review_posture === "REVIEW_REQUIRED";

  if (isLoading) {
    return (
      <SectionBlock>
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Text variant="body">{ADVISORY_COPILOT_COPY.loading}</Text>
        </Stack>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock
      title={ADVISORY_COPILOT_COPY.title}
      subtitle={ADVISORY_COPILOT_COPY.subtitle}
    >
      {hasError ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {ADVISORY_COPILOT_COPY.unavailable}
        </Alert>
      ) : null}
      <div className={styles.copilotHeader}>
        <section
          className={styles.decisionPanel}
          aria-labelledby="advisory-copilot-decision-title"
          data-testid="advisory-copilot-decision"
        >
          <div>
            <Text variant="microLabel">
              {ADVISORY_COPILOT_COPY.decisionLabel}
            </Text>
            <Text
              variant="subsectionTitle"
              as="h2"
              id="advisory-copilot-decision-title"
            >
              {ADVISORY_COPILOT_COPY.decisionTitle}
            </Text>
            <Text variant="secondary">
              {ADVISORY_COPILOT_COPY.decisionBody}
            </Text>
          </div>
          <SemanticBadge tone="warn">
            {ADVISORY_COPILOT_COPY.clientBoundary}
          </SemanticBadge>
        </section>
        <div
          className={styles.metricGrid}
          aria-label={ADVISORY_COPILOT_COPY.statusAriaLabel}
          data-testid="advisory-copilot-status"
        >
          {model.supportabilityRows.map((row) => (
            <div className={styles.metricTile} key={row.label}>
              <Text variant="microLabel">{row.label}</Text>
              <SemanticBadge tone={row.tone}>{row.value}</SemanticBadge>
            </div>
          ))}
        </div>
      </div>

      {!model.proposal ? (
        <ScreenStatePanel
          kind="empty"
          title={ADVISORY_COPILOT_COPY.noProposal.title}
          body={ADVISORY_COPILOT_COPY.noProposal.body}
          surface="default"
        />
      ) : (
        <AdvisoryCopilotActionGrid
          actions={model.availableActions}
          pendingFamily={
            runMutation.isPending ? runMutation.variables?.family : undefined
          }
          onRun={(option) => runMutation.mutate(option)}
        />
      )}

      {runMutation.error ? (
        <Alert severity="warning">
          {ADVISORY_COPILOT_COPY.actionFailure}
        </Alert>
      ) : null}

      <SectionBlock
        title={ADVISORY_COPILOT_COPY.evidenceTitle}
        subtitle={ADVISORY_COPILOT_COPY.evidenceSubtitle}
      >
        {model.packetSections.length > 0 ? (
          <div className={styles.evidenceGrid}>
            {model.packetSections.map((section) => (
              <div className={styles.evidenceItem} key={section.title}>
                <Text variant="microLabel">{section.title}</Text>
                <strong>Available</strong>
                <Text variant="secondary">{section.summary}</Text>
              </div>
            ))}
          </div>
        ) : (
          <ScreenStatePanel
            kind="empty"
            title={ADVISORY_COPILOT_COPY.evidenceEmpty.title}
            body={ADVISORY_COPILOT_COPY.evidenceEmpty.body}
            surface="default"
          />
        )}
        {model.unsupportedEvidence.length > 0 ? (
          <ul className={styles.unsupportedList} aria-label="Unsupported evidence">
            {model.unsupportedEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </SectionBlock>

      <SectionBlock
        title={ADVISORY_COPILOT_COPY.reviewTitle}
        subtitle={ADVISORY_COPILOT_COPY.reviewSubtitle}
      >
        <div
          className={styles.reviewPanel}
          data-testid="advisory-copilot-human-review"
          data-review-posture={latestRun?.run?.review_posture ?? "NOT_PREPARED"}
        >
          <div className={styles.reviewHeader}>
            <div>
              <Text variant="microLabel">
                {ADVISORY_COPILOT_COPY.reviewStatusLabel}
              </Text>
              <Text variant="subsectionTitle" as="h2">
                {model.runPosture}
              </Text>
              <Text variant="secondary">
                Client use: {model.clientReadyPosture}
              </Text>
            </div>
            <Stack direction="row" spacing={1}>
              <SemanticBadge tone={model.runTone}>{model.runPosture}</SemanticBadge>
              <ActionButton
                priority="secondary"
                disabled={!canRecordInternalReview || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate()}
              >
                {reviewMutation.isPending
                  ? "Recording..."
                  : "Record internal review"}
              </ActionButton>
            </Stack>
          </div>
          <AiAssistanceDisclosure disclosure={model.aiDisclosure} />
          {model.runSections.length > 0 ? (
            <div
              className={styles.sectionList}
              data-testid="advisory-copilot-output"
              data-output-section-count={model.runSections.length}
            >
              {model.runSections.map((section) => (
                <article key={section.title}>
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <Text variant="secondary">
              {ADVISORY_COPILOT_COPY.outputEmpty}
            </Text>
          )}
          {model.reviewGuidance.length > 0 ? (
            <ul className={styles.guardrailList} aria-label="Review guidance">
              {model.reviewGuidance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {model.guardrailResults.length > 0 ? (
            <ul className={styles.guardrailList} aria-label="Guardrail status">
              {model.guardrailResults.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {reviewMutation.error ? (
            <Alert severity="warning">
              {ADVISORY_COPILOT_COPY.reviewFailure}
            </Alert>
          ) : null}
        </div>
      </SectionBlock>
    </SectionBlock>
  );
}

function AdvisoryCopilotActionGrid({
  actions,
  pendingFamily,
  onRun,
}: {
  actions: AdvisoryCopilotActionOption[];
  pendingFamily?: string;
  onRun: (option: AdvisoryCopilotActionOption) => void;
}) {
  if (actions.length === 0) {
    return (
      <ScreenStatePanel
        kind="unavailable"
        title={ADVISORY_COPILOT_COPY.unavailableActions.title}
        body={ADVISORY_COPILOT_COPY.unavailableActions.body}
        surface="default"
      />
    );
  }

  return (
    <div className={styles.actionGrid} aria-label="Advisory copilot actions">
      {actions.map((option) => (
        <div className={styles.actionCard} key={option.family}>
          <Text variant="microLabel">{formatCode(option.family)}</Text>
          <strong>{option.label}</strong>
          <Text variant="secondary">{option.purpose}</Text>
          <ActionButton
            priority="secondary"
            disabled={Boolean(pendingFamily)}
            onClick={() => onRun(option)}
          >
            {pendingFamily === option.family ? "Preparing..." : "Prepare review"}
          </ActionButton>
        </div>
      ))}
    </div>
  );
}
