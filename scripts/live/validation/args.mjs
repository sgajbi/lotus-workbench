import path from "node:path";
import { lstatSync } from "node:fs";

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
  const validationProfile = args.get("validation-profile") ?? "client-demo";
  if (validationProfile !== "full" && validationProfile !== "client-demo") {
    throw new Error(
      `Unsupported canonical validation profile: ${validationProfile}`,
    );
  }
  const ideaCandidateLifecycle =
    args.get("idea-candidate-lifecycle") ?? "ready_for_review";
  if (
    ![
      "ready_for_review",
      "reviewed_by_advisor",
      "approved",
      "converted_to_proposal",
    ].includes(ideaCandidateLifecycle)
  ) {
    throw new Error(
      `Unsupported canonical Idea candidate lifecycle: ${ideaCandidateLifecycle}`,
    );
  }

  return {
    args,
    validationProfile,
    portfolioId: args.get("portfolio-id") ?? "PB_SG_GLOBAL_BAL_001",
    benchmarkCode: args.get("benchmark-code") ?? "BMK_PB_GLOBAL_BALANCED_60_40",
    workbenchBaseUrl: (
      args.get("workbench-base-url") ?? "http://workbench.dev.lotus"
    ).replace(/\/+$/, ""),
    gatewayBaseUrl: (
      args.get("gateway-base-url") ?? "http://gateway.dev.lotus"
    ).replace(/\/+$/, ""),
    ideaBaseUrl: (args.get("idea-base-url") ?? "http://127.0.0.1:8330").replace(
      /\/+$/,
      "",
    ),
    outputDir: path.resolve(
      cwd,
      args.get("output-dir") ??
        (validationProfile === "full"
          ? "output/playwright/live-canonical"
          : "output/playwright/diagnostic-client-demo"),
    ),
    timeoutMs: Number(args.get("timeout-ms") ?? "60000"),
    canonicalStartDate: args.get("start-date") ?? "2025-03-31",
    canonicalAsOfDate: args.get("as-of-date") ?? "2026-04-10",
    ideaCandidateId: args.get("idea-candidate-id") ?? null,
    ideaCandidateLifecycle,
    mainlineSourceProvenancePath: args.has("mainline-source-provenance")
      ? path.resolve(cwd, args.get("mainline-source-provenance"))
      : null,
  };
}

export function assertFullValidationOutputBoundary({
  validationProfile,
  outputDir,
}) {
  if (validationProfile !== "full") return;
  const leaf = path.basename(outputDir);
  if (!/^diagnostic-.+-pending-[a-f0-9]{32}$/.test(leaf)) {
    throw new Error(
      "Full browser validation may write only to the governed diagnostic staging directory; " +
        "canonical publication requires the post-browser capacity probe.",
    );
  }
  let stagingDirectory;
  try {
    stagingDirectory = lstatSync(outputDir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        "Full browser validation requires an orchestration-created staging directory.",
      );
    }
    throw error;
  }
  if (!stagingDirectory.isDirectory() || stagingDirectory.isSymbolicLink()) {
    throw new Error(
      "Full browser validation refuses linked or non-directory staging paths.",
    );
  }
}
