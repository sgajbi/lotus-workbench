import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureActiveAuthorityContext,
  reconcileResponseAuthorityContext,
  resetClientAuthorityContextForTests,
  StaleAuthorityResponseError,
  subscribeToAuthorityChanges,
} from "@/features/workbench/client-authority-context";

const FIRST_AUTHORITY = "a".repeat(64);
const SECOND_AUTHORITY = "b".repeat(64);

function response(authority?: string) {
  return new Response("{}", {
    headers: authority ? { "X-Workbench-Authority-Context": authority } : {},
  });
}

describe("client authority context", () => {
  afterEach(() => resetClientAuthorityContextForTests());

  it("establishes the initial authority without invalidating empty state", () => {
    const listener = vi.fn();
    subscribeToAuthorityChanges(listener);

    reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), null);

    expect(captureActiveAuthorityContext()).toBe(FIRST_AUTHORITY);
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies consumers exactly once when the admitted authority changes", () => {
    const listener = vi.fn();
    subscribeToAuthorityChanges(listener);
    reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), null);

    reconcileResponseAuthorityContext(response(SECOND_AUTHORITY), FIRST_AUTHORITY);
    reconcileResponseAuthorityContext(response(SECOND_AUTHORITY), SECOND_AUTHORITY);

    expect(captureActiveAuthorityContext()).toBe(SECOND_AUTHORITY);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fences a late response from the previous authority", () => {
    reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), null);
    reconcileResponseAuthorityContext(response(SECOND_AUTHORITY), FIRST_AUTHORITY);

    expect(() =>
      reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), FIRST_AUTHORITY),
    ).toThrow(StaleAuthorityResponseError);
    expect(captureActiveAuthorityContext()).toBe(SECOND_AUTHORITY);
  });

  it("does not invent authority from absent or malformed response metadata", () => {
    reconcileResponseAuthorityContext(response(), null);
    reconcileResponseAuthorityContext(response("browser-selected"), null);

    expect(captureActiveAuthorityContext()).toBeNull();
  });
});
