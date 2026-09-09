import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureActiveAuthorityContext,
  captureAuthorityRequestContext,
  reconcileResponseAuthorityContext,
  resetClientAuthorityContextForTests,
  StaleAuthorityResponseError,
  subscribeToAuthorityChanges,
} from "@/features/workbench/client-authority-context";

const FIRST_AUTHORITY = "a".repeat(64);
const SECOND_AUTHORITY = "b".repeat(64);
const CLEARED_AUTHORITY = "cleared";

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

    reconcileResponseAuthorityContext(
      response(FIRST_AUTHORITY),
      captureAuthorityRequestContext(),
    );

    expect(captureActiveAuthorityContext()).toBe(FIRST_AUTHORITY);
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies consumers exactly once when the admitted authority changes", () => {
    const listener = vi.fn();
    subscribeToAuthorityChanges(listener);
    reconcileResponseAuthorityContext(
      response(FIRST_AUTHORITY),
      captureAuthorityRequestContext(),
    );

    reconcileResponseAuthorityContext(
      response(SECOND_AUTHORITY),
      captureAuthorityRequestContext(),
    );
    reconcileResponseAuthorityContext(
      response(SECOND_AUTHORITY),
      captureAuthorityRequestContext(),
    );

    expect(captureActiveAuthorityContext()).toBe(SECOND_AUTHORITY);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fences a late response from the previous authority", () => {
    reconcileResponseAuthorityContext(
      response(FIRST_AUTHORITY),
      captureAuthorityRequestContext(),
    );
    const oldRequest = captureAuthorityRequestContext();
    reconcileResponseAuthorityContext(
      response(SECOND_AUTHORITY),
      captureAuthorityRequestContext(),
    );

    expect(() =>
      reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), oldRequest),
    ).toThrow(StaleAuthorityResponseError);
    expect(captureActiveAuthorityContext()).toBe(SECOND_AUTHORITY);
  });

  it("does not invent authority from absent or malformed response metadata", () => {
    reconcileResponseAuthorityContext(response(), captureAuthorityRequestContext());
    reconcileResponseAuthorityContext(
      response("browser-selected"),
      captureAuthorityRequestContext(),
    );

    expect(captureActiveAuthorityContext()).toBeNull();
  });

  it("fences an older initial response after a newer authority is established", () => {
    const olderRequest = captureAuthorityRequestContext();
    const newerRequest = captureAuthorityRequestContext();

    reconcileResponseAuthorityContext(response(SECOND_AUTHORITY), newerRequest);

    expect(() =>
      reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), olderRequest),
    ).toThrow(StaleAuthorityResponseError);
    expect(captureActiveAuthorityContext()).toBe(SECOND_AUTHORITY);
  });

  it("clears established authority and notifies consumers on authenticated denial", () => {
    const listener = vi.fn();
    subscribeToAuthorityChanges(listener);
    reconcileResponseAuthorityContext(
      response(FIRST_AUTHORITY),
      captureAuthorityRequestContext(),
    );

    reconcileResponseAuthorityContext(
      response(CLEARED_AUTHORITY),
      captureAuthorityRequestContext(),
    );

    expect(captureActiveAuthorityContext()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fences an older authority response after a newer denial clears authority", () => {
    const olderRequest = captureAuthorityRequestContext();
    const newerRequest = captureAuthorityRequestContext();
    reconcileResponseAuthorityContext(response(CLEARED_AUTHORITY), newerRequest);

    expect(() =>
      reconcileResponseAuthorityContext(response(FIRST_AUTHORITY), olderRequest),
    ).toThrow(StaleAuthorityResponseError);
    expect(captureActiveAuthorityContext()).toBeNull();
  });
});
