import { useRef } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdeaPresentationReceipts } from "../../src/features/proposals/use-idea-presentation-receipts";
import type { AdvisorIdeaReviewQueueData } from "../../src/features/proposals/types";

const recordReceipt = vi.hoisted(() => vi.fn());

vi.mock("../../src/features/proposals/api", () => ({
  recordAdvisorIdeaPresentationReceipt: recordReceipt,
}));

const queue: AdvisorIdeaReviewQueueData = {
  policyVersion: "queue-v4",
  evaluatedAtUtc: "2026-08-31T10:15:00Z",
  items: [
    {
      rank: 25,
      candidate: {
        candidateId: "idea-025",
        evidencePacketId: "packet-idea-025",
        materialVersion: 2,
        evidenceVersion: 3,
        scorePolicyVersion: "ranking-v7",
        sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
        sourceCutPosture: "coherent",
      },
    },
    {
      rank: 26,
      candidate: {
        candidateId: "idea-026",
        evidencePacketId: "packet-idea-026",
        materialVersion: 4,
        evidenceVersion: 5,
        scorePolicyVersion: "ranking-v7",
        sourceRevisionVectorDigest: `sha256:${"c".repeat(64)}`,
        sourceCutPosture: "coherent",
      },
    },
  ],
};

class TestIntersectionObserver implements IntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin = "0px";
  readonly thresholds: readonly number[];
  readonly targets = new Set<Element>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.root = options?.root ?? null;
    this.thresholds = [Number(options?.threshold ?? 0)];
    TestIntersectionObserver.instances.push(this);
  }

  disconnect() {
    this.targets.clear();
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  emit(
    observations: Array<{
      target: Element;
      isIntersecting: boolean;
      intersectionRatio: number;
    }>,
  ) {
    this.callback(
      observations.map((observation) => ({
        ...observation,
        boundingClientRect: observation.target.getBoundingClientRect(),
        intersectionRect: observation.target.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      })),
      this,
    );
  }
}

