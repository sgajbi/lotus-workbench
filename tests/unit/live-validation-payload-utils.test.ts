import { describe, expect, it } from "vitest";

import { buildRuntimeScopedIdempotencyKey } from "../../scripts/live/validation/payload-utils.mjs";

describe("canonical live-validation idempotency", () => {
  const proposalPayload = {
    body: {
      portfolio_id: "PB_SG_GLOBAL_BAL_001",
      as_of: "2026-04-10",
    },
  };

  it("replays the same payload within one admitted runtime generation", () => {
    const first = buildRuntimeScopedIdempotencyKey(
      "wb-canonical-narrative",
      "idea-sha.runtime-run-001",
      proposalPayload,
    );
    const replay = buildRuntimeScopedIdempotencyKey(
      "wb-canonical-narrative",
      "idea-sha.runtime-run-001",
      proposalPayload,
    );

    expect(replay).toBe(first);
    expect(first.length).toBeLessThanOrEqual(64);
  });

  it("separates the same business payload across rebuilt runtimes", () => {
    const priorRuntime = buildRuntimeScopedIdempotencyKey(
      "wb-canonical-narrative",
      "idea-sha.runtime-run-001",
      proposalPayload,
    );
    const rebuiltRuntime = buildRuntimeScopedIdempotencyKey(
      "wb-canonical-narrative",
      "idea-sha.runtime-run-002",
      proposalPayload,
    );

    expect(rebuiltRuntime).not.toBe(priorRuntime);
  });

  it.each([null, undefined, "", "   "])(
    "fails closed when runtime generation is %p",
    (runtimeGeneration) => {
      expect(() =>
        buildRuntimeScopedIdempotencyKey(
          "wb-canonical-narrative",
          runtimeGeneration,
          proposalPayload,
        ),
      ).toThrow("admitted runtime generation");
    },
  );
});
