import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function assertIdeaRuntimeEvidenceIntegrity(payload) {
  const execution = requireObject(payload?.execution, "execution");
  const evaluation = requireObject(
    execution.evaluationReceipt,
    "execution.evaluationReceipt",
  );
  const request = requireObject(
    execution.requestReceipt,
    "execution.requestReceipt",
  );
  const persistence = requireObject(
    execution.persistenceReceipt,
    "execution.persistenceReceipt",
  );
  const movement = requireObject(
    execution.cashMovementReceipt,
    "execution.cashMovementReceipt",
  );
  const projection = requireObject(
    execution.cashflowProjectionReceipt,
    "execution.cashflowProjectionReceipt",
  );

  assertDigest(evaluation.evaluationDigest, "evaluationDigest");
  assertDigest(request.requestDigest, "requestDigest");
  assertDigest(persistence.receiptDigest, "persistence receiptDigest");
  assertDigest(evaluation.candidateIdHash, "candidateIdHash");
  assertDigest(movement.receiptDigest, "cash movement receiptDigest");
  assertDigest(projection.receiptDigest, "cashflow projection receiptDigest");
  assertUtcInstant(
    movement.responseGeneratedAtUtc,
    "cash movement responseGeneratedAtUtc",
  );
  assertUtcInstant(
    projection.responseGeneratedAtUtc,
    "cashflow projection responseGeneratedAtUtc",
  );

  const candidateId = requireNonBlankString(
    persistence.candidateId,
    "persistence candidateId",
  );
  if (identityHash(candidateId) !== evaluation.candidateIdHash) {
    throw new Error(
      "Persistence candidateId does not match the evaluation candidateIdHash.",
    );
  }
  if (
    digestWithout(evaluation, "evaluationDigest") !==
    evaluation.evaluationDigest
  ) {
    throw new Error("Evaluation receipt digest is invalid.");
  }
  if (digestWithout(request, "requestDigest") !== request.requestDigest) {
    throw new Error("Request receipt digest is invalid.");
  }
  assertSameInstant(
    execution.evaluatedAtUtc,
    request.evaluatedAtUtc,
    "execution evaluatedAtUtc",
    "request receipt evaluatedAtUtc",
  );
  if (digestWithout(movement, "receiptDigest") !== movement.receiptDigest) {
    throw new Error("Cash movement receipt digest is invalid.");
  }
  if (digestWithout(projection, "receiptDigest") !== projection.receiptDigest) {
    throw new Error("Cashflow projection receipt digest is invalid.");
  }
  if (
    digestWithout(persistence, "receiptDigest") !== persistence.receiptDigest
  ) {
    throw new Error("Persistence receipt digest is invalid.");
  }
  const expectedSourceReceiptsDigest = canonicalJsonSha256({
    cashMovementReceiptDigest: movement.receiptDigest,
    cashflowProjectionReceiptDigest: projection.receiptDigest,
  });
  if (persistence.sourceReceiptsDigest !== expectedSourceReceiptsDigest) {
    throw new Error(
      "Persistence receipt is not bound to the published Core source receipts.",
    );
  }

  return { candidateId, receiptDigest: persistence.receiptDigest };
}

export function identityHash(value) {
  return `sha256:${createHash("sha256").update(value.trim(), "utf8").digest("hex")}`;
}

export function canonicalJsonSha256(value) {
  return `sha256:${createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex")}`;
}

function digestWithout(receipt, digestField) {
  return canonicalJsonSha256(
    Object.fromEntries(
      Object.entries(receipt).filter(([key]) => key !== digestField),
    ),
  );
}

function canonicalJson(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Evidence receipts cannot contain non-finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value).replace(
      /[\u0080-\uffff]/g,
      (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${canonicalJson(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Evidence receipts must contain JSON values only.");
}

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value;
}

function requireNonBlankString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-blank string.`);
  }
  return value;
}

function assertDigest(value, field) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${field} must be a lowercase sha256 digest.`);
  }
}

function assertSameInstant(left, right, leftField, rightField) {
  const leftInstant = assertUtcInstant(left, leftField);
  const rightInstant = assertUtcInstant(right, rightField);
  if (leftInstant !== rightInstant) {
    throw new Error(`${leftField} does not match ${rightField}.`);
  }
}

function assertUtcInstant(value, field) {
  const timestamp = requireNonBlankString(value, field);
  const instant = Date.parse(timestamp);
  if (!timestamp.endsWith("Z") || !Number.isFinite(instant)) {
    throw new Error(`${field} must be a valid UTC timestamp.`);
  }
  return instant;
}

async function main(argv) {
  const evidenceFlag = argv.indexOf("--evidence");
  const evidencePath = evidenceFlag >= 0 ? argv[evidenceFlag + 1] : undefined;
  if (!evidencePath) {
    throw new Error(
      "Usage: node verify-idea-runtime-evidence-integrity.mjs --evidence <path>",
    );
  }
  const payload = JSON.parse(await readFile(evidencePath, "utf8"));
  const result = assertIdeaRuntimeEvidenceIntegrity(payload);
  process.stdout.write(
    `${JSON.stringify({ contract: "idea-runtime-evidence-integrity", ...result })}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  });
}