function Harness({
  candidateIds = ["idea-025", "idea-026"],
  sourceQueue = queue,
}: {
  candidateIds?: string[];
  sourceQueue?: AdvisorIdeaReviewQueueData;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const receiptState = useIdeaPresentationReceipts({
    containerRef,
    enabled: true,
    portfolioId: "PB_SG_GLOBAL_BAL_001",
    queue: sourceQueue,
  });
  return (
    <>
      <div ref={containerRef} data-testid="queue-viewport">
        {candidateIds.map((candidateId) => (
          <div key={candidateId} data-idea-presentation-candidate={candidateId}>
            {candidateId}
          </div>
        ))}
      </div>
      <span data-testid="receipt-status">{receiptState.status}</span>
      <span data-testid="failed-count">{receiptState.failedCount}</span>
      <span data-testid="receipt-authority">
        {receiptState.authorityByCandidateId.get("idea-025")?.receiptId ??
          "none"}
      </span>
      <button type="button" onClick={() => void receiptState.retryFailed()}>
        Retry
      </button>
    </>
  );
}

function marker(candidateId: string): Element {
  return document.querySelector(
    `[data-idea-presentation-candidate="${candidateId}"]`,
  )!;
}

async function observer(): Promise<TestIntersectionObserver> {
  await waitFor(() => {
    expect(TestIntersectionObserver.instances).toHaveLength(1);
    expect(TestIntersectionObserver.instances[0].targets.size).toBeGreaterThan(
      0,
    );
  });
  return TestIntersectionObserver.instances[0];
}

function setVisualTop(target: Element, top: number) {
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    bottom: top + 40,
    height: 40,
    left: 0,
    right: 300,
    top,
    width: 300,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

describe("useIdeaPresentationReceipts", () => {
  afterEach(() => {
    // Vitest 4 reuses an existing spy; restore browser methods even after a failed assertion.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    recordReceipt.mockReset();
    recordReceipt.mockImplementation(async ({ candidateId, request }) => ({
      receipt: {
        ...request,
        candidateId,
        receiptId: `receipt-${candidateId}`,
      },
      persistenceDecision: "accepted",
    }));
    TestIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("uses the browser viewport and does not treat a clipped buffer row as presentation", async () => {
    render(<Harness />);
    const visibilityObserver = await observer();
    expect(visibilityObserver.root).toBeNull();
    expect(visibilityObserver.thresholds).toEqual([0.5]);
    setVisualTop(screen.getByTestId("queue-viewport"), 0);
    setVisualTop(marker("idea-025"), 10);

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: false,
          intersectionRatio: 0,
        },
      ]);
      document.dispatchEvent(new Event("scroll", { bubbles: true }));
      await Promise.resolve();
    });

    expect(recordReceipt).not.toHaveBeenCalled();
    expect(screen.getByTestId("receipt-status")).toHaveTextContent("ready");
  });

  it("records a true rank-25 / visible-count-1 observation", async () => {
    render(<Harness />);
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 0.5,
        },
      ]);
    });

    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(1));
    expect(recordReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: "idea-025",
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        request: expect.objectContaining({
          rankAtPresentation: 25,
          visibleCandidateCount: 1,
        }),
      }),
    );
    expect(recordReceipt.mock.calls[0][0].request).not.toHaveProperty(
      "tenantId",
    );
    await waitFor(() =>
      expect(screen.getByTestId("receipt-authority")).toHaveTextContent(
        "receipt-idea-025",
      ),
    );
  });

  it("uses one digest for the exact visual order of the visible set", async () => {
    render(<Harness />);
    const visibilityObserver = await observer();
    setVisualTop(marker("idea-026"), 100);
    setVisualTop(marker("idea-025"), 200);

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
        {
          target: marker("idea-026"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(2));
    const [first, second] = recordReceipt.mock.calls.map(([input]) => input);
    expect([first.candidateId, second.candidateId]).toEqual([
      "idea-026",
      "idea-025",
    ]);
    expect(first.request.visibleCandidateCount).toBe(2);
    expect(second.request.visibleCandidateCount).toBe(2);
    expect(first.request.queueSnapshotDigest).toBe(
      second.request.queueSnapshotDigest,
    );
  });

  it("requires fresh intersection evidence after the document becomes visible", async () => {
    render(<Harness candidateIds={["idea-025"]} />);
    const visibilityObserver = await observer();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(visibilityObserver.targets).toHaveLength(0);

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
      await Promise.resolve();
    });
    expect(recordReceipt).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(recordReceipt).not.toHaveBeenCalled();
    expect(visibilityObserver.targets).toContain(marker("idea-025"));

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(1));
  });

  it("invalidates an asynchronous receipt draft when the document becomes hidden", async () => {
    let resolveDigest!: (value: ArrayBuffer) => void;
    const digest = vi
      .spyOn(globalThis.crypto.subtle, "digest")
      .mockImplementationOnce(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveDigest = resolve;
          }),
      );
    render(<Harness candidateIds={["idea-025"]} />);
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(digest).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      resolveDigest(new ArrayBuffer(32));
      await Promise.resolve();
    });
    expect(recordReceipt).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(1));
    expect(digest).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate a recorded candidate after rerender or repeated intersection", async () => {
    const view = render(<Harness candidateIds={["idea-025"]} />);
    const visibilityObserver = await observer();
    const candidateMarker = marker("idea-025");

    await act(async () => {
      visibilityObserver.emit([
        { target: candidateMarker, isIntersecting: true, intersectionRatio: 1 },
        { target: candidateMarker, isIntersecting: true, intersectionRatio: 1 },
      ]);
    });
    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(1));

    view.rerender(<Harness candidateIds={["idea-025"]} />);
    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
      await Promise.resolve();
    });
    expect(recordReceipt).toHaveBeenCalledTimes(1);
  });

  it("records a new observation when same-boundary source lineage changes", async () => {
    const view = render(<Harness candidateIds={["idea-025"]} />);
    const initialObserver = await observer();

    await act(async () => {
      initialObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(1));

    const changedDigest = `sha256:${"d".repeat(64)}`;
    view.rerender(
      <Harness
        candidateIds={["idea-025"]}
        sourceQueue={{
          ...queue,
          items: [
            {
              ...queue.items![0]!,
              candidate: {
                ...queue.items![0]!.candidate!,
                sourceRevisionVectorDigest: changedDigest,
              },
            },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("receipt-authority")).toHaveTextContent("none");
    await waitFor(() => {
      expect(TestIntersectionObserver.instances).toHaveLength(2);
    });
    await act(async () => {
      TestIntersectionObserver.instances[1].emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(2));
    expect(recordReceipt.mock.calls[1][0].request.sourceRevisionVectorDigest).toBe(
      changedDigest,
    );
  });

  it("does not emit when an observed row unmounts while its receipt draft is pending", async () => {
    let resolveDigest!: (value: ArrayBuffer) => void;
    const digest = vi
      .spyOn(globalThis.crypto.subtle, "digest")
      .mockImplementation(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveDigest = resolve;
          }),
      );
    const view = render(<Harness candidateIds={["idea-025"]} />);
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(digest).toHaveBeenCalledTimes(1));

    view.unmount();
    await act(async () => {
      resolveDigest(new ArrayBuffer(32));
      await Promise.resolve();
    });

    expect(recordReceipt).not.toHaveBeenCalled();
  });

  it("does not emit a pending draft after the source queue snapshot changes", async () => {
    let resolveDigest!: (value: ArrayBuffer) => void;
    const digest = vi
      .spyOn(globalThis.crypto.subtle, "digest")
      .mockImplementation(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveDigest = resolve;
          }),
      );
    const view = render(<Harness candidateIds={["idea-025"]} />);
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(digest).toHaveBeenCalledTimes(1));

    view.rerender(
      <Harness
        candidateIds={["idea-025"]}
        sourceQueue={{ ...queue, evaluatedAtUtc: "2026-08-31T10:16:00Z" }}
      />,
    );
    await waitFor(() => {
      expect(TestIntersectionObserver.instances).toHaveLength(2);
    });
    await act(async () => {
      resolveDigest(new ArrayBuffer(32));
      await Promise.resolve();
    });

    expect(recordReceipt).not.toHaveBeenCalled();
  });

  it("retries the frozen payload and idempotency key after an explicit failure", async () => {
    recordReceipt.mockRejectedValueOnce(new Error("unavailable"));
    render(<Harness candidateIds={["idea-025"]} />);
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("receipt-status")).toHaveTextContent(
        "attention",
      );
    });
    const firstInput = recordReceipt.mock.calls[0][0];

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(2));
    expect(recordReceipt.mock.calls[1][0]).toEqual(firstInput);
    await waitFor(() => {
      expect(screen.getByTestId("receipt-status")).toHaveTextContent("ready");
    });
  });

  it("fails visibly without emitting when source versions are absent", async () => {
    render(
      <Harness
        candidateIds={["idea-025"]}
        sourceQueue={{
          ...queue,
          items: [{ rank: 25, candidate: { candidateId: "idea-025" } }],
        }}
      />,
    );
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("receipt-status")).toHaveTextContent(
        "unavailable",
      );
    });
    expect(recordReceipt).not.toHaveBeenCalled();
  });

  it("preserves unavailable source posture when an earlier receipt completes", async () => {
    let resolveReceipt!: (value: { persistenceDecision: string }) => void;
    recordReceipt.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReceipt = resolve;
        }),
    );
    render(
      <Harness
        sourceQueue={{
          ...queue,
          items: [
            queue.items![0],
            { rank: 26, candidate: { candidateId: "idea-026" } },
          ],
        }}
      />,
    );
    const visibilityObserver = await observer();

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-025"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => expect(recordReceipt).toHaveBeenCalledTimes(1));

    await act(async () => {
      visibilityObserver.emit([
        {
          target: marker("idea-026"),
          isIntersecting: true,
          intersectionRatio: 1,
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("receipt-status")).toHaveTextContent(
        "unavailable",
      );
    });

    await act(async () => {
      resolveReceipt({ persistenceDecision: "accepted" });
    });
    expect(screen.getByTestId("receipt-status")).toHaveTextContent(
      "unavailable",
    );
  });
});
