export interface WorkflowStepEntry {
  workflow: Record<string, unknown>;
  job: Record<string, unknown>;
  step: Record<string, unknown>;
  stepIndex: number;
}

export interface DockerInstruction {
  keyword: string;
  argument: string;
}

export interface DockerStage {
  base?: string;
  name?: string;
  instructions: DockerInstruction[];
}

export interface DockerModel {
  escapeCharacter: string;
  globalInstructions: DockerInstruction[];
  stages: DockerStage[];
}

export function parseWorkflow(source: string): unknown;
export function collectWorkflowStepEntries(workflow: unknown): WorkflowStepEntry[];
export function isUnconditionalWorkflowStep(entry: WorkflowStepEntry): boolean;
export function usesGovernedExecutingShell(entry: WorkflowStepEntry): boolean;
export function parseDockerfile(source: string): DockerModel;
export function declaresGovernedChromiumProject(source: string): boolean;
export function normalizeInstruction(value: string): string;
export function parseDockerExecArguments(value: string): string[] | undefined;
export function isRecord(value: unknown): value is Record<string, unknown>;
