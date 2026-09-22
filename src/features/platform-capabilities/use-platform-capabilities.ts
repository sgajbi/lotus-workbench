"use client";

import { useEffect, useState } from "react";

import { fallbackNormalizedCapabilities, getPlatformCapabilities } from "./api";
import { PlatformCapabilitiesError, PlatformNormalizedCapabilities } from "./types";

type UsePlatformCapabilitiesResult = {
  loading: boolean;
  normalized: PlatformNormalizedCapabilities;
  partialFailure: boolean;
  errors: PlatformCapabilitiesError[];
  shellBootstrapSource: "loading" | "contract" | "fallback";
};

type PlatformCapabilitiesSnapshot = Omit<UsePlatformCapabilitiesResult, "loading">;

async function loadPlatformCapabilitiesSnapshot(): Promise<PlatformCapabilitiesSnapshot> {
  try {
    const data = await getPlatformCapabilities("UI");
    return {
      normalized: data.normalized ?? fallbackNormalizedCapabilities(),
      partialFailure: Boolean(data.partialFailure),
      errors: data.errors ?? [],
      shellBootstrapSource: data.normalized?.shellBootstrap?.workspaces?.length
        ? "contract"
        : "fallback",
    };
  } catch {
    return {
      normalized: fallbackNormalizedCapabilities(),
      partialFailure: true,
      errors: [{ service: "bff", status_code: 0, detail: "capability_bootstrap_fallback" }],
      shellBootstrapSource: "fallback",
    };
  }
}

function getInitialResult(): UsePlatformCapabilitiesResult {
  return {
    loading: true,
    normalized: fallbackNormalizedCapabilities(),
    partialFailure: false,
    errors: [],
    shellBootstrapSource: "loading",
  };
}

export function usePlatformCapabilities(): UsePlatformCapabilitiesResult {
  const [state, setState] = useState<UsePlatformCapabilitiesResult>(
    getInitialResult,
  );

  useEffect(() => {
    let active = true;

    // Retire the former unpartitioned session cache; caller scope cannot be inferred in a browser.
    try {
      window.sessionStorage.removeItem("lotus.platformCapabilities.snapshot.v1");
    } catch {
      // A blocked storage API must not prevent the source-backed request.
    }

    void loadPlatformCapabilitiesSnapshot().then((snapshot) => {
      if (!active) {
        return;
      }
      setState({
        loading: false,
        ...snapshot,
      });
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
