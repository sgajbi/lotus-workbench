import { describe, expect, it } from "vitest";

import {
  hidden,
  isPartialCapability,
  isRenderableCapability,
  isSupportedCapability,
  partial,
  supported,
  unavailable,
} from "../../src/shell/workspace-capabilities";

describe("workspace capability state boundaries", () => {
  it.each([
    { capability: supported("Source admitted"), renderable: true, supported: true, partial: false },
    { capability: partial("One source missing"), renderable: true, supported: false, partial: true },
    { capability: unavailable("Source refused"), renderable: true, supported: false, partial: false },
    { capability: hidden("Outside product scope"), renderable: false, supported: false, partial: false },
  ])("classifies $capability.state without granting support to a visible failure", (entry) => {
    expect(isRenderableCapability(entry.capability)).toBe(entry.renderable);
    expect(isSupportedCapability(entry.capability)).toBe(entry.supported);
    expect(isPartialCapability(entry.capability)).toBe(entry.partial);
  });

  it("retains supplied reasons without synthesizing fallback authority", () => {
    expect(partial("One source missing")).toEqual({ state: "partial", reason: "One source missing" });
    expect(unavailable("Source refused")).toEqual({ state: "unavailable", reason: "Source refused" });
    expect(hidden()).toEqual({ state: "hidden", reason: undefined });
    expect(supported()).toEqual({ state: "supported", reason: undefined });
  });
});
