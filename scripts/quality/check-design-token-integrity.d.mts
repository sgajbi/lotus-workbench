export type DesignTokenIntegrityAnalysis = {
  sourceFileCount: number;
  definitionCount: number;
  referenceCount: number;
  undefinedReferences: Array<{ name: string; path: string }>;
  rawColorLiterals: { count: number; fileCount: number; digest: string };
  variableFallbacks: { count: number; digest: string; contextDigest: string };
};

export type DesignTokenIntegrityBaseline = {
  schemaVersion: number;
  sourceRoot: string;
  rawColorExemptPaths: string[];
  runtimeDefinedCustomProperties: string[];
  rawColorLiterals: DesignTokenIntegrityAnalysis["rawColorLiterals"];
  variableFallbacks: DesignTokenIntegrityAnalysis["variableFallbacks"];
};

export function analyzeDesignTokenIntegrity(options: {
  repoRoot: string;
  sourceRoot?: string;
  rawColorExemptPaths?: string[];
  runtimeDefinedCustomProperties?: string[];
}): DesignTokenIntegrityAnalysis;

export function createDesignTokenIntegrityBaseline(
  analysis: DesignTokenIntegrityAnalysis,
): DesignTokenIntegrityBaseline;

export function validateDesignTokenIntegrity(options: {
  analysis: DesignTokenIntegrityAnalysis;
  baseline: DesignTokenIntegrityBaseline;
}): string[];
