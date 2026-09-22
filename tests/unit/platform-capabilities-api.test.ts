import { afterEach, describe, expect, it, vi } from "vitest";

import { fallbackNormalizedCapabilities, getPlatformCapabilities } from "../../src/features/platform-capabilities/api";

describe("platform capabilities api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls bff capabilities endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              consumerSystem: "UI",
              tenantId: "tenant-sg",
              contractVersion: "v1",
              sources: {},
              partialFailure: false,
              errors: [],
              normalized: {
                navigation: { command_center: true },
                workflowFlags: {},
                inputModesBySource: {},
                inputModesUnion: [],
                moduleHealth: {},
                policyVersionsBySource: {},
                lotusCorePolicyDiagnostics: {
                  available: true,
                  allowedSections: ["OVERVIEW"],
                  warnings: [],
                  policyProvenance: {
                    policyVersion: "lotus-core-default-v1",
                    policySource: "default",
                    matchedRuleId: "default",
                    strictMode: false,
                  },
                },
                shellBootstrap: {
                  contractVersion: "shell-bootstrap.v1",
                  supportability: { state: "ready", reasons: [] },
                  freshness: {
                    state: "current",
                    freshnessClass: "shell_navigation",
                    evaluatedAt: "2026-04-12T00:00:00Z",
                    maxAgeSeconds: 60,
                  },
                  evidence: {
                    state: "source_backed",
                    lineageSources: ["lotus_core"],
                    partialFailure: false,
                    sourceErrorServices: [],
                  },
                  versioning: {
                    shellContractVersion: "shell-bootstrap.v1",
                    capabilityContractVersion: "v1",
                    sourcePolicyVersions: {},
                  },
                  caching: {
                    cacheMode: "request_scoped_composition",
                    invalidationOwner: "upstream_service",
                    staleReadTolerance: "bounded_navigation_refresh",
                    revalidateOnNavigation: true,
                    ttlSeconds: 60,
                    correctnessCritical: false,
                  },
                  workspaces: [],
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await getPlatformCapabilities("UI");
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bff/api/v1/platform/capabilities?consumerSystem=UI",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("throws a useful error when bff returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("service unavailable", { status: 503 }))
    );

    await expect(getPlatformCapabilities("UI")).rejects.toThrow(
      "Platform capabilities fetch failed (503): service unavailable"
    );
  });

  it("returns isolated fallback defaults for client-side gating", () => {
    const a = fallbackNormalizedCapabilities();
    const b = fallbackNormalizedCapabilities();

    a.navigation.command_center = false;

    expect(b.navigation.command_center).toBe(true);
    expect(a.moduleHealth).toEqual({ lotus_core: "unknown", lotus_performance: "unknown", lotus_manage: "unknown" });
    expect(a.policyVersionsBySource).toEqual({
      lotus_core: "unknown",
      lotus_performance: "unknown",
      lotus_manage: "unknown",
    });
    expect(a.lotusCorePolicyDiagnostics.available).toBe(false);
    expect(a.shellBootstrap.contractVersion).toBe("shell-bootstrap.v1");
    expect(a.shellBootstrap.workspaces).toHaveLength(5);
    expect(a.shellBootstrap.workspaces.find((workspace) => workspace.id === "proposal")?.enabled).toBe(false);
  });
});
