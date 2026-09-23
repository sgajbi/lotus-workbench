import { createHash } from "node:crypto";

export function buildPayloadScopedIdempotencyKey(prefix, payload) {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${digest}`.slice(0, 64);
}

export function buildRuntimeScopedIdempotencyKey(
  prefix,
  runtimeGeneration,
  payload,
) {
  const normalizedRuntimeGeneration = readString(runtimeGeneration);
  if (normalizedRuntimeGeneration === null) {
    throw new Error(
      "Canonical idempotency requires an admitted runtime generation.",
    );
  }
  return buildPayloadScopedIdempotencyKey(prefix, {
    runtimeGeneration: normalizedRuntimeGeneration,
    payload,
  });
}

export function readString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function extractGatewayEnvelopeData(payload) {
  if (payload?.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
}
