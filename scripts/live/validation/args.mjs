import path from "node:path";

export function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

export function resolveValidationConfig(argv, cwd = process.cwd()) {
  const args = parseArgs(argv);
  const validationProfile = args.get("validation-profile") ?? "full";
  if (validationProfile !== "full" && validationProfile !== "client-demo") {
    throw new Error(`Unsupported canonical validation profile: ${validationProfile}`);
  }

  return {
    args,
    validationProfile,
    portfolioId: args.get("portfolio-id") ?? "PB_SG_GLOBAL_BAL_001",
    benchmarkCode: args.get("benchmark-code") ?? "BMK_PB_GLOBAL_BALANCED_60_40",
    workbenchBaseUrl: (args.get("workbench-base-url") ?? "http://workbench.dev.lotus").replace(
      /\/+$/,
      ""
    ),
    gatewayBaseUrl: (args.get("gateway-base-url") ?? "http://gateway.dev.lotus").replace(/\/+$/, ""),
    ideaBaseUrl: (args.get("idea-base-url") ?? "http://127.0.0.1:8330").replace(/\/+$/, ""),
    outputDir: path.resolve(cwd, args.get("output-dir") ?? "output/playwright/live-canonical"),
    timeoutMs: Number(args.get("timeout-ms") ?? "60000"),
    canonicalStartDate: args.get("start-date") ?? "2025-03-31",
    canonicalAsOfDate: args.get("as-of-date") ?? "2026-04-10",
    ideaCandidateId: args.get("idea-candidate-id") ?? null,
    ideaCapacitySeedEvidencePath: path.resolve(
      cwd,
      args.get("idea-capacity-seed-evidence") ??
        "output/canonical-front-office/idea-capacity-seed-evidence.json"
    ),
    mainlineSourceProvenancePath: args.has("mainline-source-provenance")
      ? path.resolve(cwd, args.get("mainline-source-provenance"))
      : null,
  };
}
