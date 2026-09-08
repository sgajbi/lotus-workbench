export interface DispatchCommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type DispatchCommandRunner = (
  command: string,
  arguments_: string[],
) => DispatchCommandResult;

export interface DispatchMainReleasabilityOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  run?: DispatchCommandRunner;
}

export function dispatchMainReleasability(
  options?: DispatchMainReleasabilityOptions,
): string[];
