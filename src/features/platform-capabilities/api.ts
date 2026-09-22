import {
  DEFAULT_NAVIGATION_FLAGS,
  PlatformCapabilitiesEnvelope,
  PlatformShellWorkspaceDescriptor,
  PlatformNormalizedCapabilities,
} from "./types";
import { createGatewayRequestSignal } from "@/features/platform-runtime/gateway-request-policy";

const BFF_PROXY_BASE = "/api/bff/api/v1";

export async function getPlatformCapabilities(
  consumerSystem = "UI",
): Promise<PlatformCapabilitiesEnvelope["data"]> {
  // Tenant admission belongs to the BFF caller context, never the browser query.
  const params = new URLSearchParams({ consumerSystem });
  const response = await fetch(`${BFF_PROXY_BASE}/platform/capabilities?${params.toString()}`, {
    cache: "no-store",
    signal: createGatewayRequestSignal(),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Platform capabilities fetch failed (${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as PlatformCapabilitiesEnvelope;
  return payload.data;
}

export function fallbackNormalizedCapabilities(): PlatformNormalizedCapabilities {
  const navigation = { ...DEFAULT_NAVIGATION_FLAGS };
  return {
    navigation,
    workflowFlags: {},
    inputModesBySource: {},
    inputModesUnion: [],
    moduleHealth: {
      lotus_core: "unknown",
      lotus_performance: "unknown",
      lotus_manage: "unknown",
    },
    policyVersionsBySource: {
      lotus_core: "unknown",
      lotus_performance: "unknown",
      lotus_manage: "unknown",
    },
    lotusCorePolicyDiagnostics: {
      available: false,
      allowedSections: [],
      warnings: [],
      policyProvenance: {
        policyVersion: "unknown",
        policySource: "unknown",
        matchedRuleId: "unknown",
        strictMode: false,
      },
    },
    shellBootstrap: {
      contractVersion: "shell-bootstrap.v1",
      supportability: {
        state: "fallback",
        reasons: ["client_fallback_navigation"],
      },
      freshness: {
        state: "fallback",
        freshnessClass: "shell_navigation",
        evaluatedAt: new Date(0).toISOString(),
        maxAgeSeconds: null,
      },
      evidence: {
        state: "fallback",
        lineageSources: [],
        partialFailure: true,
        sourceErrorServices: ["bff"],
      },
      versioning: {
        shellContractVersion: "shell-bootstrap.v1",
        capabilityContractVersion: "unknown",
        sourcePolicyVersions: {},
      },
      caching: {
        cacheMode: "client_fallback",
        invalidationOwner: "client",
        staleReadTolerance: "unknown",
        revalidateOnNavigation: true,
        ttlSeconds: null,
        correctnessCritical: false,
      },
      workspaces: buildFallbackShellWorkspaces(navigation),
    },
  };
}

function buildFallbackShellWorkspaces(
  navigation: Record<string, boolean>
): PlatformShellWorkspaceDescriptor[] {
  return [
    buildFallbackWorkspace("portfolio", "Portfolio", "/portfolio", navigation.portfolio_workspace),
    buildFallbackWorkspace(
      "performance",
      "Performance",
      "/performance",
      navigation.performance_workspace
    ),
    buildFallbackWorkspace("risk", "Risk", "/performance?mode=risk", navigation.risk_workspace),
    buildFallbackWorkspace("proposal", "Proposal", "/proposals", navigation.proposal_workspace),
    buildFallbackWorkspace(
      "advisory",
      "Advisory",
      "/recommendations",
      navigation.advisory_workspace
    ),
  ];
}

function buildFallbackWorkspace(
  id: string,
  label: string,
  href: string,
  enabled: boolean
): PlatformShellWorkspaceDescriptor {
  const state = enabled ? "ready" : "unavailable";
  return {
    id,
    label,
    href,
    enabled,
    supportability: {
      state,
      reasons: enabled ? [] : [`${id}_disabled_in_fallback`],
    },
    freshness: {
      state: "fallback",
      freshnessClass: "shell_navigation",
      evaluatedAt: new Date(0).toISOString(),
      maxAgeSeconds: null,
    },
    evidence: {
      state: enabled ? "fallback" : "unavailable",
      lineageSources: [],
      partialFailure: true,
      sourceErrorServices: ["bff"],
    },
    versioning: {
      shellContractVersion: "shell-bootstrap.v1",
      capabilityContractVersion: "unknown",
      sourcePolicyVersion: null,
      sourcePolicyVersions: {},
    },
    caching: {
      cacheMode: "client_fallback",
      invalidationOwner: "client",
      staleReadTolerance: "unknown",
      revalidateOnNavigation: true,
      ttlSeconds: null,
      correctnessCritical: id === "proposal" || id === "advisory",
    },
  };
}
