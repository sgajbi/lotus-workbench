import { spawn } from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CANDIDATE_ID = "idea_low_income_0123456789abcdef";
const OBSERVED_AT_UTC = "2026-09-07T01:07:19.124Z";
const ACCESS_SCOPE = {
  bookId: "BOOK_SG_BALANCED_DPM",
  clientId: "CLIENT_SCOPE_PB_SG_GLOBAL_BAL_001",
  portfolioId: "PB_SG_GLOBAL_BAL_001",
  tenantId: "tenant-sg",
} as const;
const EXPECTED_STATUSES = [
  "enriched",
  "scored",
  "governance_checked",
  "ready_for_review",
] as const;

type ObservedRequest = Readonly<{
  body: Record<string, unknown>;
  headers: IncomingMessage["headers"];
  method: string | undefined;
  url: string | undefined;
}>;

type ScriptResult = Readonly<{
  exitCode: number | null;
  requests: readonly ObservedRequest[];
  stderr: string;
  stdout: string;
}>;

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeJson(response: ServerResponse, payload: unknown): void {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function runLifecycleCommand(
  ideaBaseUrl: string,
): Promise<Omit<ScriptResult, "requests">> {
  const arguments_ = [
    join(
      process.cwd(),
      "scripts",
      "live",
      "invoke-idea-candidate-lifecycle-seed.mjs",
    ),
    "--idea-base-url",
    ideaBaseUrl,
    "--candidate-id",
    CANDIDATE_ID,
    "--observed-at-utc",
    OBSERVED_AT_UTC,
    "--tenant-id",
    ACCESS_SCOPE.tenantId,
    "--book-id",
    ACCESS_SCOPE.bookId,
    "--portfolio-id",
    ACCESS_SCOPE.portfolioId,
    "--client-id",
    ACCESS_SCOPE.clientId,
  ];

  const child = spawn(process.execPath, arguments_, {
    cwd: process.cwd(),
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { exitCode, stderr, stdout };
}

async function runLifecycleSeed(
  persistedStatusForTransition: (
    transitionIndex: number,
    requestedStatus: string,
  ) => string,
  runs = 1,
  initialStatus = "generated",
): Promise<ScriptResult> {
  const requests: ObservedRequest[] = [];
  let sourceStatus = initialStatus;
  let transitionCount = 0;
  const server = createServer(async (request, response) => {
    const bodyText = await readRequestBody(request);
    const body = bodyText
      ? (JSON.parse(bodyText) as Record<string, unknown>)
      : {};
    requests.push({
      body,
      headers: request.headers,
      method: request.method,
      url: request.url,
    });

    if (request.method === "GET") {
      writeJson(response, {
        candidate: { candidateId: CANDIDATE_ID, lifecycleStatus: sourceStatus },
      });
      return;
    }

    const requestedStatus = String(body.targetLifecycleStatus);
    sourceStatus = persistedStatusForTransition(
      transitionCount,
      requestedStatus,
    );
    transitionCount += 1;
    writeJson(response, {
      persistence: {
        candidateId: CANDIDATE_ID,
        decision: "accepted",
        lifecycleStatus: sourceStatus,
      },
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Lifecycle contract server did not expose a TCP port.");
    }
    let result: Omit<ScriptResult, "requests"> = {
      exitCode: null,
      stderr: "",
      stdout: "",
    };
    for (let run = 0; run < runs; run += 1) {
      result = await runLifecycleCommand(`http://127.0.0.1:${address.port}`);
      if (result.exitCode !== 0) {
        break;
      }
    }
    return { ...result, requests };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function expectCompleteAdmittedAuthority(request: ObservedRequest): void {
  expect(request.headers["x-caller-roles"]).toBe("advisor");
  expect(request.headers["x-caller-tenant-ids"]).toBe(ACCESS_SCOPE.tenantId);
  expect(request.headers["x-caller-book-ids"]).toBe(ACCESS_SCOPE.bookId);
  expect(request.headers["x-caller-portfolio-ids"]).toBe(
    ACCESS_SCOPE.portfolioId,
  );
  expect(request.headers["x-caller-client-ids"]).toBe(ACCESS_SCOPE.clientId);
}

describe("canonical Idea lifecycle seed", () => {
  it("progresses and replays from source-owned detail without duplicate transitions", async () => {
    const result = await runLifecycleSeed(
      (_index, requestedStatus) => requestedStatus,
      2,
    );

    expect(result.exitCode, result.stderr).toBe(0);
    const detailRequests = result.requests.filter(
      ({ method }) => method === "GET",
    );
    const transitionRequests = result.requests.filter(
      ({ method }) => method === "POST",
    );
    expect(detailRequests).toHaveLength(6);
    expect(transitionRequests).toHaveLength(4);
    for (const request of detailRequests) {
      expectCompleteAdmittedAuthority(request);
      expect(request.headers["x-caller-capabilities"]).toBe(
        "idea.candidate.detail.read",
      );
    }
    expect(
      transitionRequests.map(({ body }) => body.targetLifecycleStatus),
    ).toEqual(EXPECTED_STATUSES);
    for (const [index, request] of transitionRequests.entries()) {
      const status = EXPECTED_STATUSES[index];
      const identity = `canonical-idea-lifecycle:${CANDIDATE_ID}:${status}:${OBSERVED_AT_UTC}`;
      expectCompleteAdmittedAuthority(request);
      expect(request.url).toBe(
        `/api/v1/idea-candidates/${CANDIDATE_ID}/lifecycle-transitions`,
      );
      expect(request.headers["x-caller-capabilities"]).toBe(
        "idea.candidate.lifecycle.transition",
      );
      expect(request.headers["idempotency-key"]).toBe(identity);
      expect(request.body).toEqual({
        changedAtUtc: OBSERVED_AT_UTC,
        reasonCodes: ["review_required"],
        targetLifecycleStatus: status,
        transitionId: identity,
      });
    }
    expect(result.stdout).toContain(
      "already has source lifecycle 'ready_for_review'",
    );
  }, 30_000);

  it("fails closed when refreshed Idea detail does not prove the requested state", async () => {
    const result = await runLifecycleSeed((index, requestedStatus) =>
      index === 1 ? "enriched" : requestedStatus,
    );

    expect(result.exitCode).not.toBe(0);
    expect(
      result.requests.filter(({ method }) => method === "POST"),
    ).toHaveLength(2);
    expect(result.stderr).toContain(
      "returned state 'enriched' instead of 'scored' after persistence",
    );
  }, 30_000);

  it.each(["reviewed_by_advisor", "approved"])(
    "accepts an existing source-owned %s lifecycle without replaying setup transitions",
    async (sourceStatus) => {
      const result = await runLifecycleSeed(
        (_index, requestedStatus) => requestedStatus,
        1,
        sourceStatus,
      );

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.method).toBe("GET");
      expectCompleteAdmittedAuthority(result.requests[0]!);
      expect(result.stdout).toContain(
        `already exceeds the required review-ready lifecycle at '${sourceStatus}'`,
      );
    },
    30_000,
  );

  it("rejects a terminal lifecycle that cannot participate in the advisor demo", async () => {
    const result = await runLifecycleSeed(
      (_index, requestedStatus) => requestedStatus,
      1,
      "rejected",
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.requests).toHaveLength(1);
    expect(result.stderr).toContain(
      "candidate is in non-seedable source state 'rejected'",
    );
  }, 30_000);
});
