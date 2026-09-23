export function buildPayloadScopedIdempotencyKey(
  prefix: string,
  payload: unknown,
): string;

export function buildRuntimeScopedIdempotencyKey(
  prefix: string,
  runtimeGeneration: unknown,
  payload: unknown,
): string;

export function readString(value: unknown): string | null;

export function extractGatewayEnvelopeData(payload: unknown): unknown;
