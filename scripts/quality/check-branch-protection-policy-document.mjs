import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultPolicyPath = path.join(
  repositoryRoot,
  "quality",
  "branch_protection_policy.v1.json",
);

const booleanExpectedFields = [
  "enforce_admins",
  "required_linear_history",
  "allow_force_pushes",
  "allow_deletions",
  "required_conversation_resolution",
  "restrictions_present",
  "codeowners_present",
  "lock_branch",
  "required_signatures",
  "block_creations",
  "allow_fork_syncing",
];

const exceptionFields = [
  "field",
  "value",
  "reason",
  "compensating_controls",
  "retires_when",
];

const weakPostures = new Map([
  ["enforce_admins", false],
  ["required_linear_history", false],
  ["allow_force_pushes", true],
  ["allow_deletions", true],
  ["required_conversation_resolution", false],
  ["required_status_checks.strict", false],
  ["required_pull_request_reviews.present", false],
  ["required_pull_request_reviews.dismiss_stale_reviews", false],
  ["required_pull_request_reviews.required_approving_review_count", 0],
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveField(root, dottedField) {
  let current = root;
  for (const segment of dottedField.split(".")) {
    if (!isObject(current) || !(segment in current)) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

export function validateBranchProtectionPolicy(policy) {
  const issues = [];
  if (!isObject(policy)) {
    return ["policy must be a JSON object"];
  }
  if (policy.contract_id !== "lotus-branch-protection-policy") {
    issues.push("contract_id must be lotus-branch-protection-policy");
  }
  if (policy.repository !== "sgajbi/lotus-workbench") {
    issues.push("repository must identify sgajbi/lotus-workbench");
  }
  if (policy.protected_branch !== "main") {
    issues.push("protected_branch must be main");
  }

  const expected = policy.expected;
  if (!isObject(expected)) {
    issues.push("expected must be an object");
    return issues;
  }
  for (const field of booleanExpectedFields) {
    if (typeof expected[field] !== "boolean") {
      issues.push(`expected.${field} must be a boolean`);
    }
  }

  const statusChecks = expected.required_status_checks;
  if (!isObject(statusChecks) || typeof statusChecks.strict !== "boolean") {
    issues.push("expected.required_status_checks.strict must be a boolean");
  }
  const checks = isObject(statusChecks) ? statusChecks.checks : undefined;
  if (!Array.isArray(checks) || checks.length === 0) {
    issues.push("expected.required_status_checks.checks must be a non-empty list");
  } else {
    const contexts = new Set();
    for (const [index, check] of checks.entries()) {
      if (!isObject(check) || typeof check.context !== "string" || !check.context.trim()) {
        issues.push(`required check ${index} must name a non-empty context`);
        continue;
      }
      if (contexts.has(check.context)) {
        issues.push(`required check context is duplicated: ${check.context}`);
      }
      contexts.add(check.context);
      if (check.app_id === undefined || (check.app_id !== null && !Number.isInteger(check.app_id))) {
        issues.push(`required check ${check.context} must declare an integer or null app_id`);
      }
    }
  }

  const requiredDeployments = expected.required_deployments;
  if (!isObject(requiredDeployments)) {
    issues.push("expected.required_deployments must be an object");
  } else {
    if (typeof requiredDeployments.present !== "boolean") {
      issues.push("expected.required_deployments.present must be a boolean");
    }
    if (!Array.isArray(requiredDeployments.environments)) {
      issues.push("expected.required_deployments.environments must be a list");
    } else {
      const environments = requiredDeployments.environments;
      const validNames = environments.every(
        (environment) => typeof environment === "string" && environment.trim(),
      );
      if (!validNames) {
        issues.push("required deployment environments must be non-empty strings");
      }
      if (new Set(environments).size !== environments.length) {
        issues.push("required deployment environments must not be duplicated");
      }
      if (
        typeof requiredDeployments.present === "boolean" &&
        requiredDeployments.present !== (environments.length > 0)
      ) {
        issues.push("required_deployments.present must match whether environments are declared");
      }
    }
  }

  const reviews = expected.required_pull_request_reviews;
  if (!isObject(reviews) || typeof reviews.present !== "boolean") {
    issues.push("expected.required_pull_request_reviews.present must be a boolean");
  } else if (reviews.present) {
    if (!Number.isInteger(reviews.required_approving_review_count)) {
      issues.push("required_approving_review_count must be an integer");
    }
    for (const field of [
      "dismiss_stale_reviews",
      "require_code_owner_reviews",
      "require_last_push_approval",
    ]) {
      if (typeof reviews[field] !== "boolean") {
        issues.push(`required_pull_request_reviews.${field} must be a boolean`);
      }
    }
    const bypass = reviews.bypass_pull_request_allowances;
    for (const category of ["users", "teams", "apps"]) {
      if (!isObject(bypass) || !Array.isArray(bypass[category])) {
        issues.push(`bypass_pull_request_allowances.${category} must be a list`);
      }
    }
  }

  const exceptions = policy.documented_exceptions;
  if (!Array.isArray(exceptions)) {
    issues.push("documented_exceptions must be a list");
    return issues;
  }
  const exceptionTargets = new Set();
  for (const [index, exception] of exceptions.entries()) {
    if (!isObject(exception)) {
      issues.push(`documented exception ${index} must be an object`);
      continue;
    }
    for (const field of exceptionFields) {
      if (!(field in exception)) {
        issues.push(`documented exception ${index} is missing ${field}`);
      }
    }
    if (typeof exception.field !== "string" || !exception.field.trim()) {
      issues.push(`documented exception ${index} must name a field`);
      continue;
    }
    if (exceptionTargets.has(exception.field)) {
      issues.push(`documented exception field is duplicated: ${exception.field}`);
    }
    exceptionTargets.add(exception.field);
    let resolved = resolveField(expected, exception.field);
    if (exception.field.startsWith("required_status_checks.checks.app_id:")) {
      const context = exception.field.slice("required_status_checks.checks.app_id:".length);
      const check = Array.isArray(checks)
        ? checks.find((candidate) => isObject(candidate) && candidate.context === context)
        : undefined;
      resolved = check ? { found: true, value: check.app_id } : { found: false, value: undefined };
    }
    if (!resolved.found) {
      issues.push(`documented exception is bound to no expected field: ${exception.field}`);
    } else if (
      Array.isArray(resolved.value) && Array.isArray(exception.value)
        ? JSON.stringify([...resolved.value].sort()) !== JSON.stringify([...exception.value].sort())
        : !Object.is(resolved.value, exception.value)
    ) {
      issues.push(`documented exception value does not match expected.${exception.field}`);
    }
    for (const field of ["reason", "compensating_controls", "retires_when"]) {
      if (typeof exception[field] !== "string" || !exception[field].trim()) {
        issues.push(`documented exception ${exception.field}.${field} must be non-empty`);
      }
    }
  }

  for (const [field, weakValue] of weakPostures) {
    const resolved = resolveField(expected, field);
    if (resolved.found && Object.is(resolved.value, weakValue) && !exceptionTargets.has(field)) {
      issues.push(`weak posture expected.${field}=${JSON.stringify(weakValue)} must have a documented exception`);
    }
  }
  if (Array.isArray(checks)) {
    for (const check of checks) {
      if (
        isObject(check) &&
        typeof check.context === "string" &&
        check.app_id === null &&
        !exceptionTargets.has(`required_status_checks.checks.app_id:${check.context}`)
      ) {
        issues.push(`required check ${check.context} with app_id null must have a documented exception`);
      }
    }
  }
  if (isObject(reviews) && isObject(reviews.bypass_pull_request_allowances)) {
    for (const category of ["users", "teams", "apps"]) {
      const allowance = reviews.bypass_pull_request_allowances[category];
      const field = `required_pull_request_reviews.bypass_pull_request_allowances.${category}`;
      if (Array.isArray(allowance) && allowance.length > 0 && !exceptionTargets.has(field)) {
        issues.push(`non-empty ${field} must have a documented exception`);
      }
    }
  }
  return issues;
}

export function loadBranchProtectionPolicy(policyPath = defaultPolicyPath) {
  return JSON.parse(readFileSync(policyPath, "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = validateBranchProtectionPolicy(loadBranchProtectionPolicy());
  if (issues.length > 0) {
    console.error("Branch-protection policy document gate failed:");
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("Branch-protection policy document gate passed.");
  }
}
