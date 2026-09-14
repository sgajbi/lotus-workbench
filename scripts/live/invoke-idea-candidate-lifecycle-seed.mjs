import { parseArgs } from "node:util";

const REQUIRED_OPTIONS = [
  "idea-base-url",
  "candidate-id",
  "observed-at-utc",
  "tenant-id",
  "book-id",
  "portfolio-id",
  "client-id",
];
const LIFECYCLE_STATUSES = [
  "enriched",
  "scored",
  "governance_checked",
  "ready_for_review",
];
const LIFECYCLE_RANK = new Map([
  ["generated", 0],
  ["enriched", 1],
  ["scored", 2],
  ["governance_checked", 3],
  ["ready_for_review", 4],
]);

function readOptions() {
  const { values } = parseArgs({
    options: {
      "idea-base-url": { type: "string" },
      "candidate-id": { type: "string" },
      "observed-at-utc": { type: "string" },
      "tenant-id": { type: "string" },
      "book-id": { type: "string" },
      "portfolio-id": { type: "string" },
      "client-id": { type: "string" },
      "correlation-id": {
        type: "string",
        default: "corr-canonical-idea-lifecycle-seed",
      },
    },
    strict: true,
  });

  for (const name of REQUIRED_OPTIONS) {
    if (!values[name]) {
      throw new Error(`Missing required --${name}`);
    }
  }
  return values;
}

async function readJson(url, options = {}) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Lotus Idea request failed with HTTP ${response.status}: ${responseText || "empty response"}`,
    );
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Lotus Idea returned a non-JSON lifecycle response.");
  }
}

async function seedCandidateLifecycle() {
  const values = readOptions();
  const candidateId = values["candidate-id"];
  const observedAtUtc = values["observed-at-utc"];
  const observedAt = new Date(observedAtUtc);
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error(`Invalid --observed-at-utc value '${observedAtUtc}'.`);
  }

  const ideaBaseUrl = values["idea-base-url"].replace(/\/$/, "");
  const candidateUrl = `${ideaBaseUrl}/api/v1/idea-candidates/${encodeURIComponent(candidateId)}`;
  const admittedAuthorityHeaders = {
    "X-Caller-Subject": "canonical-front-office-lifecycle-seed",
    "X-Caller-Roles": "advisor",
    "X-Caller-Tenant-Ids": values["tenant-id"],
    "X-Caller-Book-Ids": values["book-id"],
    "X-Caller-Portfolio-Ids": values["portfolio-id"],
    "X-Caller-Client-Ids": values["client-id"],
    "X-Correlation-Id": values["correlation-id"],
  };
  const detailHeaders = {
    ...admittedAuthorityHeaders,
    "X-Caller-Capabilities": "idea.candidate.detail.read",
  };

  async function getSourceLifecycleStatus() {
    const detail = await readJson(candidateUrl, { headers: detailHeaders });
    const sourceCandidateId = String(detail?.candidate?.candidateId ?? "");
    const sourceStatus = String(detail?.candidate?.lifecycleStatus ?? "");
    if (sourceCandidateId !== candidateId) {
      throw new Error(
        `Canonical Lotus Idea detail returned candidate '${sourceCandidateId}' instead of '${candidateId}'.`,
      );
    }
    if (!LIFECYCLE_RANK.has(sourceStatus)) {
      throw new Error(
        `Canonical Lotus Idea candidate is in non-seedable source state '${sourceStatus}'.`,
      );
    }
    return sourceStatus;
  }

  let currentStatus = await getSourceLifecycleStatus();
  for (const targetStatus of LIFECYCLE_STATUSES) {
    if (LIFECYCLE_RANK.get(currentStatus) > LIFECYCLE_RANK.get(targetStatus)) {
      continue;
    }
    if (currentStatus === targetStatus) {
      console.log(
        `Canonical Lotus Idea candidate already has source lifecycle '${currentStatus}'.`,
      );
      continue;
    }
    if (
      LIFECYCLE_RANK.get(currentStatus) !==
      LIFECYCLE_RANK.get(targetStatus) - 1
    ) {
      throw new Error(
        `Canonical Lotus Idea lifecycle cannot progress from '${currentStatus}' directly to '${targetStatus}'.`,
      );
    }

    const transitionIdentity = `canonical-idea-lifecycle:${candidateId}:${targetStatus}:${observedAtUtc}`;
    const response = await readJson(`${candidateUrl}/lifecycle-transitions`, {
      method: "POST",
      headers: {
        ...admittedAuthorityHeaders,
        "Content-Type": "application/json",
        "X-Caller-Capabilities": "idea.candidate.lifecycle.transition",
        "Idempotency-Key": transitionIdentity,
      },
      body: JSON.stringify({
        transitionId: transitionIdentity,
        targetLifecycleStatus: targetStatus,
        changedAtUtc: observedAt.toISOString(),
        reasonCodes: ["review_required"],
      }),
    });

    const decision = String(response?.persistence?.decision ?? "");
    const persistedCandidateId = String(
      response?.persistence?.candidateId ?? "",
    );
    if (!new Set(["accepted", "replayed"]).has(decision)) {
      throw new Error(
        `Canonical Lotus Idea lifecycle transition to '${targetStatus}' was not persisted. Decision: ${decision}`,
      );
    }
    if (persistedCandidateId !== candidateId) {
      throw new Error(
        `Canonical Lotus Idea lifecycle transition returned candidate '${persistedCandidateId}' instead of '${candidateId}'.`,
      );
    }
    currentStatus = await getSourceLifecycleStatus();
    if (currentStatus !== targetStatus) {
      throw new Error(
        `Canonical Lotus Idea detail returned state '${currentStatus}' instead of '${targetStatus}' after persistence.`,
      );
    }
    console.log(
      `Canonical Lotus Idea candidate reached source lifecycle '${targetStatus}' (${decision}).`,
    );
  }
}

try {
  await seedCandidateLifecycle();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
