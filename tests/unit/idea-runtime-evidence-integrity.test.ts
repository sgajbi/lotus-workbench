import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const helper = join(
  process.cwd(),
  "scripts",
  "live",
  "verify-idea-runtime-evidence-integrity.mjs",
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function digest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")}`;
}

function identityDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value.trim(), "utf8").digest("hex")}`;
}

function buildEvidence() {
  const candidateId = "idea_low_income_0123456789abcdef";
  const evaluatedAtUtc = "2026-09-24T01:00:02Z";
  const movementMaterial = {
    productId: "lotus-core:PortfolioCashMovementSummary:v1",
    responseGeneratedAtUtc: "2026-09-24T01:00:00Z",
  };
  const projectionMaterial = {
    productId: "lotus-core:PortfolioCashflowProjection:v1",
    responseGeneratedAtUtc: "2026-09-24T01:00:01Z",
  };
  const movementDigest = digest(movementMaterial);
  const projectionDigest = digest(projectionMaterial);
  const evaluationMaterial = {
    candidateIdHash: identityDigest(candidateId),
    family: "low_income",
    outcome: "candidate_created",
  };
  const requestMaterial = {
    evaluatedAtUtc,
  };
  const persistenceMaterial = {
    candidateFamily: "low_income",
    candidateId,
    decision: "accepted",
    sourceReceiptsDigest: digest({
      cashMovementReceiptDigest: movementDigest,
      cashflowProjectionReceiptDigest: projectionDigest,
    }),
  };
  return {
    execution: {
      evaluatedAtUtc,
      cashMovementReceipt: {
        ...movementMaterial,
        receiptDigest: movementDigest,
      },
      cashflowProjectionReceipt: {
        ...projectionMaterial,
        receiptDigest: projectionDigest,
      },
      evaluationReceipt: {
        ...evaluationMaterial,
        evaluationDigest: digest(evaluationMaterial),
      },
      requestReceipt: {
        ...requestMaterial,
        requestDigest: digest(requestMaterial),
      },
      persistenceReceipt: {
        ...persistenceMaterial,
        receiptDigest: digest(persistenceMaterial),
      },
    },
  };
}

function verify(payload: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "lotus-idea-integrity-"));
  temporaryDirectories.push(directory);
  const evidencePath = join(directory, "evidence.json");
  writeFileSync(evidencePath, JSON.stringify(payload), "utf8");
  return spawnSync(process.execPath, [helper, "--evidence", evidencePath], {
    encoding: "utf8",
  });
}

describe("Idea runtime evidence integrity verifier", () => {
  it("accepts receipt-bound candidate evidence", () => {
    const result = verify(buildEvidence());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '"contract":"idea-runtime-evidence-integrity"',
    );
  });

  it("rejects a candidate identity substituted after receipt generation", () => {
    const payload = buildEvidence();
    payload.execution.persistenceReceipt.candidateId =
      "idea_low_income_ffffffffffffffff";

    const result = verify(payload);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "Persistence candidateId does not match the evaluation candidateIdHash.",
    );
  });

  it("rejects a persistence receipt changed without a matching digest", () => {
    const payload = buildEvidence();
    payload.execution.persistenceReceipt.decision = "replayed";

    const result = verify(payload);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Persistence receipt digest is invalid.");
  });

  it("rejects an execution evaluation time not bound to its receipt", () => {
    const payload = buildEvidence();
    payload.execution.evaluatedAtUtc = "2026-09-24T01:00:03Z";

    const result = verify(payload);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "execution evaluatedAtUtc does not match request receipt evaluatedAtUtc.",
    );
  });

  it("rejects a Core receipt body changed without a matching digest", () => {
    const payload = buildEvidence();
    payload.execution.cashMovementReceipt.responseGeneratedAtUtc =
      "2026-09-24T01:00:02Z";

    const result = verify(payload);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Cash movement receipt digest is invalid.");
  });

  it.each([
    ["cashMovementReceipt", "cash movement responseGeneratedAtUtc"],
    ["cashflowProjectionReceipt", "cashflow projection responseGeneratedAtUtc"],
  ] as const)(
    "rejects digest-valid %s evidence without its source timestamp",
    (receiptField, expectedField) => {
      const payload = buildEvidence();
      const receipt = payload.execution[receiptField] as Record<string, unknown>;
      delete receipt.responseGeneratedAtUtc;
      delete receipt.receiptDigest;
      receipt.receiptDigest = digest(receipt);

      const result = verify(payload);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain(
        `${expectedField} must be a non-blank string.`,
      );
    },
  );
});
