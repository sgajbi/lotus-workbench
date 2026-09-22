import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fallbackNormalizedCapabilities } from "../../src/features/platform-capabilities/api";
import { usePlatformCapabilities } from "../../src/features/platform-capabilities/use-platform-capabilities";

const getPlatformCapabilitiesMock = vi.fn();

vi.mock("../../src/features/platform-capabilities/api", async () => {
  const actual = await vi.importActual("../../src/features/platform-capabilities/api");
  return {
    ...(actual as object),
    getPlatformCapabilities: (...args: unknown[]) => getPlatformCapabilitiesMock(...args),
  };
});

describe("usePlatformCapabilities", () => {
  beforeEach(() => {
    getPlatformCapabilitiesMock.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    getPlatformCapabilitiesMock.mockReset();
    window.sessionStorage.clear();
  });

  it("loads normalized capabilities from the BFF and clears the loading state", async () => {
    const normalized = {
      ...fallbackNormalizedCapabilities(),
      navigation: {
        ...fallbackNormalizedCapabilities().navigation,
        portfolio_intake: false,
      },
      moduleHealth: {
        lotus_core: "healthy",
        lotus_performance: "degraded",
        lotus_manage: "healthy",
      },
    };

    getPlatformCapabilitiesMock.mockResolvedValue({
      normalized,
      partialFailure: true,
      errors: [{ service: "lotus_performance", status_code: 504, detail: "timeout" }],
    });

    const { result } = renderHook(() => usePlatformCapabilities());

    expect(result.current.loading).toBe(true);
    expect(result.current.normalized.navigation.portfolio_intake).toBe(true);
    expect(result.current.shellBootstrapSource).toBe("loading");

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getPlatformCapabilitiesMock).toHaveBeenCalledWith("UI");
    expect(result.current.normalized.navigation.portfolio_intake).toBe(false);
    expect(result.current.partialFailure).toBe(true);
    expect(result.current.shellBootstrapSource).toBe("contract");
    expect(result.current.errors).toEqual([
      { service: "lotus_performance", status_code: 504, detail: "timeout" },
    ]);
  });

  it("falls back to local capabilities when bootstrap fails", async () => {
    getPlatformCapabilitiesMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => usePlatformCapabilities());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.normalized).toEqual(fallbackNormalizedCapabilities());
    expect(result.current.partialFailure).toBe(true);
    expect(result.current.shellBootstrapSource).toBe("fallback");
    expect(result.current.errors).toEqual([
      {
        service: "bff",
        status_code: 0,
        detail: "capability_bootstrap_fallback",
      },
    ]);
  });

  it("retries a failed bootstrap on the next mount instead of caching the fallback", async () => {
    getPlatformCapabilitiesMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        normalized: fallbackNormalizedCapabilities(),
        partialFailure: false,
        errors: [],
      });

    const first = renderHook(() => usePlatformCapabilities());
    await waitFor(() => expect(first.result.current.shellBootstrapSource).toBe("fallback"));
    first.unmount();

    const second = renderHook(() => usePlatformCapabilities());
    await waitFor(() => expect(second.result.current.shellBootstrapSource).toBe("contract"));
    expect(getPlatformCapabilitiesMock).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem("lotus.platformCapabilities.snapshot.v1")).toBeNull();
  });

  it("discards a legacy persisted source snapshot before requesting admitted capabilities", async () => {
    window.sessionStorage.setItem(
      "lotus.platformCapabilities.snapshot.v1",
      JSON.stringify({
        cachedAtMs: Date.now(),
        snapshot: {
          normalized: fallbackNormalizedCapabilities(),
          partialFailure: false,
          errors: [],
          shellBootstrapSource: "contract",
        },
      }),
    );
    getPlatformCapabilitiesMock.mockResolvedValue({
      normalized: {
        ...fallbackNormalizedCapabilities(),
        navigation: { ...fallbackNormalizedCapabilities().navigation, portfolio_intake: false },
      },
      partialFailure: false,
      errors: [],
    });

    const result = renderHook(() => usePlatformCapabilities());
    await waitFor(() => expect(result.result.current.shellBootstrapSource).toBe("contract"));
    expect(getPlatformCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(result.result.current.normalized.navigation.portfolio_intake).toBe(false);
    expect(window.sessionStorage.getItem("lotus.platformCapabilities.snapshot.v1")).toBeNull();
  });

  it("does not share concurrent snapshots across potentially different callers", async () => {
    const pendingRequests: Array<(value: unknown) => void> = [];
    getPlatformCapabilitiesMock.mockImplementation(
      () => new Promise((resolve) => pendingRequests.push(resolve))
    );

    const first = renderHook(() => usePlatformCapabilities());
    const second = renderHook(() => usePlatformCapabilities());

    await waitFor(() => {
      expect(getPlatformCapabilitiesMock).toHaveBeenCalledTimes(2);
    });
    expect(first.result.current.loading).toBe(true);
    expect(second.result.current.loading).toBe(true);

    pendingRequests[0]({
      normalized: {
        ...fallbackNormalizedCapabilities(),
        navigation: { ...fallbackNormalizedCapabilities().navigation, portfolio_intake: true },
      },
      partialFailure: false,
      errors: [],
    });
    pendingRequests[1]({
      normalized: {
        ...fallbackNormalizedCapabilities(),
        navigation: { ...fallbackNormalizedCapabilities().navigation, portfolio_intake: false },
      },
      partialFailure: false,
      errors: [],
    });

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });
    expect(first.result.current.normalized.navigation.portfolio_intake).toBe(true);
    expect(second.result.current.normalized.navigation.portfolio_intake).toBe(false);
  });

  it("re-fetches after a successful mount instead of sharing stale caller scope", async () => {
    getPlatformCapabilitiesMock.mockResolvedValueOnce({
      normalized: fallbackNormalizedCapabilities(),
      partialFailure: false,
      errors: [],
    }).mockResolvedValueOnce({
      normalized: {
        ...fallbackNormalizedCapabilities(),
        navigation: { ...fallbackNormalizedCapabilities().navigation, portfolio_intake: false },
      },
      partialFailure: false,
      errors: [],
    });

    const first = renderHook(() => usePlatformCapabilities());

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(getPlatformCapabilitiesMock).toHaveBeenCalledTimes(1);
    });

    const second = renderHook(() => usePlatformCapabilities());

    expect(second.result.current.loading).toBe(true);
    expect(second.result.current.shellBootstrapSource).toBe("loading");
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });
    expect(getPlatformCapabilitiesMock).toHaveBeenCalledTimes(2);
    expect(second.result.current.normalized.navigation.portfolio_intake).toBe(false);
  });
});
