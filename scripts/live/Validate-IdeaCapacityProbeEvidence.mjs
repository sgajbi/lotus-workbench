import { parseArgs } from "node:util";

import { validateAndWriteIdeaCapacityProbeEvidence } from "./validation/idea-capacity-probe-evidence.mjs";

const { values } = parseArgs({
  options: {
    resource: { type: "string" },
    workload: { type: "string" },
    output: { type: "string" },
    "commit-sha": { type: "string" },
    branch: { type: "string" },
    "run-id": { type: "string" },
    "candidate-id": { type: "string" },
  },
});

for (const name of [
  "resource",
  "workload",
  "output",
  "commit-sha",
  "branch",
  "run-id",
  "candidate-id",
]) {
  if (!values[name]) {
    throw new Error(`Missing required --${name}`);
  }
}

await validateAndWriteIdeaCapacityProbeEvidence({
  resourcePath: values.resource,
  workloadPath: values.workload,
  evidencePath: values.output,
  commitSha: values["commit-sha"],
  branch: values.branch,
  runId: values["run-id"],
  candidateId: values["candidate-id"],
});

console.log("Idea capacity probe evidence validated");
