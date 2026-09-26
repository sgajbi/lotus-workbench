export type KnipIssueEntry = {
  name: string;
};

export type KnipIssue = {
  file: string;
  files: KnipIssueEntry[];
  exports: KnipIssueEntry[];
  types: KnipIssueEntry[];
};

export type KnipReport = {
  issues: KnipIssue[];
};

export type UnusedCodeBaseline = {
  schemaVersion: string;
  tool: string;
  toolVersion: string;
  scope?: string;
  ignoredEntrypoints?: string[];
  findingCount: number;
  identityDigest: string;
};

export function normalizeKnipIssues(report: KnipReport): string[];

export function validateUnusedCodeBaseline(input: {
  report: KnipReport;
  baseline: UnusedCodeBaseline;
}): { count: number; identityDigest: string };

export function runKnipProductionInventory(repoRoot?: string): KnipReport;

export function checkUnusedCode(input?: {
  repoRoot?: string;
  baselinePath?: string;
}): { count: number; identityDigest: string };
