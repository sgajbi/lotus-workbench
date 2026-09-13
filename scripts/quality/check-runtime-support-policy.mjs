import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { NEXT_PRODUCTION_DIRECTORY } from "../config/next-artifact-layout.mjs";
import {
  collectWorkflowStepEntries,
  declaresGovernedChromiumProject,
  isRecord,
  isUnconditionalWorkflowStep,
  normalizeInstruction,
  parseDockerExecArguments,
  parseDockerfile,
  parseWorkflow,
  usesGovernedExecutingShell,
} from "./runtime-support-source-evidence.mjs";

const POLICY_PATH = "docs/architecture/workbench-runtime-support-policy.v1.json";
const WORKFLOW_PATHS = [
  ".github/workflows/feature-lane.yml",
  ".github/workflows/pr-merge-gate.yml",
  ".github/workflows/main-releasability.yml",
];
const REQUIRED_NON_CLAIMS = [
  "cross-browser-bank-certification",
  "load-or-soak-certification",
  "horizontal-scale-certification",
  "production-identity-certification",
];
const NPM_INSTALL_COMMANDS = [
  "ci",
  "install",
  "add",
  "i",
  "in",
  "ins",
  "inst",
  "insta",
  "instal",
  "isnt",
  "isnta",
  "isntal",
  "isntall",
];
const NPM_INSTALL_COMMAND_PATTERN = new RegExp(
  `(?:^|[\\s;&|(\"'/])npm\\b(?=[^;&|\\r\\n]{0,200}\\s+(?:${NPM_INSTALL_COMMANDS.join(
    "|"
  )})(?=$|[\\s;&|\\x22\\x27\\x29\\x60]))`,
  "i"
);
const ALTERNATIVE_PACKAGE_MANAGER_COMMAND_PATTERN =
  /(?:^|[;&|('"`]\s*|\b(?:then|do)\s+)(?:(?:command|exec)\s+|env(?:\s+[A-Za-z_][A-Za-z0-9_]*=\S+)*\s+)*(?:(?:\/[A-Za-z0-9._@+-]+)*\/)?(?:npx|corepack|yarn|yarnpkg|pnpm|pnpx)(?=$|[\s;&|)'"`])/i;
const RUNNER_PACKAGE_MANAGER_REMOVAL = [
  "rm -rf",
  "/usr/local/lib/node_modules/npm",
  "/usr/local/lib/node_modules/corepack",
  "/usr/local/bin/npm",
  "/usr/local/bin/npx",
  "/usr/local/bin/corepack",
  "/usr/local/bin/yarn",
  "/usr/local/bin/yarnpkg",
  "/opt/yarn-v1.22.22",
].join(" ");
const RUNNER_OS_SECURITY_UPDATE =
  "apt-get update && apt-get install --no-install-recommends --only-upgrade --yes libpcre2-8-0=10.42-1+deb12u1 && rm -rf /var/lib/apt/lists/*";

export function validateRuntimeSupportPolicy({
  packageJson,
  packageLock,
  policy,
  dockerfile,
  makefile,
  playwrightConfig,
  livePlaywrightConfig,
  workflowSources,
  execution = {},
  today = new Date().toISOString().slice(0, 10),
}) {
  const failures = [];
  const nodePolicy = policy.developerRuntime?.node;
  const npmPolicy = policy.developerRuntime?.packageManager;

  expectEqual(failures, "contract", policy.contract, "workbench-runtime-support-policy.v1");
  expectEqual(failures, "governed issue", policy.governedByIssue, 612);
  expectEqual(failures, "packageManager", packageJson.packageManager, `npm@${npmPolicy?.declaredVersion}`);
  expectEqual(failures, "Node engines range", packageJson.engines?.node, nodePolicy?.supportedRange);
  expectEqual(failures, "npm engines range", packageJson.engines?.npm, npmPolicy?.supportedRange);
  expectEqual(failures, "lockfile Node engines range", packageLock.packages?.[""]?.engines?.node, nodePolicy?.supportedRange);
  expectEqual(failures, "lockfile npm engines range", packageLock.packages?.[""]?.engines?.npm, npmPolicy?.supportedRange);
  expectEqual(failures, "Node devEngines range", packageJson.devEngines?.runtime?.version, nodePolicy?.supportedRange);
  expectEqual(failures, "Node devEngines failure policy", packageJson.devEngines?.runtime?.onFail, "error");
  expectEqual(failures, "npm devEngines range", packageJson.devEngines?.packageManager?.version, npmPolicy?.supportedRange);
  expectEqual(failures, "npm devEngines failure policy", packageJson.devEngines?.packageManager?.onFail, "error");
  expectEqual(failures, "Next version", packageJson.dependencies?.next, policy.applicationStack?.next?.version);
  expectEqual(failures, "React version", packageJson.dependencies?.react, policy.applicationStack?.react?.version);
  expectEqual(failures, "TypeScript version", packageJson.devDependencies?.typescript, policy.applicationStack?.typescript?.version);
  expectEqual(failures, "Playwright version", packageJson.devDependencies?.["@playwright/test"], policy.validationTooling?.playwright?.version);
  expectEqual(
    failures,
    "workflow YAML parser version",
    packageJson.devDependencies?.yaml,
    policy.validationTooling?.workflowYamlParser?.version
  );
  expectEqual(
    failures,
    "lockfile workflow YAML parser version",
    packageLock.packages?.[""]?.devDependencies?.yaml,
    policy.validationTooling?.workflowYamlParser?.version
  );

  if (execution.enforceExact) {
    expectEqual(failures, "executing Node version", execution.nodeVersion, policy.productionContainer?.version);
    expectEqual(failures, "executing npm version", execution.npmVersion, npmPolicy?.declaredVersion);
  }

  if (!/(?:^|\r?\n)install:\r?\n\tnpm ci --no-audit --no-fund(?:\r?\n|$)/.test(makefile)) {
    failures.push("The canonical Make install target must use immutable npm ci without implicit audit traffic.");
  }

  const expectedImage = [
    `node:${policy.productionContainer?.version}`,
    policy.productionContainer?.distribution,
    `@${policy.productionContainer?.digest}`,
  ].join("-").replace("-@", "@");
  const dockerModel = parseDockerfile(dockerfile);
  if (dockerModel.escapeCharacter !== "\\") {
    failures.push(
      "Dockerfile must retain the default backslash escape character so governed logical-instruction parsing cannot be reinterpreted by a parser directive."
    );
  }
  const baseImageArguments = dockerModel.globalInstructions.filter(
    ({ keyword, argument }) =>
      keyword === "ARG" && argument.startsWith("NODE_BASE_IMAGE=")
  );
  const declaredImage =
    baseImageArguments.length === 1
      ? baseImageArguments[0].argument.slice("NODE_BASE_IMAGE=".length)
      : undefined;
  expectEqual(failures, "container base image", declaredImage, expectedImage);
  const deploymentIdArguments = dockerModel.globalInstructions.filter(
    ({ keyword, argument }) =>
      keyword === "ARG" && argument.startsWith("WORKBENCH_DEPLOYMENT_ID")
  );
  if (
    deploymentIdArguments.length !== 1 ||
    deploymentIdArguments[0].argument !== "WORKBENCH_DEPLOYMENT_ID"
  ) {
    failures.push(
      "Dockerfile must declare WORKBENCH_DEPLOYMENT_ID exactly once without a default so production image builds fail closed."
    );
  }

  const ciBaseStages = dockerModel.stages.filter(({ name }) => name === "ci-base");
  const governedBaseConsumers = dockerModel.stages.filter(
    ({ base }) => base === "${NODE_BASE_IMAGE}"
  );
  if (
    ciBaseStages.length !== 1 ||
    dockerModel.stages[0] !== ciBaseStages[0] ||
    governedBaseConsumers.length !== 1 ||
    governedBaseConsumers[0] !== ciBaseStages[0]
  ) {
    failures.push(
      "Dockerfile must declare ci-base as the first and only stage that consumes ${NODE_BASE_IMAGE}."
    );
  }
  const governedDockerStages = dockerModel.stages.filter(({ name }) =>
    ["ci-base", "deps", "builder", "runner"].includes(name)
  );
  const prohibitedExecutionModifiers = governedDockerStages.flatMap((stage) =>
    stage.instructions.filter(({ keyword }) => ["ONBUILD", "SHELL"].includes(keyword))
  );
  if (prohibitedExecutionModifiers.length > 0) {
    failures.push(
      "Governed Docker stages must not declare ONBUILD triggers or SHELL overrides because runtime proof depends on direct instructions under the image default shell."
    );
  }

  const dependencyStages = dockerModel.stages.filter(({ name }) => name === "deps");
  if (dependencyStages.length !== 1) {
    failures.push('Dockerfile must declare exactly one Docker stage named "deps".');
  } else {
    expectDockerStageBase(failures, dependencyStages[0], "deps", "ci-base");
    const dependencyInstallCommands = dockerModel.stages.flatMap((stage) =>
      stage.instructions
        .filter(
          ({ keyword, argument }) =>
            keyword === "RUN" && containsCompetingDependencyInstall(argument)
        )
        .map((instruction) => ({ instruction, stage }))
    );
    if (
      dependencyInstallCommands.length !== 1 ||
      dependencyInstallCommands[0].stage !== dependencyStages[0] ||
      normalizeInstruction(dependencyInstallCommands[0].instruction.argument) !==
        "npm ci --no-audit --no-fund"
    ) {
      failures.push(
        "Dockerfile must contain exactly one dependency install across all stages, owned by deps as: RUN npm ci --no-audit --no-fund."
      );
    }
  }

  const builderStages = dockerModel.stages.filter(({ name }) => name === "builder");
  if (builderStages.length !== 1) {
    failures.push('Dockerfile must declare exactly one Docker stage named "builder".');
  } else {
    expectDockerStageBase(failures, builderStages[0], "builder", "ci-base");
    const builderArgumentCount = builderStages[0].instructions.filter(
      ({ keyword, argument }) => keyword === "ARG" && argument === "WORKBENCH_DEPLOYMENT_ID"
    ).length;
    const builderEnvironmentCount = builderStages[0].instructions.filter(
      ({ keyword, argument }) =>
        keyword === "ENV" &&
        normalizeInstruction(argument) ===
          "WORKBENCH_DEPLOYMENT_ID=${WORKBENCH_DEPLOYMENT_ID}"
    ).length;
    const guardedBuildCount = builderStages[0].instructions.filter(
      ({ keyword, argument }) =>
        keyword === "RUN" &&
        normalizeInstruction(argument) ===
          'test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build'
    ).length;
    if (
      builderArgumentCount !== 1 ||
      builderEnvironmentCount !== 1 ||
      guardedBuildCount !== 1
    ) {
      failures.push(
        "The builder must require, bind, and validate WORKBENCH_DEPLOYMENT_ID before the production build."
      );
    }
    const dependencyCopies = builderStages[0].instructions.filter(
      ({ keyword, argument }) =>
        keyword === "COPY" &&
        normalizeInstruction(argument) === "--from=deps /app/node_modules ./node_modules"
    );
    const crossStageCopies = builderStages[0].instructions.filter(
      ({ keyword, argument }) => keyword === "COPY" && dockerCopySource(argument)
    );
    if (dependencyCopies.length !== 1 || crossStageCopies.length !== 1) {
      failures.push(
        "The named builder stage must consume the governed deps node_modules through its only cross-stage copy."
      );
    }
  }

  const runnerStages = dockerModel.stages.filter(({ name }) => name === "runner");
  if (runnerStages.length !== 1) {
    failures.push('Dockerfile must declare exactly one Docker stage named "runner".');
  } else {
    expectDockerStageBase(failures, runnerStages[0], "runner", "ci-base");
    const runnerArgumentCount = runnerStages[0].instructions.filter(
      ({ keyword, argument }) => keyword === "ARG" && argument === "WORKBENCH_DEPLOYMENT_ID"
    ).length;
    const runnerEnvironmentCount = runnerStages[0].instructions.filter(
      ({ keyword, argument }) =>
        keyword === "ENV" &&
        normalizeInstruction(argument) ===
          "WORKBENCH_DEPLOYMENT_ID=${WORKBENCH_DEPLOYMENT_ID}"
    ).length;
    if (runnerArgumentCount !== 1 || runnerEnvironmentCount !== 1) {
      failures.push(
        "The runner must retain the exact build deployment identity as its default runtime identity."
      );
    }
    if (dockerModel.stages.at(-1) !== runnerStages[0]) {
      failures.push(
        'The named runner stage must be the final Docker stage because protected builds publish the default final stage.'
      );
    }
    const standaloneCopies = runnerStages[0].instructions.filter(
      ({ keyword, argument }) =>
        keyword === "COPY" &&
        normalizeInstruction(argument) ===
          `--chown=node:node --from=builder /app/${NEXT_PRODUCTION_DIRECTORY}/standalone ./`
    );
    const runnerCrossStageCopies = runnerStages[0].instructions.filter(
      ({ keyword, argument }) => keyword === "COPY" && dockerCopySource(argument)
    );
    const expectedStaticCopies = runnerStages[0].instructions.filter(
      ({ keyword, argument }) =>
        keyword === "COPY" &&
        normalizeInstruction(argument) ===
          `--chown=node:node --from=builder /app/${NEXT_PRODUCTION_DIRECTORY}/static ./${NEXT_PRODUCTION_DIRECTORY}/static`
    );
    if (
      standaloneCopies.length !== 1 ||
      expectedStaticCopies.length !== 1 ||
      runnerCrossStageCopies.length !== 2 ||
      runnerCrossStageCopies.some(({ argument }) => dockerCopySource(argument) !== "builder")
    ) {
      failures.push(
        "The final runner stage must consume only the governed builder standalone and static outputs."
      );
    }
    const userInstructions = runnerStages[0].instructions.filter(
      ({ keyword }) => keyword === "USER"
    );
    const finalUser = userInstructions.at(-1)?.argument;
    const expectedUser = policy.productionContainer?.executionUser;
    if (
      typeof finalUser !== "string" ||
      !new RegExp(`^${escapeRegExp(expectedUser)}(?::[^\\s]+)?$`).test(finalUser)
    ) {
      failures.push(
        `The runner stage final effective user must execute as ${expectedUser}; received ${JSON.stringify(finalUser)}.`
      );
    }
    const runnerCommands = runnerStages[0].instructions.filter(({ keyword }) => keyword === "CMD");
    const runnerEntrypoints = runnerStages[0].instructions.filter(
      ({ keyword }) => keyword === "ENTRYPOINT"
    );
    const commandArguments = parseDockerExecArguments(runnerCommands[0]?.argument ?? "");
    if (
      runnerCommands.length !== 1 ||
      runnerEntrypoints.length !== 0 ||
      JSON.stringify(commandArguments) !== JSON.stringify(["node", "server.js"])
    ) {
      failures.push(
        'The final runner must launch only the standalone server through CMD ["node", "server.js"] with no ENTRYPOINT override.'
      );
    }
    const runnerCopies = runnerStages[0].instructions.filter(({ keyword }) => keyword === "COPY");
    const healthcheckCopies = runnerCopies.filter(
      ({ argument }) =>
        normalizeInstruction(argument) ===
        "--chown=node:node scripts/runtime/workbench-healthcheck.mjs ./healthcheck.mjs"
    );
    const healthchecks = runnerStages[0].instructions.filter(
      ({ keyword }) => keyword === "HEALTHCHECK"
    );
    if (
      runnerCopies.length !== 3 ||
      healthcheckCopies.length !== 1 ||
      healthchecks.length !== 1 ||
      normalizeInstruction(healthchecks[0]?.argument ?? "") !==
        '--interval=20s --timeout=5s --start-period=20s --retries=5 CMD ["node", "healthcheck.mjs"]'
    ) {
      failures.push(
        "The final runner must own exactly one dependency-free Node healthcheck copy and one governed healthcheck instruction without competing copies or overrides."
      );
    }
    const runnerRunInstructions = runnerStages[0].instructions.filter(
      ({ keyword }) => keyword === "RUN"
    );
    const normalizedRunnerRunInstructions = runnerRunInstructions.map(({ argument }) =>
      normalizeInstruction(argument)
    );
    if (
      normalizedRunnerRunInstructions.length !== 2 ||
      !normalizedRunnerRunInstructions.includes(RUNNER_OS_SECURITY_UPDATE) ||
      !normalizedRunnerRunInstructions.includes(RUNNER_PACKAGE_MANAGER_REMOVAL)
    ) {
      failures.push(
        "The final runner must retain only the exact pinned PCRE2 security update and npm, npx, Corepack, and Yarn toolchain removal RUN instructions."
      );
    }
  }

  for (const [path, source] of Object.entries({
    "playwright.config.ts": playwrightConfig,
    "playwright.live.config.ts": livePlaywrightConfig,
  })) {
    if (!declaresGovernedChromiumProject(source)) {
      failures.push(`${path} must declare the governed Chromium browser project explicitly.`);
    }
  }

  const parsedWorkflows = new Map();
  for (const [path, source] of Object.entries(workflowSources)) {
    let workflow;
    try {
      workflow = parseWorkflow(source);
      parsedWorkflows.set(path, workflow);
    } catch {
      failures.push(`${path} must be valid YAML before runtime support can be verified.`);
      continue;
    }
    const workflowSteps = collectWorkflowStepEntries(workflow);
    const setupNodeSteps = workflowSteps.filter(
      ({ step }) =>
        typeof step.uses === "string" &&
        step.uses.startsWith("actions/setup-node@")
    );
    if (
      setupNodeSteps.length === 0 ||
      setupNodeSteps.some(
        (entry) =>
          !isUnconditionalWorkflowStep(entry) ||
          !isRecord(entry.step.with) ||
          entry.step.with["node-version"] !== policy.productionContainer?.version
      )
    ) {
      failures.push(`${path} must use Node ${policy.productionContainer?.version} for every setup-node step.`);
    }
    const nodeRuntimeSteps = workflowSteps.filter(
      ({ step }) => typeof step.run === "string" && executesRepositoryNodeRuntime(step.run)
    );
    const nodeRuntimeJobs = [...new Set(nodeRuntimeSteps.map(({ job }) => job))];
    if (
      nodeRuntimeJobs.some((job) => {
        const jobSetupSteps = setupNodeSteps.filter((entry) => entry.job === job);
        const firstNodeRuntimeStep = nodeRuntimeSteps.find((entry) => entry.job === job);
        return (
          jobSetupSteps.length !== 1 ||
          !isUnconditionalWorkflowStep(jobSetupSteps[0]) ||
          !isRecord(jobSetupSteps[0].step.with) ||
          jobSetupSteps[0].step.with["node-version"] !== policy.productionContainer?.version ||
          jobSetupSteps[0].stepIndex >= firstNodeRuntimeStep.stepIndex
        );
      })
    ) {
      failures.push(
        `${path} must establish Node ${policy.productionContainer?.version} before repository Node commands in every Node-executing job.`
      );
    }
  }

  for (const path of [".github/workflows/pr-merge-gate.yml", ".github/workflows/main-releasability.yml"]) {
    const workflow = parsedWorkflows.get(path);
    if (!workflow) {
      continue;
    }
    const browserInstallSteps = collectWorkflowStepEntries(workflow).filter(
      ({ step }) =>
        typeof step.run === "string" &&
        /\bplaywright(?:\/cli\.js)?\b.*\binstall\b.*\bchromium\b/i.test(
          normalizeInstruction(step.run)
        )
    );
    const browserProofSteps = collectWorkflowStepEntries(workflow).filter(
      ({ step }) =>
        typeof step.run === "string" &&
        ["make test-e2e", "npm run test:e2e:fixtures"].includes(
          normalizeInstruction(step.run)
        )
    );
    const browserProofJobs = [...new Set(browserProofSteps.map(({ job }) => job))];
    const hasInvalidBrowserJob = browserProofJobs.some((job) => {
      const jobInstallSteps = browserInstallSteps.filter((entry) => entry.job === job);
      const jobProofSteps = browserProofSteps.filter((entry) => entry.job === job);
      return (
        jobInstallSteps.length !== 1 ||
        normalizeInstruction(jobInstallSteps[0]?.step.run ?? "") !==
          "node node_modules/playwright/cli.js install chromium" ||
        !isUnconditionalWorkflowStep(jobInstallSteps[0]) ||
        !usesGovernedExecutingShell(jobInstallSteps[0]) ||
        jobProofSteps.some(
          (entry) =>
            !isUnconditionalWorkflowStep(entry) ||
            !usesGovernedExecutingShell(entry) ||
            jobInstallSteps[0].stepIndex >= entry.stepIndex
        )
      );
    });
    const hasOrphanBrowserInstall = browserInstallSteps.some(
      ({ job }) => !browserProofJobs.includes(job)
    );
    if (browserProofJobs.length === 0 || hasInvalidBrowserJob || hasOrphanBrowserInstall) {
      failures.push(
        `${path} must install Chromium exactly once through the repository-locked CLI before browser proof runs in each same unconditional job under a governed executing shell.`
      );
    }
  }

  const reviewedOnIsValid = isIsoDate(policy.reviewedOn);
  const nextReviewByIsValid = isIsoDate(policy.nextReviewBy);
  if (!reviewedOnIsValid) {
    failures.push("Runtime support policy reviewedOn must be a real ISO YYYY-MM-DD date.");
  } else if (policy.reviewedOn > today) {
    failures.push(`Runtime support policy reviewedOn cannot be in the future (${policy.reviewedOn}).`);
  }
  if (!nextReviewByIsValid) {
    failures.push("Runtime support policy nextReviewBy must be a real ISO YYYY-MM-DD date.");
  } else if (policy.nextReviewBy < today) {
    failures.push(`Runtime support policy review expired on ${policy.nextReviewBy}.`);
  }
  if (reviewedOnIsValid && nextReviewByIsValid && policy.reviewedOn > policy.nextReviewBy) {
    failures.push("Runtime support policy reviewedOn must not be later than nextReviewBy.");
  }
  if (policy.browserPolicy?.certificationStatus !== "partial-chromium-proof-only") {
    failures.push("Browser certification must remain explicit until a wider governed matrix passes.");
  }
  if (policy.scalingPolicy?.certificationStatus !== "not-capacity-certified") {
    failures.push("Scaling certification must remain explicit until measured load and capacity proof passes.");
  }
  for (const nonClaim of REQUIRED_NON_CLAIMS) {
    if (!policy.explicitNonClaims?.includes(nonClaim)) {
      failures.push(`Runtime support policy must retain explicit non-claim ${nonClaim}.`);
    }
  }

  return failures;
}

export function collectRuntimeSupportPolicyFailures(root = process.cwd()) {
  const packageJson = readJson(root, "package.json");
  const packageLock = readJson(root, "package-lock.json");
  const policy = readJson(root, POLICY_PATH);
  const workflowSources = Object.fromEntries(
    WORKFLOW_PATHS.map((path) => [path, readFileSync(join(root, path), "utf8")])
  );
  return validateRuntimeSupportPolicy({
    packageJson,
    packageLock,
    policy,
    dockerfile: readFileSync(join(root, "Dockerfile"), "utf8"),
    makefile: readFileSync(join(root, "Makefile"), "utf8"),
    playwrightConfig: readFileSync(join(root, "playwright.config.ts"), "utf8"),
    livePlaywrightConfig: readFileSync(join(root, "playwright.live.config.ts"), "utf8"),
    workflowSources,
    execution: {
      enforceExact: process.env.CI === "true",
      nodeVersion: process.versions.node,
      npmVersion: process.env.npm_config_user_agent?.match(/npm\/(?<version>\d+\.\d+\.\d+)/)?.groups?.version,
    },
  });
}

function readJson(root, path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function expectEqual(failures, label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label} must be ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsCompetingDependencyInstall(value) {
  const execArguments = parseDockerExecArguments(value);
  if (execArguments) {
    if (
      isAlternativePackageManagerExecutable(execArguments[0]) ||
      (/^(?:node|\/.*\/node)$/i.test(execArguments[0]) &&
        isAlternativePackageManagerExecutable(execArguments[1]))
    ) {
      return true;
    }
    const npmIndex = execArguments.findIndex((argument) =>
      /(?:^|\/)npm(?:-cli\.js)?$/i.test(argument)
    );
    return (
      npmIndex >= 0 &&
      execArguments
        .slice(npmIndex + 1)
        .some((argument) => NPM_INSTALL_COMMANDS.includes(argument.toLowerCase()))
    );
  }
  const normalized = normalizeInstruction(value);
  return (
    NPM_INSTALL_COMMAND_PATTERN.test(normalized) ||
    ALTERNATIVE_PACKAGE_MANAGER_COMMAND_PATTERN.test(normalized)
  );
}

function isAlternativePackageManagerExecutable(value) {
  return (
    typeof value === "string" &&
    /(?:^|\/)(?:npx(?:-cli)?|corepack|yarn|yarnpkg|pnpm|pnpx)(?:\.(?:js|cjs|mjs))?$/i.test(
      value
    )
  );
}

function executesRepositoryNodeRuntime(value) {
  const command = normalizeInstruction(value);
  if (["make ci-local-docker", "make ci-local-docker-down"].includes(command)) {
    return false;
  }
  return /(?:^|[\s;&|()])(?:node|npm|npx|make)(?=$|[\s;&|()])/i.test(command);
}

function dockerCopySource(value) {
  const source = normalizeInstruction(value).match(
    /(?:^|\s)--from=(?<source>[^\s]+)/i
  )?.groups?.source;
  return source?.replace(/^["']|["']$/g, "").toLowerCase();
}

function expectDockerStageBase(failures, stage, name, expectedBase) {
  if (stage.base !== expectedBase) {
    failures.push(
      `The named ${name} stage must descend directly from ${expectedBase}; received ${JSON.stringify(stage.base)}.`
    );
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = collectRuntimeSupportPolicyFailures();
  if (failures.length > 0) {
    console.error(["Runtime support policy validation failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
    process.exitCode = 1;
  } else {
    const npmVersion = process.env.npm_config_user_agent?.match(/npm\/(?<version>\d+\.\d+\.\d+)/)?.groups?.version;
    console.log(`Runtime support policy validation passed (Node ${process.versions.node}, npm ${npmVersion ?? "unknown"}).`);
  }
}
