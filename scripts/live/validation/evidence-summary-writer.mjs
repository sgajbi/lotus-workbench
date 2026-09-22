import fs from "node:fs/promises";
import path from "node:path";

export function createValidationSummary({
  generatedAt = new Date().toISOString(),
  portfolioId,
  benchmarkCode,
  canonicalContract,
  panelRegistry,
  workbenchBaseUrl,
  gatewayBaseUrl,
  validationProfile = "full",
}) {
  return {
    generatedAt,
    portfolioId,
    benchmarkCode,
    canonicalContract,
    panelRegistry: {
      contractId: panelRegistry.contractId,
      contractVersion: panelRegistry.contractVersion,
      governedByRfc: panelRegistry.governedByRfc,
      canonicalDataContract: panelRegistry.canonicalDataContract,
      sourcePath: panelRegistry.sourcePath,
    },
    workbenchBaseUrl,
    gatewayBaseUrl,
    validationProfile,
    excludedProofs: validationProfile === "client-demo" ? [{
      proofScope: "idea.synthetic_downstream_capacity_workload",
      reasonCode: "NON_CERTIFYING_CAPACITY_PROBE_EXCLUDED",
      owningIssue: "sgajbi/lotus-idea#1345",
      claimBoundary: "No Idea downstream-capacity acceptance or full-profile certification",
    }] : [],
    dns: [],
    apiChecks: [],
    advisorBookChecks: [],
    workflowPackChecks: [],
    uiChecks: [],
    calculationChecks: [],
    panelClassifications: [],
    rfc3643FeatureCoverage: null,
    supportabilityMatrix: null,
    supportabilityChecks: [],
    screenshots: [],
    ideaCapacitySeed: null,
    mainlineSourceProvenance: null,
  };
}

export async function ensureDirectory(target) {
  await fs.mkdir(target, { recursive: true });
}

export function buildSummaryPaths(outputDir) {
  return {
    summaryPath: path.join(outputDir, "live-validation-summary.json"),
    shotIndexPath: path.join(outputDir, "SHOT-INDEX.md"),
  };
}

export async function writeValidationSummary(summaryPath, summary) {
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

export async function writeShotIndex(shotIndexPath, summary, validationSummaryPath) {
  const lines = [
    "# Lotus Canonical Front-Office Screenshots",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Contract: ${summary.canonicalContract.contractId} ${summary.canonicalContract.contractVersion}`,
    `- Governed by: ${summary.canonicalContract.governedByRfc}`,
    `- Portfolio: ${summary.portfolioId}`,
    `- Benchmark: ${summary.benchmarkCode}`,
    `- Validation profile: ${summary.validationProfile ?? "full"}`,
    ...(summary.excludedProofs ?? []).map(
      (proof) => `- Excluded proof: ${proof.proofScope} (${proof.reasonCode}; ${proof.claimBoundary})`,
    ),
    `- As of: ${summary.screenshots[0]?.asOfDate ?? summary.canonicalContract.canonicalAsOfDate ?? "unknown"}`,
    `- Validation summary: ${validationSummaryPath}`,
    "",
    "## Captures",
    "",
  ];

  for (const screenshotEvidence of summary.screenshots) {
    lines.push(
      `- ${screenshotEvidence.name} - ${screenshotEvidence.panel} - ${screenshotEvidence.route} - ${screenshotEvidence.state}`
    );
  }

  await fs.writeFile(shotIndexPath, `${lines.join("\n")}\n`, "utf8");
}
